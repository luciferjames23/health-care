-- Migration 045: Canonical synchronization of appointment payments, bills, and payment links
-- Ensures all appointment payments are linked to canonical outpatient consultation bills
-- Reconciles hospital bills and ensures appropriate indexes

-- 1. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_patient_id ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_appointment_id ON bills(appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_charges_patient_status ON patient_charges(patient_id, billing_status);

-- 2. Synchronize sequences
SELECT setval(pg_get_serial_sequence('bills', 'bill_id'), COALESCE((SELECT MAX(bill_id) FROM bills), 1));
SELECT setval(pg_get_serial_sequence('bill_items', 'bill_item_id'), COALESCE((SELECT MAX(bill_item_id) FROM bill_items), 1));
SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1));

-- 3. Canonical bills for appointments with payments that lack an appointment bill
DO $$
DECLARE
    rec RECORD;
    new_bid INT;
    bill_num VARCHAR(100);
BEGIN
    FOR rec IN
        SELECT a.id AS appt_id, a.booking_id, a.patient_id, a.appointment_date, a.created_at,
               COALESCE(d.display_name, d.first_name || ' ' || d.last_name, 'Doctor') AS doctor_name,
               COALESCE(dp.department_name, 'General Medicine') AS dept_name,
               SUM(p.amount) AS total_paid,
               MAX(p.payment_date) AS latest_pay_date
        FROM appointments a
        JOIN payments p ON p.appointment_id = a.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN departments dp ON a.department_id = dp.id
        LEFT JOIN bills b ON a.id = b.appointment_id
        WHERE b.bill_id IS NULL AND p.payment_status = 'SUCCESS'
        GROUP BY a.id, a.booking_id, a.patient_id, a.appointment_date, a.created_at,
                 d.display_name, d.first_name, d.last_name, dp.department_name
    LOOP
        bill_num := 'INV-2026-' || rec.booking_id;
        
        INSERT INTO bills (
            bill_number, patient_id, appointment_id, bill_date,
            gross_amount, discount_amount, tax_amount, net_amount,
            insurance_amount, patient_amount, bill_status, bill_type, notes
        ) VALUES (
            bill_num, rec.patient_id, rec.appt_id, COALESCE(rec.latest_pay_date, rec.created_at, CURRENT_TIMESTAMP),
            rec.total_paid, 0.0, 0.0, rec.total_paid,
            0.0, rec.total_paid, 'Settled', 'OUTPATIENT', 'Outpatient Consultation Booking (' || rec.booking_id || ')'
        ) RETURNING bill_id INTO new_bid;

        INSERT INTO bill_items (
            bill_id, description, quantity, unit_price,
            gross_amount, discount_amount, tax_amount, net_amount,
            service_date, source_type, source_order_id, source_service_code
        ) VALUES (
            new_bid, 'Specialist Outpatient Consultation - ' || rec.doctor_name || ' (' || rec.dept_name || ')', 1, rec.total_paid,
            rec.total_paid, 0.0, 0.0, rec.total_paid,
            rec.appointment_date, 'APPOINTMENT', rec.booking_id, 'SRV-OPD-CON'
        ) ON CONFLICT DO NOTHING;

        UPDATE payments
        SET bill_id = new_bid
        WHERE appointment_id = rec.appt_id;
    END LOOP;
END $$;

-- 4. Reconcile hospital bills status (where appointment_id IS NULL)
UPDATE bills b
SET bill_status = CASE 
    WHEN (
        SELECT COALESCE(SUM(py.amount), 0)
        FROM payments py
        WHERE py.bill_id = b.bill_id 
          AND py.appointment_id IS NULL 
          AND py.payment_status = 'SUCCESS'
    ) >= b.patient_amount AND b.patient_amount > 0 THEN 'Settled'
    WHEN (
        SELECT COALESCE(SUM(py.amount), 0)
        FROM payments py
        WHERE py.bill_id = b.bill_id 
          AND py.appointment_id IS NULL 
          AND py.payment_status = 'SUCCESS'
    ) > 0 THEN 'Partially Paid'
    ELSE 'Pending'
END
WHERE b.appointment_id IS NULL;
