"""Patient-scoped read APIs for Lab and X-ray service charges."""
from fastapi import APIRouter, Depends, HTTPException
import psycopg2.extras
import db_config
from api.auth_helper import get_current_user

router = APIRouter(prefix='/api/billing', tags=['Service billing'])


@router.get('/patients/{patient_id}/charges')
def patient_charges(patient_id: int, user=Depends(get_current_user)):
    if patient_id <= 0:
        raise HTTPException(400, 'Invalid patient ID.')
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id FROM patients WHERE id=%s', (patient_id,))
            if not cur.fetchone():
                raise HTTPException(404, 'Patient not found.')
            cur.execute('''SELECT id,patient_id,visit_id,admission_id,source_type,source_order_id,
                                  service_code,service_name,view,amount,currency,billing_status,source,created_at
                           FROM patient_charges WHERE patient_id=%s ORDER BY created_at DESC,id DESC''', (patient_id,))
            charges = [dict(row) for row in cur.fetchall()]
    total = sum((row['amount'] for row in charges if row['billing_status'] != 'CANCELLED'), 0)
    return {'patient_id': patient_id, 'charges': charges, 'total': total, 'currency': 'INR'}

