import os
import sys
import json
import random
import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import db_config

class PaymentError(Exception):
    def __init__(self, message: str, error_code: str = "PAYMENT_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code

def _get_conn():
    return db_config.get_db_connection()

def process_mock_payment(
    patient_id: int,
    amount: float,
    payment_method: str = "GPAY",
    payment_context: str = "APPOINTMENT_PAYMENT",
    appointment_id: Optional[int] = None,
    bill_id: Optional[int] = None,
    payment_reference: Optional[str] = None,
    transaction_reference: Optional[str] = None,
    payer_type: str = "PATIENT",
    conversation_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes and persists a mock payment atomically into the PostgreSQL database.
    Source of truth: `payments` table.
    """
    if amount <= 0:
        raise PaymentError("Payment amount must be greater than zero.", "INVALID_AMOUNT")

    conn = _get_conn()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Validate patient existence
        cur.execute("SELECT id, first_name, last_name, patient_code FROM patients WHERE id = %s;", (patient_id,))
        pat_row = cur.fetchone()
        if not pat_row:
            raise PaymentError(f"Patient with ID {patient_id} does not exist.", "PATIENT_NOT_FOUND")

        pat_name = f"{pat_row[0]} {pat_row[1] or ''}".strip()
        pat_code = pat_row[2]

        # 2. Context ownership & validation
        if payment_context in ["APPOINTMENT_PAYMENT", "APPOINTMENT_BALANCE_PAYMENT"]:
            if appointment_id:
                cur.execute("SELECT patient_id, status FROM appointments WHERE id = %s;", (appointment_id,))
                appt_row = cur.fetchone()
                if not appt_row:
                    raise PaymentError(f"Appointment ID {appointment_id} not found.", "APPOINTMENT_NOT_FOUND")
                if appt_row[0] != patient_id:
                    raise PaymentError(f"Appointment ID {appointment_id} does not belong to Patient ID {patient_id}.", "OWNERSHIP_MISMATCH")

        elif payment_context == "BILL_PAYMENT":
            if bill_id:
                cur.execute("SELECT patient_id, net_amount, bill_status FROM bills WHERE bill_id = %s;", (bill_id,))
                bill_row = cur.fetchone()
                if not bill_row:
                    raise PaymentError(f"Bill ID {bill_id} not found.", "BILL_NOT_FOUND")
                if bill_row[0] != patient_id:
                    raise PaymentError(f"Bill ID {bill_id} does not belong to Patient ID {patient_id}.", "OWNERSHIP_MISMATCH")

        # 3. Canonical Payment Method mapping
        method_clean = payment_method.strip().upper()
        if method_clean in ["GOOGLE PAY", "GOOGLE_PAY"]:
            method_clean = "GPAY"
        elif method_clean in ["PHONE PE", "PHONE_PE"]:
            method_clean = "PHONEPE"
        elif method_clean in ["NET BANKING", "NET_BANKING"]:
            method_clean = "NETBANKING"

        # 4. Generate reference & transaction ID if missing
        if not payment_reference:
            prefix = "PAYBILL" if payment_context == "BILL_PAYMENT" else ("PAYBAL" if payment_context == "APPOINTMENT_BALANCE_PAYMENT" else "PAY")
            now_str = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            rand_suffix = random.randint(1000, 9999)
            payment_reference = f"{prefix}{now_str}{rand_suffix}"

        if not transaction_reference:
            transaction_reference = f"MOCKTXN{random.randint(100000, 999999)}"

        # 5. Idempotency Check: if payment with payment_reference already SUCCESS, return it
        cur.execute("SELECT id, payment_reference, transaction_reference, payment_status FROM payments WHERE payment_reference = %s;", (payment_reference,))
        existing_pay = cur.fetchone()
        if existing_pay and existing_pay[3] == 'SUCCESS':
            conn.rollback()
            return {
                "success": True,
                "payment_id": existing_pay[0],
                "payment_reference": existing_pay[1],
                "transaction_reference": existing_pay[2],
                "amount": float(amount),
                "payment_status": "SUCCESS",
                "message": "Payment already processed (idempotent)."
            }

        # 6. Insert / Update payment record
        if existing_pay:
            payment_id = existing_pay[0]
            cur.execute("""
                UPDATE payments
                SET amount = %s,
                    payment_method = %s,
                    payment_status = 'SUCCESS',
                    transaction_reference = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (amount, method_clean, transaction_reference, payment_id))
        else:
            cur.execute("""
                INSERT INTO payments (
                    payment_reference, patient_id, appointment_id, bill_id,
                    amount, currency, payment_method, payment_status,
                    transaction_reference, payment_date, payer_type, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, 'INR', %s, 'SUCCESS', %s, CURRENT_TIMESTAMP, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;
            """, (payment_reference, patient_id, appointment_id, bill_id, amount, method_clean, transaction_reference, payer_type))
            payment_id = cur.fetchone()[0]

        # 7. Update Bill Status if BILL_PAYMENT
        if bill_id:
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE bill_id = %s AND payment_status = 'SUCCESS';
            """, (bill_id,))
            total_paid_row = cur.fetchone()
            total_paid = float(total_paid_row[0]) if total_paid_row else 0.0

            cur.execute("SELECT net_amount FROM bills WHERE bill_id = %s;", (bill_id,))
            b_row = cur.fetchone()
            b_net = float(b_row[0]) if b_row else 0.0

            new_bill_status = 'Settled' if total_paid >= b_net else ('Partially Paid' if total_paid > 0 else 'Pending')
            cur.execute("UPDATE bills SET bill_status = %s WHERE bill_id = %s;", (new_bill_status, bill_id))

        # 8. Log Audit Record
        audit_payload = {
            "payment_id": payment_id,
            "payment_reference": payment_reference,
            "patient_id": patient_id,
            "appointment_id": appointment_id,
            "bill_id": bill_id,
            "amount": float(amount),
            "payment_method": method_clean,
            "transaction_reference": transaction_reference
        }
        cur.execute("""
            INSERT INTO audit_logs (action, entity_type, entity_id, new_values, reason)
            VALUES ('PROCESS_MOCK_PAYMENT', 'payments', %s, %s, 'Mock payment succeeded');
        """, (payment_id, json.dumps(audit_payload)))

        if conversation_code:
            cur.execute("""
                INSERT INTO agent_action_logs (conversation_id, patient_id, action_name, intent, input_data, output_data, status)
                VALUES (
                    COALESCE((SELECT id FROM conversations WHERE conversation_code = %s LIMIT 1), 1),
                    %s, 'PROCESS_MOCK_PAYMENT', %s, %s, %s, 'SUCCESS'
                );
            """, (conversation_code, patient_id, payment_context, json.dumps(audit_payload), json.dumps({"payment_id": payment_id, "status": "SUCCESS"})))

        conn.commit()

        return {
            "success": True,
            "payment_id": payment_id,
            "payment_reference": payment_reference,
            "transaction_reference": transaction_reference,
            "patient_id": patient_id,
            "appointment_id": appointment_id,
            "bill_id": bill_id,
            "amount": float(amount),
            "payment_method": method_clean,
            "payment_status": "SUCCESS",
            "patient_name": pat_name,
            "patient_code": pat_code
        }

    except Exception as e:
        conn.rollback()
        if isinstance(e, PaymentError):
            raise e
        print(f"[PROCESS_MOCK_PAYMENT_ERR] {e}")
        raise PaymentError(f"Database error during payment processing: {str(e)}", "DATABASE_ERROR")
    finally:
        cur.close()
        conn.close()


def process_mock_refund(
    patient_id: int,
    refund_amount: float,
    refund_reason: str,
    original_payment_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    bill_id: Optional[int] = None,
    payment_method: str = "MOCK_REFUND",
    approved_by: Optional[int] = None,
    conversation_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes and persists a mock refund atomically into the PostgreSQL database.
    Creates row in `refunds` table, links to `payments.id`, updates original payment status,
    and prevents duplicate or over-refunds.
    """
    if refund_amount <= 0:
        raise PaymentError("Refund amount must be greater than zero.", "INVALID_REFUND_AMOUNT")

    if not refund_reason or not refund_reason.strip():
        raise PaymentError("A valid refund reason is required.", "REFUND_REASON_REQUIRED")

    conn = _get_conn()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Locate original payment record
        orig_payment = None
        if original_payment_id:
            cur.execute("SELECT id, payment_reference, patient_id, appointment_id, bill_id, amount, payment_method, payment_status FROM payments WHERE id = %s FOR UPDATE;", (original_payment_id,))
            orig_payment = cur.fetchone()
        elif appointment_id:
            cur.execute("SELECT id, payment_reference, patient_id, appointment_id, bill_id, amount, payment_method, payment_status FROM payments WHERE appointment_id = %s AND payment_status IN ('SUCCESS', 'PARTIALLY_REFUNDED') ORDER BY id DESC LIMIT 1 FOR UPDATE;", (appointment_id,))
            orig_payment = cur.fetchone()
        elif bill_id:
            cur.execute("SELECT id, payment_reference, patient_id, appointment_id, bill_id, amount, payment_method, payment_status FROM payments WHERE bill_id = %s AND payment_status IN ('SUCCESS', 'PARTIALLY_REFUNDED') ORDER BY id DESC LIMIT 1 FOR UPDATE;", (bill_id,))
            orig_payment = cur.fetchone()

        if not orig_payment:
            raise PaymentError("No active completed payment record found to refund.", "ORIGINAL_PAYMENT_NOT_FOUND")

        pay_id, pay_ref, pay_pat_id, pay_appt_id, pay_bill_id, orig_amount_dec, orig_method, orig_status = orig_payment
        orig_amount = float(orig_amount_dec)

        # 2. Verify Patient Ownership
        if pay_pat_id and pay_pat_id != patient_id:
            raise PaymentError(f"Original payment patient (ID {pay_pat_id}) does not match requested patient (ID {patient_id}).", "PATIENT_MISMATCH")

        # 3. Calculate Already Refunded Sum & Prevent Duplicate/Over-Refund
        cur.execute("""
            SELECT COALESCE(SUM(refund_amount), 0) FROM refunds
            WHERE payment_id = %s AND status = 'SUCCESS';
        """, (pay_id,))
        already_refunded_sum = float(cur.fetchone()[0])

        remaining_refundable = max(0.0, orig_amount - already_refunded_sum)

        if remaining_refundable <= 0:
            raise PaymentError(f"Payment {pay_ref} has already been fully refunded (Total Refunded: Rs. {already_refunded_sum:.2f}).", "ALREADY_FULLY_REFUNDED")

        if refund_amount > (remaining_refundable + 0.01):
            raise PaymentError(f"Requested refund (Rs. {refund_amount:.2f}) exceeds maximum refundable balance (Rs. {remaining_refundable:.2f}).", "REFUND_EXCEEDS_LIMIT")

        # 4. Generate Unique Refund Reference
        now_str = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        rand_suffix = random.randint(1000, 9999)
        refund_reference = f"REF{now_str}{rand_suffix}"

        target_appt_id = appointment_id or pay_appt_id
        target_bill_id = bill_id or pay_bill_id

        # 5. Insert Record into `refunds` Table
        cur.execute("""
            INSERT INTO refunds (
                refund_reference, payment_id, patient_id, appointment_id, bill_id,
                refund_amount, refund_reason, payment_method, approved_by, status,
                refund_date, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'SUCCESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING refund_id;
        """, (refund_reference, pay_id, patient_id, target_appt_id, target_bill_id, refund_amount, refund_reason.strip(), payment_method, approved_by))
        refund_id = cur.fetchone()[0]

        # 6. Insert Linked Entry in `payments` Table (for backward reporting compatibility)
        cur.execute("""
            INSERT INTO payments (
                payment_reference, patient_id, appointment_id, bill_id,
                amount, currency, payment_method, payment_status,
                transaction_reference, payment_date, payer_type, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, 'INR', %s, 'REFUNDED', %s, CURRENT_TIMESTAMP, 'PATIENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """, (refund_reference, patient_id, target_appt_id, target_bill_id, refund_amount, payment_method, f"REFUND-{pay_ref}"))

        # 7. Update Original Payment Status
        new_total_refunded = already_refunded_sum + refund_amount
        new_payment_status = 'REFUNDED' if new_total_refunded >= (orig_amount - 0.01) else 'PARTIALLY_REFUNDED'

        cur.execute("""
            UPDATE payments
            SET payment_status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (new_payment_status, pay_id))

        # 8. Recalculate Bill Status if Bill Payment
        if target_bill_id:
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE bill_id = %s AND payment_status = 'SUCCESS';
            """, (target_bill_id,))
            net_paid_row = cur.fetchone()
            total_success_paid = float(net_paid_row[0]) if net_paid_row else 0.0

            cur.execute("""
                SELECT COALESCE(SUM(refund_amount), 0) FROM refunds
                WHERE bill_id = %s AND status = 'SUCCESS';
            """, (target_bill_id,))
            total_refunded_bill = float(cur.fetchone()[0])

            net_bill_paid = max(0.0, total_success_paid - total_refunded_bill)

            cur.execute("SELECT net_amount FROM bills WHERE bill_id = %s;", (target_bill_id,))
            b_row = cur.fetchone()
            b_net = float(b_row[0]) if b_row else 0.0

            new_bill_status = 'Settled' if net_bill_paid >= b_net else ('Partially Paid' if net_bill_paid > 0 else 'Pending')
            cur.execute("UPDATE bills SET bill_status = %s WHERE bill_id = %s;", (new_bill_status, target_bill_id))

        # 9. Audit Logging
        audit_payload = {
            "refund_id": refund_id,
            "refund_reference": refund_reference,
            "original_payment_id": pay_id,
            "original_payment_reference": pay_ref,
            "patient_id": patient_id,
            "appointment_id": target_appt_id,
            "bill_id": target_bill_id,
            "refund_amount": float(refund_amount),
            "refund_reason": refund_reason.strip(),
            "new_payment_status": new_payment_status,
            "remaining_refundable": max(0.0, orig_amount - new_total_refunded)
        }

        cur.execute("""
            INSERT INTO audit_logs (action, entity_type, entity_id, new_values, reason)
            VALUES ('PROCESS_MOCK_REFUND', 'refunds', %s, %s, %s);
        """, (refund_id, json.dumps(audit_payload), f"Mock refund processed: {refund_reason.strip()}"))

        if conversation_code:
            cur.execute("""
                INSERT INTO agent_action_logs (conversation_id, patient_id, action_name, intent, input_data, output_data, status)
                VALUES (
                    COALESCE((SELECT id FROM conversations WHERE conversation_code = %s LIMIT 1), 1),
                    %s, 'PROCESS_MOCK_REFUND', 'REFUND', %s, %s, 'SUCCESS'
                );
            """, (conversation_code, patient_id, json.dumps(audit_payload), json.dumps({"refund_id": refund_id, "status": "SUCCESS"})))

        conn.commit()

        return {
            "success": True,
            "refund_id": refund_id,
            "refund_reference": refund_reference,
            "original_payment_id": pay_id,
            "original_payment_reference": pay_ref,
            "patient_id": patient_id,
            "appointment_id": target_appt_id,
            "bill_id": target_bill_id,
            "refund_amount": float(refund_amount),
            "original_amount": orig_amount,
            "net_paid_amount": max(0.0, orig_amount - new_total_refunded),
            "remaining_refundable": max(0.0, orig_amount - new_total_refunded),
            "payment_status": new_payment_status,
            "status": "SUCCESS"
        }

    except Exception as e:
        conn.rollback()
        if isinstance(e, PaymentError):
            raise e
        print(f"[PROCESS_MOCK_REFUND_ERR] {e}")
        raise PaymentError(f"Database error during refund processing: {str(e)}", "DATABASE_ERROR")
    finally:
        cur.close()
        conn.close()
