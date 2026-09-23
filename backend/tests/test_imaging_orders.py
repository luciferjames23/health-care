import io
import os
import unittest
import uuid
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, ComputedRadiographyImageStorage, generate_uid
from api.auth_helper import encode_token
from routers import imaging_orders as orders


def xray_bytes(patient_id='PAT-1', accession=''):
    meta=FileMetaDataset()
    meta.TransferSyntaxUID=ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID=ComputedRadiographyImageStorage
    meta.MediaStorageSOPInstanceUID=generate_uid()
    ds=FileDataset(None,{},file_meta=meta,preamble=b'\0'*128)
    ds.SOPClassUID=meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID=meta.MediaStorageSOPInstanceUID
    ds.StudyInstanceUID=generate_uid(); ds.SeriesInstanceUID=generate_uid()
    ds.PatientID=patient_id; ds.Modality='CR'; ds.AccessionNumber=accession
    ds.Rows=2; ds.Columns=2; ds.SamplesPerPixel=1
    ds.PhotometricInterpretation='MONOCHROME2'; ds.BitsAllocated=8; ds.BitsStored=8; ds.HighBit=7; ds.PixelRepresentation=0
    ds.PixelData=b'\0\1\2\3'
    stream=io.BytesIO(); ds.save_as(stream,enforce_file_format=True)
    return stream.getvalue()


class OrderValidationTests(unittest.TestCase):
    def test_patient_mismatch_rejected(self):
        conn = MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchall.return_value = []
        with patch.object(orders.db_config, 'get_db_connection', return_value=conn), self.assertRaises(HTTPException) as e:
            orders.prepare_dicom(xray_bytes('WRONG'),{'patient_id':1,'patient_code':'PAT-1','accession_number':'XR1'})
        self.assertEqual(e.exception.status_code,422)

    def test_mapped_uuid_preserves_dicom_identity_and_pixels(self):
        import pydicom
        conn = MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchall.return_value = [(1, 'PAT-1')]
        content = xray_bytes('source-patient-uuid')
        with patch.object(orders.db_config, 'get_db_connection', return_value=conn):
            output, _ = orders.prepare_dicom(content, {'patient_id': 1, 'patient_code': 'PAT-1', 'accession_number': 'XR1'})
        result = pydicom.dcmread(io.BytesIO(output))
        self.assertEqual(result.PatientID, 'source-patient-uuid')
        self.assertEqual(result.PixelData, pydicom.dcmread(io.BytesIO(content)).PixelData)

    def test_other_patient_and_ambiguous_mapping_rejected(self):
        for matches in ([(2, 'PAT-2')], [(1, 'PAT-1'), (2, 'PAT-2')]):
            conn = MagicMock()
            conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchall.return_value = matches
            with patch.object(orders.db_config, 'get_db_connection', return_value=conn), self.assertRaises(HTTPException) as caught:
                orders.validate_dicom_patient('source-uuid', {'patient_id': 1, 'patient_code': 'PAT-1'})
            self.assertEqual(caught.exception.status_code, 422)

    def test_mapping_database_failure_fails_closed(self):
        with patch.object(orders.db_config, 'get_db_connection', side_effect=RuntimeError('unavailable')), self.assertRaises(HTTPException) as caught:
            orders.validate_dicom_patient('source-uuid', {'patient_id': 1})
        self.assertEqual(caught.exception.status_code, 503)

    def test_unmapped_image_requests_review_then_accepts_confirmation(self):
        conn = MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchall.return_value = []
        order = {'patient_id': 1, 'patient_code': 'PAT-1', 'accession_number': 'XR1'}
        with patch.object(orders.db_config, 'get_db_connection', return_value=conn):
            with self.assertRaises(HTTPException) as caught:
                orders.prepare_dicom(xray_bytes('new-uuid'), order)
            self.assertEqual(caught.exception.detail['code'], 'patient_mapping_required')
            self.assertEqual(caught.exception.detail['dicom_patient_id'], 'new-uuid')
            self.assertIn('dicom_patient_name', caught.exception.detail)
            output, _ = orders.prepare_dicom(xray_bytes('new-uuid'), order, confirmed=True)
        import pydicom
        result = pydicom.dcmread(io.BytesIO(output))
        self.assertEqual(result.PatientID, 'new-uuid')
        self.assertEqual(result.PixelData, b'\0\1\2\3')

    def test_confirmation_cannot_override_known_patient_or_accession(self):
        conn = MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchall.return_value = [(2, 'PAT-2')]
        order = {'patient_id': 1, 'patient_code': 'PAT-1', 'accession_number': 'XR1'}
        with patch.object(orders.db_config, 'get_db_connection', return_value=conn):
            for content in (xray_bytes('known-uuid'), xray_bytes('new-uuid', 'OTHER'), xray_bytes('')):
                with self.assertRaises(HTTPException) as caught:
                    orders.prepare_dicom(content, order, confirmed=True)
                self.assertEqual(caught.exception.status_code, 422)

    def test_accession_mismatch_rejected(self):
        with self.assertRaises(HTTPException):
            orders.prepare_dicom(xray_bytes(accession='OTHER'),{'patient_id':1,'patient_code':'PAT-1','accession_number':'XR1'})

    def test_accession_added_without_changing_patient_or_pixels(self):
        import pydicom
        content=xray_bytes()
        output,uid=orders.prepare_dicom(content,{'patient_id':1,'patient_code':'PAT-1','accession_number':'XR1'})
        original=pydicom.dcmread(io.BytesIO(content)); result=pydicom.dcmread(io.BytesIO(output))
        self.assertEqual(result.AccessionNumber,'XR1')
        self.assertEqual(result.PatientID,original.PatientID)
        self.assertEqual(result.PixelData,original.PixelData)
        self.assertEqual(uid,original.StudyInstanceUID)

    def test_radiologist_cannot_create_order(self):
        body=orders.NewOrder(patient_id=1,examination='Chest X-ray PA',indication='Test indication',request_id=uuid.uuid4())
        with self.assertRaises(HTTPException) as e:
            orders.create_order(body,{'role':'radiologist','user_id':2})
        self.assertEqual(e.exception.status_code,403)

    def test_doctor_accepts_authenticated_account_selection(self):
        conn=MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value=(1,'Doctor')
        with patch.object(orders.db_config,'get_db_connection',return_value=conn):
            for method in (None,'password','account_selection'):
                credentials=HTTPAuthorizationCredentials(scheme='Bearer',credentials=encode_token({'user_id':1,'auth_method':method}))
                if method:
                    self.assertEqual(orders.order_user(credentials)['role'],'doctor')
                else:
                    with self.assertRaises(HTTPException) as e: orders.order_user(credentials)
                    self.assertEqual(e.exception.status_code,401)


@unittest.skipUnless(os.getenv('RUN_DB_INTEGRATION')=='1','Opt-in database test; uses a rolled-back temporary table')
class DatabaseOrderFlowTests(unittest.TestCase):
    def test_request_queue_upload_and_retry(self):
        import db_config
        conn=db_config.get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('CREATE TEMP TABLE radiology_orders (LIKE public.radiology_orders INCLUDING ALL) ON COMMIT DROP')
                cur.execute('CREATE TEMP TABLE radiology_patient_identifiers (LIKE public.radiology_patient_identifiers INCLUDING ALL) ON COMMIT DROP')
                cur.execute('CREATE TEMP TABLE radiology_scan (LIKE public.radiology_scan INCLUDING ALL) ON COMMIT DROP')
                cur.execute('SELECT id,patient_code FROM patients ORDER BY id LIMIT 1'); patient_id,patient_code=cur.fetchone()
                cur.execute("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(r.name)='doctor' AND u.is_active=true ORDER BY u.id LIMIT 2"); doctor_ids=[row[0] for row in cur.fetchall()]
                cur.execute("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(r.name)='radiologist' AND u.is_active=true LIMIT 1"); radiologist=cur.fetchone()[0]
            class Transaction:
                def __enter__(self): return self
                def __exit__(self,*args): pass
                def cursor(self,*args,**kwargs): return conn.cursor(*args,**kwargs)
                def commit(self): pass
            doctor={'user_id':doctor_ids[0],'role':'doctor'}
            reviewer={'user_id':radiologist,'role':'radiologist'}
            body=orders.NewOrder(patient_id=patient_id,examination='Chest X-ray PA',indication='Automated rollback-only workflow test',request_id=uuid.uuid4())
            with patch.object(orders.db_config,'get_db_connection',return_value=Transaction()):
                created=orders.create_order(body,doctor)
                self.assertEqual(orders.create_order(body,doctor)['order_id'],created['order_id'])
                self.assertEqual(len(orders.list_orders(None,reviewer)['orders']),1)
                self.assertEqual(orders.list_orders(None,{'user_id':doctor_ids[1],'role':'doctor'})['orders'],[])
                content=xray_bytes(patient_code or str(patient_id))
                def pacs(method,path,**kwargs):
                    response=MagicMock()
                    response.json.return_value=[] if path=='/tools/find' else {'ID':'test-instance','ParentStudy':'test-study'}
                    return response
                with patch.object(orders,'_request',side_effect=pacs) as upload:
                    saved=orders.upload_order(body.request_id,UploadFile(io.BytesIO(content),filename='test.dcm'),reviewer)
                    self.assertEqual(saved['status'],'Uploaded')
                    self.assertEqual(saved['uploaded_by'],radiologist)
                    repeat=orders.upload_order(body.request_id,UploadFile(io.BytesIO(content),filename='test.dcm'),reviewer)
                    self.assertEqual(repeat['orthanc_instance_id'],'test-instance')
                    self.assertEqual(upload.call_count,2)
                self.assertEqual(orders.list_orders(patient_id,doctor)['orders'][0]['status'],'Uploaded')
                new_body = body.model_copy(update={'request_id': uuid.uuid4()})
                orders.create_order(new_body, doctor)
                new_content = xray_bytes('test-new-' + uuid.uuid4().hex)
                with patch.object(orders, '_request', side_effect=pacs):
                    with self.assertRaises(HTTPException) as caught:
                        orders.upload_order(new_body.request_id, UploadFile(io.BytesIO(new_content), filename='new.dcm'), reviewer)
                    self.assertEqual(caught.exception.detail['code'], 'patient_mapping_required')
                    # Use distinct PACS identifiers for the second synthetic study.
                    def second_pacs(method, path, **kwargs):
                        response = pacs(method, path, **kwargs)
                        if path == '/instances': response.json.return_value = {'ID':'second-instance','ParentStudy':'second-study'}
                        return response
                    with patch.object(orders, '_request', side_effect=second_pacs):
                        saved = orders.upload_order(new_body.request_id, UploadFile(io.BytesIO(new_content), filename='new.dcm'), reviewer, True)
                    self.assertEqual(saved['status'], 'Uploaded')
                import pydicom
                new_id = str(pydicom.dcmread(io.BytesIO(new_content)).PatientID)
                orders.validate_dicom_patient(new_id, {'patient_id': patient_id})
                with self.assertRaises(HTTPException):
                    orders.validate_dicom_patient(new_id, {'patient_id': -1}, confirmed=True)
                with conn.cursor() as cur:
                    cur.execute('SELECT verified_by,order_id,upload_sha256 FROM radiology_patient_identifiers WHERE dicom_patient_id=%s', (new_id,))
                    audit = cur.fetchone()
                    self.assertEqual(audit[0], radiologist)
                    self.assertEqual(str(audit[1]), str(new_body.request_id))
                    self.assertEqual(audit[2], orders.hashlib.sha256(new_content).hexdigest())
                from radiology_ai.services import study_store
                result = {'source': {'study_instance_uid': saved['study_instance_uid']},
                          'localization': {'opacity_detected': False}, 'images': {'original': 'actual-image'},
                          'study_id': 'analysis-id', 'analyzed_at': '2026-09-22T00:00:00Z'}
                with patch.object(study_store, 'get_connection', return_value=Transaction()):
                    study_store.save_study(result)
                    self.assertEqual(result['patient_id'], patient_id)
                    self.assertEqual(len(study_store.list_studies()), 1)
                    study_store.update_review_status(result['study_id'], 'Confirmed', '2026-09-22T01:00:00Z', 'Radiologist', 'Original review')
                    study_store.save_study(result)
                    persisted = study_store.get_study(result['study_id'])
                    self.assertEqual(persisted['review_status'], 'Confirmed')
                    self.assertEqual(persisted['scan_report'], 'Original review')
                    self.assertEqual(persisted['images']['original'], 'actual-image')
                    self.assertEqual(len(study_store.list_studies()), 1)
                    self.assertIsNone(study_store.get_study(str(patient_id)))
                    with self.assertRaises(HTTPException):
                        study_store.save_study({'source': {'study_instance_uid': 'unlinked-study'}})


        finally:
            conn.rollback(); conn.close()

if __name__=='__main__': unittest.main()
