import unittest
from unittest.mock import patch, MagicMock
from radiology_ai.services import orthanc_service as service


class LocalizedSeriesTests(unittest.TestCase):
    def test_publish_reuses_original_study_and_is_idempotent(self):
        record = {'study_id': 'result-1', 'metadata': {'study_instance_uid': '1.2.3'}, 'images': {'annotated': 'cG5n'}}
        published = set()
        payloads = []
        def request(method, path, **kwargs):
            body = kwargs['json']
            if path == '/tools/create-dicom':
                payloads.append(body)
                published.add(body['Tags']['SOPInstanceUID'])
                return MagicMock()
            found = ['parent'] if body['Level'] == 'Study' else (['instance'] if body['Query']['SOPInstanceUID'] in published else [])
            response = MagicMock()
            response.json.return_value = found
            return response
        with patch.object(service, '_request', side_effect=request):
            first = service.ensure_localized_series(record)
            second = service.ensure_localized_series(record)
        self.assertEqual(first, second)
        self.assertEqual(len(payloads), 1)
        self.assertEqual(payloads[0]['Parent'], 'parent')
        self.assertEqual(payloads[0]['Content'], 'data:image/png;base64,cG5n')
        self.assertEqual(payloads[0]['Tags']['SOPClassUID'], '1.2.840.10008.5.1.4.1.1.7')

    def test_missing_original_does_not_create_study(self):
        response = MagicMock()
        response.json.return_value = []
        with patch.object(service, '_request', return_value=response) as request:
            with self.assertRaises(service.OrthancError):
                service.ensure_localized_series({'study_id': 'a', 'metadata': {'study_instance_uid': '1.2'}, 'images': {'annotated': 'abc'}})
            self.assertEqual(request.call_count, 1)

    def test_inference_skips_ai_series(self):
        with patch.object(service, 'get_study', return_value={'Series': ['ai', 'original']}), patch.object(service, 'get_series', side_effect=[
            {'MainDicomTags': {'SeriesDescription': service.AI_SERIES_DESCRIPTION}, 'Instances': ['derived']},
            {'MainDicomTags': {}, 'Instances': ['source']},
        ]):
            self.assertEqual(service.get_first_instance_for_study('study').instance_id, 'source')

if __name__ == '__main__':
    unittest.main()
