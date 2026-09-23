from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import logging
import uuid

from db_config import get_db_connection

logger = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/api/finance",
    tags=["Financial & Revenue Dynamic API"]
)

# Helper to serialize decimals and datetimes
def serialize_row(cursor, row):
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    res = {}
    for col, val in zip(columns, row):
        if hasattr(val, "isoformat"):
            res[col] = val.isoformat()
        elif hasattr(val, "as_integer_ratio") or str(type(val)) == "<class 'decimal.Decimal'>":
            res[col] = float(val) if val is not None else 0.0
        else:
            res[col] = val
    return res

def serialize_rows(cursor, rows):
    if not rows:
        return []
    columns = [col[0] for col in cursor.description]
    result = []
    for row in rows:
        item = {}
        for col, val in zip(columns, row):
            if hasattr(val, "isoformat"):
                item[col] = val.isoformat()
            elif hasattr(val, "as_integer_ratio") or str(type(val)) == "<class 'decimal.Decimal'>":
                item[col] = float(val) if val is not None else 0.0
            else:
                item[col] = val
        result.append(item)
    return result


@router.get("/overview")
def get_financial_overview():
    """
    Get top-level KPI metrics across Bills, Insurance Claims, and Payments.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Bills KPIs
        cur.execute("""
            SELECT 
                COUNT(*) as total_bills,
                COALESCE(SUM(gross_amount), 0) as total_gross,
                COALESCE(SUM(discount_amount), 0) as total_discount,
                COALESCE(SUM(tax_amount), 0) as total_tax,
                COALESCE(SUM(net_amount), 0) as total_net,
                COALESCE(SUM(insurance_amount), 0) as total_insurance_share,
                COALESCE(SUM(patient_amount), 0) as total_patient_due,
                COALESCE(SUM(CASE WHEN bill_status = 'Settled' THEN net_amount ELSE 0 END), 0) as settled_revenue,
                COALESCE(SUM(CASE WHEN bill_status = 'Pending' THEN net_amount ELSE 0 END), 0) as pending_revenue,
                COALESCE(SUM(CASE WHEN bill_status = 'Partially Paid' THEN net_amount ELSE 0 END), 0) as partial_revenue,
                COUNT(CASE WHEN bill_status = 'Settled' THEN 1 END) as settled_count,
                COUNT(CASE WHEN bill_status = 'Pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN bill_status = 'Partially Paid' THEN 1 END) as partial_count
            FROM bills
        """)
        bill_stats = serialize_row(cur, cur.fetchone())

        # Insurance Claims KPIs
        cur.execute("""
            SELECT 
                COUNT(*) as total_claims,
                COALESCE(SUM(claimed_amount), 0) as total_claimed,
                COALESCE(SUM(approved_amount), 0) as total_approved,
                COALESCE(SUM(rejected_amount), 0) as total_rejected,
                COALESCE(SUM(settled_amount), 0) as total_settled,
                COUNT(CASE WHEN claim_status = 'Settled Cashless' THEN 1 END) as settled_claims_count,
                COUNT(CASE WHEN claim_status = 'Partially Approved' THEN 1 END) as partial_claims_count
            FROM insurance_claims
        """)
        claim_stats = serialize_row(cur, cur.fetchone())

        # Payments Summary
        cur.execute("""
            SELECT 
                COUNT(*) as total_payments,
                COALESCE(SUM(CASE WHEN payment_status = 'SUCCESS' THEN amount ELSE 0 END), 0) as total_collected,
                COUNT(CASE WHEN payment_status = 'SUCCESS' THEN 1 END) as success_payment_count,
                COUNT(CASE WHEN payment_status = 'PENDING' THEN 1 END) as pending_payment_count
            FROM payments
        """)
        payment_stats = serialize_row(cur, cur.fetchone())

        return {
            "success": True,
            "bills": bill_stats,
            "claims": claim_stats,
            "payments": payment_stats,
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching financial overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/bills")
def get_bills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("bill_id"),
    order: str = Query("desc")
):
    """
    Get paginated bills joined with patient details and admission encounters.
    Supports filtering by bill status and searching by patient name, UHID, or bill number.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        where_clauses = ["1=1"]
        params = []
        
        if status and status.lower() != "all":
            where_clauses.append("LOWER(b.bill_status) = LOWER(%s)")
            params.append(status)
            
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            where_clauses.append("""
                (b.bill_number ILIKE %s OR 
                 p.patient_code ILIKE %s OR 
                 p.first_name ILIKE %s OR 
                 p.last_name ILIKE %s OR 
                 CONCAT(p.first_name, ' ', p.last_name) ILIKE %s)
            """)
            params.extend([search_term, search_term, search_term, search_term, search_term])
            
        where_sql = " AND ".join(where_clauses)
        
        # Count total
        count_sql = f"""
            SELECT COUNT(*) 
            FROM bills b
            LEFT JOIN patients p ON b.patient_id = p.id
            WHERE {where_sql}
        """
        cur.execute(count_sql, tuple(params))
        total_count = cur.fetchone()[0]
        
        # Sort validation
        allowed_sorts = {
            "bill_id": "b.bill_id",
            "bill_date": "b.bill_date",
            "gross_amount": "b.gross_amount",
            "net_amount": "b.net_amount",
            "patient_amount": "b.patient_amount",
            "bill_status": "b.bill_status"
        }
        sort_col = allowed_sorts.get(sort_by, "b.bill_id")
        sort_order = "ASC" if order.lower() == "asc" else "DESC"
        
        offset = (page - 1) * page_size
        
        # Fetch items
        query_sql = f"""
            SELECT 
                b.bill_id,
                b.bill_number,
                b.bill_date,
                b.patient_id,
                b.admission_id,
                b.visit_id,
                b.gross_amount,
                b.discount_amount,
                b.tax_amount,
                b.net_amount,
                b.insurance_amount,
                b.patient_amount,
                b.bill_status,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone as patient_phone,
                p.gender,
                a.admission_number,
                a.discharge_status,
                (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.bill_id) as item_count,
                (SELECT COUNT(*) FROM payments py WHERE py.bill_id = b.bill_id AND py.payment_status = 'SUCCESS') as payment_count,
                (SELECT COALESCE(SUM(py.amount), 0) FROM payments py WHERE py.bill_id = b.bill_id AND py.payment_status = 'SUCCESS') as paid_amount
            FROM bills b
            LEFT JOIN patients p ON b.patient_id = p.id
            LEFT JOIN admissions a ON b.admission_id = a.admission_id
            WHERE {where_sql}
            ORDER BY {sort_col} {sort_order}
            LIMIT %s OFFSET %s
        """
        
        cur.execute(query_sql, tuple(params + [page_size, offset]))
        rows = serialize_rows(cur, cur.fetchall())
        
        # Format rows for UI
        formatted = []
        for r in rows:
            p_name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip() or "Walk-in Patient"
            formatted.append({
                "bill_id": r["bill_id"],
                "bill_number": r["bill_number"],
                "inv": r["bill_number"],
                "bill_date": r["bill_date"],
                "patient_id": r["patient_id"],
                "patient": p_name,
                "uhid": r.get("patient_code") or f"MER-PAT-{str(r['patient_id'] or 0).zfill(7)}",
                "phone": r.get("patient_phone") or "—",
                "gender": r.get("gender") or "—",
                "adm": r.get("admission_number") or (f"MER-ADM-{str(r['admission_id']).zfill(7)}" if r.get("admission_id") else "Outpatient / OPD"),
                "total": r.get("net_amount") or r.get("gross_amount") or 0.0,
                "gross_amount": r.get("gross_amount") or 0.0,
                "discount_amount": r.get("discount_amount") or 0.0,
                "tax_amount": r.get("tax_amount") or 0.0,
                "tpa": r.get("insurance_amount") or 0.0,
                "patientShare": r.get("patient_amount") or 0.0,
                "status": r.get("bill_status") or "Pending",
                "paid_amount": r.get("paid_amount") or 0.0,
                "item_count": r.get("item_count") or 0,
                "pharmacyClear": r.get("bill_status") == "Settled" or (r.get("patient_amount") == 0),
                "dischargeClear": r.get("bill_status") == "Settled",
            })
            
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        
        return {
            "success": True,
            "items": formatted,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    except Exception as e:
        logger.error(f"Error fetching bills: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/bills/admission/{admission_id}")
def get_bill_by_admission(admission_id: int):
    """
    Get deep billing details for a specific admission, including room charges,
    pharmacy sales/medications, laboratory orders/results, and payments.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT bill_id FROM bills WHERE admission_id = %s ORDER BY bill_id DESC LIMIT 1", (admission_id,))
        row = cur.fetchone()
        if row and row[0]:
            conn.close()
            return get_bill_detail(row[0])
            
        # If no direct bill row exists in `bills`, check dim_admission_inputs
        cur.execute("""
            SELECT a.admission_id, a.patient_id, a.admission_number, a.admission_date, a.discharge_date,
                   a.admission_type, a.reason_for_admission, a.discharge_status,
                   p.patient_code, p.first_name, p.last_name, p.phone, p.gender, p.blood_group,
                   dai.llm_input_json
            FROM admissions a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN dim_admission_inputs dai ON a.admission_id = dai.admission_id
            WHERE a.admission_id = %s
        """, (admission_id,))
        adm = cur.fetchone()
        if not adm:
            raise HTTPException(status_code=404, detail="Admission not found")
            
        adm_data = serialize_row(cur, adm)
        p_name = f"{adm_data.get('first_name') or ''} {adm_data.get('last_name') or ''}".strip() or "Patient"
        
        # Parse llm_input_json if available
        llm_json = {}
        if adm_data.get("llm_input_json"):
            try:
                llm_json = json.loads(adm_data["llm_input_json"]) if isinstance(adm_data["llm_input_json"], str) else adm_data["llm_input_json"]
            except Exception:
                llm_json = {}
                
        billing_info = llm_json.get("billing", {})
        
        # Fetch pharmacy items
        cur.execute("""
            SELECT 
                psi.sale_item_id,
                psi.sale_id,
                COALESCE(m.medication_name, 'Prescribed Medication') as item_name,
                m.generic_name,
                m.category,
                psi.quantity,
                psi.unit_price,
                psi.discount_amount,
                psi.tax_amount,
                psi.net_amount,
                ps.sale_date,
                ps.payment_status
            FROM pharmacy_sales ps
            JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
            LEFT JOIN medications m ON psi.medication_id = m.medication_id
            WHERE ps.admission_id = %s
            ORDER BY psi.sale_item_id ASC
        """, (admission_id,))
        pharmacy_items = serialize_rows(cur, cur.fetchall())
        
        # Fetch lab items
        cur.execute("""
            SELECT 
                lo.lab_order_id,
                lo.ordered_date,
                lo.priority,
                lo.status as order_status,
                COALESCE(lt.test_name, 'Diagnostic Test') as item_name,
                lt.test_category,
                COALESCE(lt.standard_charge, 0.0) as unit_price,
                1 as quantity,
                COALESCE(lt.standard_charge, 0.0) as net_amount,
                lr.test_parameter,
                lr.result_value,
                lr.unit,
                lr.reference_range,
                lr.abnormal_flag
            FROM lab_orders lo
            LEFT JOIN lab_tests lt ON lo.lab_test_id = lt.lab_test_id
            LEFT JOIN lab_results lr ON lo.lab_order_id = lr.lab_order_id
            WHERE lo.admission_id = %s
            ORDER BY lo.lab_order_id ASC
        """, (admission_id,))
        lab_items = serialize_rows(cur, cur.fetchall())
        
        gross = float(billing_info.get("bill_gross_amount") or 0.0)
        net = float(billing_info.get("bill_net_amount") or gross)
        pat_amt = float(billing_info.get("bill_patient_portion") or billing_info.get("outstanding_balance") or net)
        ins_amt = float(billing_info.get("bill_insurance_portion") or 0.0)
        
        bill_obj = {
            "bill_id": admission_id,
            "bill_number": billing_info.get("bill_number") or f"MER-BIL-{str(admission_id).zfill(7)}",
            "bill_date": adm_data.get("admission_date"),
            "patient_id": adm_data.get("patient_id"),
            "admission_id": admission_id,
            "gross_amount": gross,
            "discount_amount": float(billing_info.get("bill_discount_amount") or 0.0),
            "tax_amount": float(billing_info.get("bill_tax_amount") or 0.0),
            "net_amount": net,
            "insurance_amount": ins_amt,
            "patient_amount": pat_amt,
            "bill_status": billing_info.get("bill_status") or "Pending",
            "patient_name": p_name,
            "uhid": adm_data.get("patient_code") or f"MER-PAT-{str(adm_data.get('patient_id') or 0).zfill(7)}",
            "phone": adm_data.get("phone") or "—",
            "gender": adm_data.get("gender") or "—",
            "blood_group": adm_data.get("blood_group") or "—",
            "admission_number": adm_data.get("admission_number"),
            "admission_date": adm_data.get("admission_date"),
            "discharge_date": adm_data.get("discharge_date"),
            "items": [],
            "pharmacy_items": pharmacy_items,
            "lab_items": lab_items,
            "payments": [],
            "claims": []
        }
        return {"success": True, "bill": bill_obj}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bill for admission {admission_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/bills/patient/{patient_id}")
def get_bill_by_patient(patient_id: int):
    """
    Get latest bill details for a specific patient.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT bill_id FROM bills WHERE patient_id = %s ORDER BY bill_id DESC LIMIT 1", (patient_id,))
        row = cur.fetchone()
        if row and row[0]:
            conn.close()
            return get_bill_detail(row[0])
            
        cur.execute("SELECT admission_id FROM admissions WHERE patient_id = %s ORDER BY admission_id DESC LIMIT 1", (patient_id,))
        adm_row = cur.fetchone()
        if adm_row and adm_row[0]:
            conn.close()
            return get_bill_by_admission(adm_row[0])
            
        raise HTTPException(status_code=404, detail="No billing record found for this patient")
    finally:
        conn.close()


@router.get("/bills/{bill_id}")
def get_bill_detail(bill_id: int):
    """
    Get deep details of a specific bill:
    - Master bill metadata & amounts
    - Patient identity and demographics
    - Encounter & admission details
    - Itemized breakdown from bill_items (Room, Procedures, Consultations)
    - Linked pharmacy sales items (Medications, Dispensed Drugs)
    - Linked laboratory investigations & test charges
    - Associated payments and transaction logs
    - Linked insurance claims (if any)
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 1. Master Bill Details
        cur.execute("""
            SELECT 
                b.bill_id,
                b.bill_number,
                b.bill_date,
                b.patient_id,
                b.admission_id,
                b.visit_id,
                b.gross_amount,
                b.discount_amount,
                b.tax_amount,
                b.net_amount,
                b.insurance_amount,
                b.patient_amount,
                b.bill_status,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone,
                p.email,
                p.address,
                p.blood_group,
                p.gender,
                p.date_of_birth,
                a.admission_number,
                a.admission_date,
                a.discharge_date,
                a.admission_type,
                a.reason_for_admission,
                a.discharge_status
            FROM bills b
            LEFT JOIN patients p ON b.patient_id = p.id
            LEFT JOIN admissions a ON b.admission_id = a.admission_id
            WHERE b.bill_id = %s
        """, (bill_id,))
        
        bill_row = cur.fetchone()
        if not bill_row:
            raise HTTPException(status_code=404, detail="Bill not found")
        bill_meta = serialize_row(cur, bill_row)
        
        admission_id = bill_meta.get("admission_id")
        patient_id = bill_meta.get("patient_id")
        
        # 2. Bill Items Breakdown
        cur.execute("""
            SELECT 
                bi.bill_item_id,
                bi.bill_id,
                bi.billing_service_id,
                bi.department_id,
                bi.doctor_id,
                bi.service_date,
                bi.description,
                bi.quantity,
                bi.unit_price,
                bi.gross_amount,
                bi.discount_amount,
                bi.tax_amount,
                bi.net_amount,
                bi.reference_type,
                bs.service_code,
                bs.service_name,
                bs.service_category
            FROM bill_items bi
            LEFT JOIN billing_services bs ON bi.billing_service_id = bs.billing_service_id
            WHERE bi.bill_id = %s
            ORDER BY bi.bill_item_id ASC
        """, (bill_id,))
        items = serialize_rows(cur, cur.fetchall())
        
        # 3. Linked Pharmacy Items
        pharmacy_items = []
        if admission_id:
            cur.execute("""
                SELECT 
                    psi.sale_item_id,
                    psi.sale_id,
                    COALESCE(m.medication_name, 'Prescribed Medication') as item_name,
                    m.generic_name,
                    m.category,
                    psi.quantity,
                    psi.unit_price,
                    psi.discount_amount,
                    psi.tax_amount,
                    psi.net_amount,
                    ps.sale_date,
                    ps.payment_status
                FROM pharmacy_sales ps
                JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
                LEFT JOIN medications m ON psi.medication_id = m.medication_id
                WHERE ps.admission_id = %s
                ORDER BY psi.sale_item_id ASC
            """, (admission_id,))
            pharmacy_items = serialize_rows(cur, cur.fetchall())
        elif patient_id:
            cur.execute("""
                SELECT 
                    psi.sale_item_id,
                    psi.sale_id,
                    COALESCE(m.medication_name, 'Prescribed Medication') as item_name,
                    m.generic_name,
                    m.category,
                    psi.quantity,
                    psi.unit_price,
                    psi.discount_amount,
                    psi.tax_amount,
                    psi.net_amount,
                    ps.sale_date,
                    ps.payment_status
                FROM pharmacy_sales ps
                JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
                LEFT JOIN medications m ON psi.medication_id = m.medication_id
                WHERE ps.patient_id = %s AND ps.admission_id IS NULL
                ORDER BY psi.sale_item_id ASC
            """, (patient_id,))
            pharmacy_items = serialize_rows(cur, cur.fetchall())
            
        # 4. Linked Lab Investigation Orders & Tests
        lab_items = []
        if admission_id:
            cur.execute("""
                SELECT 
                    lo.lab_order_id,
                    lo.ordered_date,
                    lo.priority,
                    lo.status as order_status,
                    COALESCE(lt.test_name, 'Diagnostic Test') as item_name,
                    lt.test_category,
                    COALESCE(lt.standard_charge, 0.0) as unit_price,
                    1 as quantity,
                    COALESCE(lt.standard_charge, 0.0) as net_amount,
                    lr.test_parameter,
                    lr.result_value,
                    lr.unit,
                    lr.reference_range,
                    lr.abnormal_flag
                FROM lab_orders lo
                LEFT JOIN lab_tests lt ON lo.lab_test_id = lt.lab_test_id
                LEFT JOIN lab_results lr ON lo.lab_order_id = lr.lab_order_id
                WHERE lo.admission_id = %s
                ORDER BY lo.lab_order_id ASC
            """, (admission_id,))
            lab_items = serialize_rows(cur, cur.fetchall())
        elif patient_id:
            cur.execute("""
                SELECT 
                    lo.lab_order_id,
                    lo.ordered_date,
                    lo.priority,
                    lo.status as order_status,
                    COALESCE(lt.test_name, 'Diagnostic Test') as item_name,
                    lt.test_category,
                    COALESCE(lt.standard_charge, 0.0) as unit_price,
                    1 as quantity,
                    COALESCE(lt.standard_charge, 0.0) as net_amount,
                    lr.test_parameter,
                    lr.result_value,
                    lr.unit,
                    lr.reference_range,
                    lr.abnormal_flag
                FROM lab_orders lo
                LEFT JOIN lab_tests lt ON lo.lab_test_id = lt.lab_test_id
                LEFT JOIN lab_results lr ON lo.lab_order_id = lr.lab_order_id
                WHERE lo.patient_id = %s AND lo.admission_id IS NULL
                ORDER BY lo.lab_order_id ASC
            """, (patient_id,))
            lab_items = serialize_rows(cur, cur.fetchall())
        
        # 5. Payments
        cur.execute("""
            SELECT 
                id as payment_id,
                bill_id,
                patient_id,
                amount,
                payment_method,
                payment_status,
                payer_type,
                payment_reference,
                transaction_reference,
                payment_date,
                created_at
            FROM payments
            WHERE bill_id = %s
            ORDER BY id DESC
        """, (bill_id,))
        payments = serialize_rows(cur, cur.fetchall())
        
        # 6. Insurance Claims on this Bill or Patient
        cur.execute("""
            SELECT 
                claim_id,
                claim_number,
                patient_id,
                bill_id,
                insurance_provider,
                policy_number,
                claim_date,
                claimed_amount,
                approved_amount,
                rejected_amount,
                settled_amount,
                outstanding_amount,
                claim_status,
                rejection_reason,
                settlement_date
            FROM insurance_claims
            WHERE bill_id = %s OR (patient_id = %s AND patient_id IS NOT NULL)
            ORDER BY claim_id DESC
        """, (bill_id, bill_meta.get("patient_id")))
        claims = serialize_rows(cur, cur.fetchall())
        
        p_name = f"{bill_meta.get('first_name') or ''} {bill_meta.get('last_name') or ''}".strip() or "Walk-in Patient"
        
        return {
            "success": True,
            "bill": {
                **bill_meta,
                "patient_name": p_name,
                "uhid": bill_meta.get("patient_code") or f"MER-PAT-{str(bill_meta.get('patient_id') or 0).zfill(7)}",
                "items": items,
                "pharmacy_items": pharmacy_items,
                "lab_items": lab_items,
                "payments": payments,
                "claims": claims
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bill detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/insurance-claims")
def get_insurance_claims(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """
    Get paginated insurance claims with provider breakdowns, policy numbers, and claimed/approved amounts.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        where_clauses = ["1=1"]
        params = []
        
        if status and status.lower() != "all":
            where_clauses.append("LOWER(c.claim_status) = LOWER(%s)")
            params.append(status)
            
        if provider and provider.lower() != "all":
            where_clauses.append("c.insurance_provider ILIKE %s")
            params.append(f"%{provider}%")
            
        if search and search.strip():
            st = f"%{search.strip()}%"
            where_clauses.append("""
                (c.claim_number ILIKE %s OR 
                 c.policy_number ILIKE %s OR 
                 c.insurance_provider ILIKE %s OR 
                 p.first_name ILIKE %s OR 
                 p.last_name ILIKE %s OR 
                 p.patient_code ILIKE %s)
            """)
            params.extend([st, st, st, st, st, st])
            
        where_sql = " AND ".join(where_clauses)
        
        # Count total
        cur.execute(f"""
            SELECT COUNT(*) 
            FROM insurance_claims c
            LEFT JOIN patients p ON c.patient_id = p.id
            WHERE {where_sql}
        """, tuple(params))
        total_count = cur.fetchone()[0]
        
        offset = (page - 1) * page_size
        
        query_sql = f"""
            SELECT 
                c.claim_id,
                c.claim_number,
                c.patient_id,
                c.bill_id,
                c.insurance_provider,
                c.policy_number,
                c.claim_date,
                c.claimed_amount,
                c.approved_amount,
                c.rejected_amount,
                c.settled_amount,
                c.outstanding_amount,
                c.claim_status,
                c.rejection_reason,
                c.settlement_date,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone as patient_phone,
                b.bill_number,
                b.net_amount as bill_total
            FROM insurance_claims c
            LEFT JOIN patients p ON c.patient_id = p.id
            LEFT JOIN bills b ON c.bill_id = b.bill_id
            WHERE {where_sql}
            ORDER BY c.claim_id DESC
            LIMIT %s OFFSET %s
        """
        cur.execute(query_sql, tuple(params + [page_size, offset]))
        rows = serialize_rows(cur, cur.fetchall())
        
        formatted = []
        for r in rows:
            p_name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip() or "Enrolled Beneficiary"
            tat = "2.4 hrs" if r.get("claim_status") == "Settled Cashless" else "1.8 hrs" if r.get("claim_status") == "Partially Approved" else "3.2 hrs"
            formatted.append({
                "claim": r["claim_number"],
                "claim_id": r["claim_id"],
                "patient": p_name,
                "uhid": r.get("patient_code") or f"MER-PAT-{str(r['patient_id'] or 0).zfill(7)}",
                "tpa": r.get("insurance_provider") or "Star Health Insurance",
                "policy": r.get("policy_number") or "POL-DIRECT",
                "sumInsured": 500000.0,
                "initialAuth": r.get("approved_amount") or 0.0,
                "finalClaimed": r.get("claimed_amount") or 0.0,
                "approved": r.get("approved_amount") or 0.0,
                "rejected": r.get("rejected_amount") or 0.0,
                "settled": r.get("settled_amount") or 0.0,
                "status": r.get("claim_status") or "Under Review",
                "rejectionReason": r.get("rejection_reason") or None,
                "turnaround": tat,
                "claim_date": r.get("claim_date"),
                "settlement_date": r.get("settlement_date"),
                "bill_number": r.get("bill_number")
            })
            
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        
        return {
            "success": True,
            "items": formatted,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    except Exception as e:
        logger.error(f"Error fetching claims: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/claims-analytics")
def get_claims_analytics():
    """
    Get aggregated claims analytics: provider shares, approval ratios, and disallowances.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Provider breakdown
        cur.execute("""
            SELECT 
                COALESCE(insurance_provider, 'Other') as provider,
                COUNT(*) as claim_count,
                COALESCE(SUM(claimed_amount), 0) as total_claimed,
                COALESCE(SUM(approved_amount), 0) as total_approved,
                COALESCE(SUM(rejected_amount), 0) as total_rejected
            FROM insurance_claims
            GROUP BY insurance_provider
            ORDER BY total_claimed DESC
            LIMIT 10
        """)
        providers = serialize_rows(cur, cur.fetchall())
        
        # Status distribution
        cur.execute("""
            SELECT 
                claim_status,
                COUNT(*) as count,
                COALESCE(SUM(claimed_amount), 0) as amount
            FROM insurance_claims
            GROUP BY claim_status
        """)
        status_dist = serialize_rows(cur, cur.fetchall())
        
        # Rejection reasons summary
        cur.execute("""
            SELECT 
                COALESCE(rejection_reason, 'Documentation Incomplete') as reason,
                COUNT(*) as count,
                COALESCE(SUM(rejected_amount), 0) as disallowance_amount
            FROM insurance_claims
            WHERE rejected_amount > 0 AND rejection_reason IS NOT NULL
            GROUP BY rejection_reason
            ORDER BY count DESC
            LIMIT 5
        """)
        rejections = serialize_rows(cur, cur.fetchall())
        
        return {
            "success": True,
            "providers": providers,
            "status_distribution": status_dist,
            "rejections": rejections
        }
    except Exception as e:
        logger.error(f"Error fetching claims analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/dashboard")
def get_finance_dashboard():
    """
    Executive Finance Dashboard data:
    - Daily / Monthly revenue aggregations
    - Payment channel distribution (UPI, Netbanking, Cash, Cards)
    - Departmental service charges breakdown
    - AR Aging analysis (0-30, 31-60, 61-90, 90+ days)
    - Recent live payment collections
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # 1. Payment modes breakdown
        cur.execute("""
            SELECT 
                COALESCE(payment_method, 'UNKNOWN') as mode,
                payment_status,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM payments
            WHERE payment_status = 'SUCCESS'
            GROUP BY payment_method, payment_status
            ORDER BY total_amount DESC
        """)
        raw_modes = serialize_rows(cur, cur.fetchall())
        total_mode_amt = sum(float(m.get("total_amount") or 0) for m in raw_modes) or 1.0
        payment_modes = []
        for m in raw_modes:
            amt = float(m.get("total_amount") or 0)
            pct = round((amt / total_mode_amt) * 100, 1)
            payment_modes.append({
                **m,
                "percentage": pct,
                "pct_str": f"{pct}%"
            })
        
        # 2. Service category breakdown from billing_services
        cur.execute("""
            SELECT 
                bs.service_category,
                COUNT(bi.bill_item_id) as items_billed,
                COALESCE(SUM(bi.gross_amount), 0) as gross_billed,
                COALESCE(SUM(bi.tax_amount), 0) as tax_collected,
                COALESCE(SUM(bi.net_amount), 0) as net_revenue
            FROM billing_services bs
            LEFT JOIN bill_items bi ON bs.billing_service_id = bi.billing_service_id
            GROUP BY bs.service_category
            ORDER BY net_revenue DESC
        """)
        categories = serialize_rows(cur, cur.fetchall())
        
        # 3. Clinical Specialty / Departmental Revenue Breakdown
        cur.execute("""
            SELECT 
                COALESCE(dai.doctor_specialization, d.department_name, 'General Medicine') as department,
                COUNT(b.bill_id) as bills_count,
                COALESCE(SUM(b.net_amount), 0) as revenue
            FROM bills b
            LEFT JOIN dim_admission_inputs dai ON b.admission_id = dai.admission_id OR b.patient_id = dai.patient_id
            LEFT JOIN admissions a ON b.admission_id = a.admission_id
            LEFT JOIN departments d ON a.department_id = d.id
            GROUP BY COALESCE(dai.doctor_specialization, d.department_name, 'General Medicine')
            ORDER BY revenue DESC
            LIMIT 10
        """)
        dept_revenue = serialize_rows(cur, cur.fetchall())
        
        # 4. AR Aging Analysis
        cur.execute("""
            SELECT 
                COALESCE(SUM(CASE WHEN CURRENT_DATE - b.bill_date::date <= 30 THEN b.patient_amount ELSE 0 END), 0) as aging_0_30,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - b.bill_date::date BETWEEN 31 AND 60 THEN b.patient_amount ELSE 0 END), 0) as aging_31_60,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - b.bill_date::date BETWEEN 61 AND 90 THEN b.patient_amount ELSE 0 END), 0) as aging_61_90,
                COALESCE(SUM(CASE WHEN CURRENT_DATE - b.bill_date::date > 90 THEN b.patient_amount ELSE 0 END), 0) as aging_90_plus,
                COALESCE(SUM(b.patient_amount), 0) as total_ar_outstanding
            FROM bills b
            WHERE b.bill_status != 'Settled'
        """)
        ar_aging = serialize_row(cur, cur.fetchone())
        
        # 5. Recent Live Payments
        cur.execute("""
            SELECT 
                py.id as payment_id,
                py.bill_id,
                py.patient_id,
                py.amount,
                py.payment_method,
                py.payment_status,
                py.payment_reference,
                py.payment_date,
                b.bill_number,
                COALESCE(CONCAT(p.first_name, ' ', p.last_name), CONCAT(dai.first_name, ' ', dai.last_name), 'Patient') as patient_name
            FROM payments py
            LEFT JOIN bills b ON py.bill_id = b.bill_id
            LEFT JOIN patients p ON py.patient_id = p.id
            LEFT JOIN dim_admission_inputs dai ON py.patient_id = dai.patient_id
            ORDER BY py.payment_date DESC, py.id DESC
            LIMIT 25
        """)
        recent_payments = serialize_rows(cur, cur.fetchall())
        
        # 6. Monthly billing trend (last 12 months)
        cur.execute("""
            SELECT 
                TO_CHAR(bill_date, 'YYYY-MM') as month,
                COUNT(*) as bills_count,
                COALESCE(SUM(net_amount), 0) as total_net,
                COALESCE(SUM(patient_amount), 0) as patient_collections,
                COALESCE(SUM(insurance_amount), 0) as insurance_settlements
            FROM bills
            WHERE bill_date IS NOT NULL
            GROUP BY TO_CHAR(bill_date, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 12
        """)
        monthly_trend = serialize_rows(cur, cur.fetchall())
        monthly_trend.reverse()
        
        # 7. Summary KPIs
        cur.execute("""
            SELECT 
                COALESCE(SUM(net_amount), 0) as total_billed,
                COALESCE(SUM(CASE WHEN bill_status = 'Settled' THEN net_amount ELSE 0 END), 0) as total_settled,
                COALESCE(SUM(patient_amount), 0) as total_patient_due,
                COALESCE(SUM(insurance_amount), 0) as total_insurance_due,
                COUNT(*) as total_invoices,
                COUNT(CASE WHEN bill_status = 'Settled' THEN 1 END) as settled_invoices,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_status = 'SUCCESS') as total_collected
            FROM bills
        """)
        kpi_row = serialize_row(cur, cur.fetchone())
        
        return {
            "success": True,
            "payment_modes": payment_modes,
            "category_breakdown": categories,
            "dept_revenue": dept_revenue,
            "ar_aging": ar_aging,
            "recent_payments": recent_payments,
            "monthly_trend": monthly_trend,
            "kpis": kpi_row
        }
    except Exception as e:
        logger.error(f"Error fetching finance dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/tax-config")
def get_tax_config():
    """
    Get billing services tariff catalog with applicable GST/tax rates and HSN codes.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                bs.billing_service_id,
                bs.service_code,
                bs.service_name,
                bs.service_category,
                bs.standard_charge,
                bs.status,
                d.department_name
            FROM billing_services bs
            LEFT JOIN departments d ON bs.department_id = d.id
            ORDER BY bs.billing_service_id ASC
        """)
        services = serialize_rows(cur, cur.fetchall())
        
        tax_slabs = [
            {"category": "Clinical Consultation", "hsn": "999312", "gst_rate": 0.0, "desc": "Exempted under Healthcare Services Notification", "status": "Active"},
            {"category": "Inpatient Room Charges (< ₹5,000/day)", "hsn": "999311", "gst_rate": 0.0, "desc": "Standard general ward beds exempted", "status": "Active"},
            {"category": "Inpatient Luxury Room (> ₹5,000/day)", "hsn": "999311", "gst_rate": 5.0, "desc": "GST applicable on non-ICU room rent exceeding ₹5,000", "status": "Active"},
            {"category": "Diagnostic & Lab Tests", "hsn": "999314", "gst_rate": 0.0, "desc": "Pathology and radiology diagnostics exempted", "status": "Active"},
            {"category": "Pharmacy Life-Saving Drugs", "hsn": "3004", "gst_rate": 5.0, "desc": "Formulations, insulin, oncological medications", "status": "Active"},
            {"category": "Pharmacy General Formulations", "hsn": "3004", "gst_rate": 12.0, "desc": "Standard branded formulations and antibiotics", "status": "Active"},
            {"category": "Dietary & Canteen (Inpatients)", "hsn": "996331", "gst_rate": 0.0, "desc": "Prescribed hospital patient food served in-ward", "status": "Active"},
            {"category": "Dietary & Canteen (Visitors)", "hsn": "996331", "gst_rate": 5.0, "desc": "Hospital cafeteria services for visitors/attendants", "status": "Active"},
        ]
        
        return {
            "success": True,
            "services": services,
            "tax_slabs": tax_slabs
        }
    except Exception as e:
        logger.error(f"Error fetching tax config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/bills/{bill_id}/gate-pass")
def issue_discharge_gate_pass(bill_id: int):
    """
    Issue official discharge financial clearance gate pass for an inpatient.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT b.bill_id, b.bill_number, b.patient_amount, b.bill_status, p.first_name, p.last_name, p.patient_code
            FROM bills b
            LEFT JOIN patients p ON b.patient_id = p.id
            WHERE b.bill_id = %s
        """, (bill_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bill not found")
        
        p_name = f"{row[4] or ''} {row[5] or ''}".strip() or "Patient"
        uhid = row[6] or f"MER-PAT-{str(bill_id).zfill(6)}"
        pass_code = f"GP-2026-{uuid.uuid4().hex[:6].upper()}"
        
        cur.execute("""
            UPDATE bills 
            SET bill_status = 'Settled'
            WHERE bill_id = %s
        """, (bill_id,))
        conn.commit()
        
        return {
            "success": True,
            "message": f"Financial Clearance Gate Pass issued successfully for {p_name}",
            "gate_pass_code": pass_code,
            "issued_at": datetime.now().isoformat(),
            "patient": p_name,
            "uhid": uhid,
            "bill_number": row[1],
            "status": "CLEARED & AUTHORIZED"
        }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error issuing gate pass: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/payments")
def record_payment(
    bill_id: int = Body(...),
    patient_id: Optional[int] = Body(None),
    amount: float = Body(...),
    payment_method: str = Body("UPI"),
    payment_reference: Optional[str] = Body(None)
):
    """
    Record a dynamic patient co-pay or settlement payment against a bill.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        ref = payment_reference or f"TXN-{uuid.uuid4().hex[:8].upper()}"
        txn_ref = f"REF-{uuid.uuid4().hex[:10].upper()}"
        now_dt = datetime.now()
        
        cur.execute("""
            INSERT INTO payments (
                bill_id, patient_id, amount, payment_method, 
                payment_status, payer_type, payment_reference, 
                transaction_reference, payment_date, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, 
                'SUCCESS', 'PATIENT', %s, 
                %s, %s, %s, %s
            ) RETURNING id
        """, (
            bill_id, patient_id, amount, payment_method.upper(),
            ref, txn_ref, now_dt, now_dt, now_dt
        ))
        payment_id = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM payments 
            WHERE bill_id = %s AND payment_status = 'SUCCESS'
        """, (bill_id,))
        total_paid = float(cur.fetchone()[0] or 0)
        
        cur.execute("SELECT patient_amount, net_amount FROM bills WHERE bill_id = %s", (bill_id,))
        b_row = cur.fetchone()
        if b_row:
            p_due = float(b_row[0] or 0)
            if total_paid >= p_due and p_due > 0:
                cur.execute("UPDATE bills SET bill_status = 'Settled' WHERE bill_id = %s", (bill_id,))
            else:
                cur.execute("UPDATE bills SET bill_status = 'Partially Paid' WHERE bill_id = %s", (bill_id,))
                
        conn.commit()
        
        return {
            "success": True,
            "payment_id": payment_id,
            "bill_id": bill_id,
            "amount": amount,
            "payment_method": payment_method,
            "transaction_reference": txn_ref,
            "payment_reference": ref,
            "status": "SUCCESS",
            "recorded_at": now_dt.isoformat()
        }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error recording payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/clear-bill", summary="Clear Patient Bill & Grant Financial Clearance")
def finance_clear_bill(
    patient_id: Optional[Any] = Body(None),
    admission_id: Optional[Any] = Body(None),
    bill_number: Optional[str] = Body(None),
    amount: Optional[float] = Body(None),
    payment_method: str = Body("UPI"),
    remarks: Optional[str] = Body("Cleared via Finance Portal")
):
    """
    Clears / settles the outstanding balance for a patient, admission, or bill.
    Updates dim_admission_inputs, bills, and payments in PostgreSQL.
    """
    from routers.discharge_agent import clear_patient_bill_internal
    return clear_patient_bill_internal(
        patient_id=patient_id,
        admission_id=admission_id,
        bill_number=bill_number,
        amount=amount,
        payment_method=payment_method,
        remarks=remarks
    )


@router.post("/bills/{bill_id}/clear", summary="Clear Bill by Bill ID")
def finance_clear_bill_by_id(
    bill_id: int,
    payment_method: str = Query("UPI"),
    amount: Optional[float] = Query(None)
):
    """
    Clears / settles a specific bill by bill_id.
    """
    from routers.discharge_agent import clear_patient_bill_internal
    return clear_patient_bill_internal(
        bill_id=bill_id,
        amount=amount,
        payment_method=payment_method
    )


@router.post("/patients/{patient_id}/clear-bill", summary="Clear Bill by Patient ID")
def finance_clear_bill_by_patient_id(
    patient_id: str,
    payment_method: str = Query("UPI"),
    amount: Optional[float] = Query(None)
):
    """
    Clears / settles all outstanding bills for a patient by patient_id.
    """
    from routers.discharge_agent import clear_patient_bill_internal
    return clear_patient_bill_internal(
        patient_id=patient_id,
        amount=amount,
        payment_method=payment_method
    )

