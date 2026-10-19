"""Transactional price resolution and idempotent charges for clinical orders."""


class ServicePriceNotConfigured(ValueError):
    pass


def resolve_lab_service_code(cur, test_code, test_name):
    code = str(test_code or '').strip().upper()
    name = str(test_name or '').strip().casefold()
    aliases = {'CBC': 'LAB-CBC', 'COMPLETE BLOOD COUNT': 'LAB-CBC',
               'COMPLETE BLOOD COUNT (CBC)': 'LAB-CBC'}
    service_code = aliases.get(code) or aliases.get(name.upper())
    if service_code:
        cur.execute("SELECT 1 FROM service_price_master WHERE service_code=%s AND service_type='LAB' AND active=TRUE",
                    (service_code,))
        if cur.fetchone():
            return service_code
    candidate = code if code.startswith('LAB-') else f'LAB-{code}' if code else None
    if candidate:
        cur.execute("SELECT 1 FROM service_price_master WHERE service_code=%s AND service_type='LAB' AND active=TRUE",
                    (candidate,))
        if cur.fetchone():
            return candidate
    if name:
        cur.execute("""SELECT service_code FROM service_price_master
                      WHERE service_type='LAB' AND active=TRUE AND lower(service_name)=lower(%s)""", (test_name.strip(),))
        matches = cur.fetchall()
        if len(matches) == 1:
            return matches[0]['service_code'] if isinstance(matches[0], dict) else matches[0][0]
    return candidate or f'LAB-{code or name.upper().replace(" ", "-")}'


def _insert_charge(cur, *, patient_id, visit_id, admission_id, source_type,
                   source_order_id, service_code, view, source):
    cur.execute("""SELECT service_name,amount,currency FROM service_price_master
                  WHERE service_code=%s AND active=TRUE""", (service_code,))
    price = cur.fetchone()
    if not price:
        raise ServicePriceNotConfigured(f"Active service price is not configured: {service_code}")
    if isinstance(price, dict):
        name, amount, currency = price['service_name'], price['amount'], price['currency']
    else:
        name, amount, currency = price
    cur.execute("""INSERT INTO patient_charges
        (patient_id,visit_id,admission_id,source_type,source_order_id,service_code,
         service_name,view,amount,currency,billing_status,source)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PENDING',%s)
        ON CONFLICT(source_type,source_order_id,service_code) DO NOTHING""",
        (patient_id, visit_id, admission_id, source_type, str(source_order_id), service_code,
         name, view, amount, currency, source))
    cur.execute("""SELECT billing_status FROM patient_charges
                  WHERE source_type=%s AND source_order_id=%s AND service_code=%s""",
                (source_type, str(source_order_id), service_code))
    saved = cur.fetchone()
    saved_status = saved.get('billing_status') if isinstance(saved, dict) else saved[0] if saved else None
    if saved_status in ('PENDING', 'BILLED'):
        _reconcile_charge_to_bill(cur, patient_id=patient_id, visit_id=visit_id,
                                  admission_id=admission_id, source_type=source_type,
                                  source_order_id=source_order_id, service_code=service_code,
                                  service_name=name, view=view, amount=amount)


def _reconcile_charge_to_bill(cur, *, patient_id, visit_id, admission_id, source_type,
                              source_order_id, service_code, service_name, view, amount):
    """Attach a newly snapshotted order charge to the matching canonical bill."""
    # Serialize first-bill creation for this patient encounter and never attach
    # a charge to another patient's bill.
    encounter_key = admission_id if admission_id is not None else visit_id
    cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))",
                (f"service-bill:{patient_id}:{encounter_key}",))
    cur.execute("""SELECT bill_id, gross_amount, discount_amount, tax_amount, net_amount,
                         insurance_amount, patient_amount, bill_status,
                         patient_settled_baseline, insurance_settled_baseline
                  FROM bills WHERE patient_id=%s
                    AND ((%s IS NOT NULL AND admission_id=%s)
                      OR (%s IS NOT NULL AND visit_id=%s))
                  ORDER BY bill_id DESC LIMIT 1 FOR UPDATE""",
                (patient_id, admission_id, admission_id, visit_id, visit_id))
    bill = cur.fetchone()
    if not bill:
        # A charge may be the first financial event for an encounter. Create a
        # main ledger bill here so Patient 360 and Admin Billing share the same
        # source of truth; never use a bill that belongs to another patient.
        cur.execute("SELECT nextval(pg_get_serial_sequence('bills','bill_id'))")
        next_bill = cur.fetchone()
        bill_id = int(next_bill[0] if not isinstance(next_bill, dict) else next_bill.get('nextval'))
        bill_number = f"MER-BIL-{bill_id:07d}"
        cur.execute("""INSERT INTO bills
            (bill_id,bill_number,patient_id,visit_id,admission_id,bill_date,gross_amount,
             discount_amount,tax_amount,net_amount,insurance_amount,patient_amount,bill_status)
            VALUES (%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,0,0,0,0,0,0,'Pending')""",
            (bill_id,bill_number,patient_id,visit_id,admission_id))
        bill = (bill_id, 0, 0, 0, 0, 0, 0,
                'Pending', 0, 0)
    if isinstance(bill, dict):
        bill_id, gross, discount, tax, net, insurance, patient, previous_status, patient_baseline, insurance_baseline = (bill[k] for k in
            ('bill_id','gross_amount','discount_amount','tax_amount','net_amount','insurance_amount','patient_amount','bill_status','patient_settled_baseline','insurance_settled_baseline'))
    else:
        bill_id, gross, discount, tax, net, insurance, patient, previous_status, patient_baseline, insurance_baseline = bill
    cur.execute("""INSERT INTO bill_items
        (bill_id,description,quantity,unit_price,gross_amount,discount_amount,tax_amount,net_amount,
         service_date,reference_type,source_type,source_order_id,source_service_code)
        VALUES (%s,%s,1,%s,%s,0,0,%s,CURRENT_DATE,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING""",
        (bill_id, f"{service_name} ({view})" if view else service_name, amount, amount, amount,
         source_type, source_type, str(source_order_id), service_code))
    if cur.rowcount != 1:
        cur.execute("""UPDATE patient_charges SET billing_status='BILLED'
                      WHERE source_type=%s AND source_order_id=%s AND service_code=%s
                        AND EXISTS (SELECT 1 FROM bill_items WHERE source_type=%s
                          AND source_order_id=%s AND source_service_code=%s)""",
                    (source_type,str(source_order_id),service_code,source_type,str(source_order_id),service_code))
        return
    gross, net = float(gross or 0), float(net or 0)
    old_ins, old_pat = float(insurance or 0), float(patient if patient is not None else net)
    old_net = max(net, 0.0)
    # Preserve the bill's established payer split. A zero-net bill defaults to
    # patient-payable, consistent with self-pay bill creation.
    ins_ratio = min(1.0, max(0.0, old_ins / old_net)) if old_net else 0.0
    if old_net <= 0 and old_ins <= 0 and old_pat <= 0:
        cur.execute("""SELECT COALESCE(coverage_limit,0) AS coverage_limit FROM patient_insurance
                      WHERE patient_id=%s AND status='Active'
                      ORDER BY insurance_id DESC LIMIT 1""", (patient_id,))
        coverage_row = cur.fetchone()
        coverage = float(coverage_row[0] if not isinstance(coverage_row, dict) else coverage_row.get('coverage_limit') or 0) if coverage_row else 0.0
        added_ins = min(float(amount), max(0.0, coverage - old_ins))
    else:
        added_ins = round(float(amount) * ins_ratio, 2)
    added_pat = round(float(amount) - added_ins, 2)
    new_net = round(net + float(amount), 2)
    new_gross = round(float(gross or 0) + float(amount), 2)
    new_ins = round(old_ins + added_ins, 2)
    new_pat = round(old_pat + added_pat, 2)
    cur.execute("""SELECT COALESCE(SUM(CASE WHEN UPPER(COALESCE(payer_type,'PATIENT'))='INSURANCE'
                            THEN 0 ELSE amount END),0) AS patient_paid,
                         COALESCE(SUM(CASE WHEN UPPER(COALESCE(payer_type,'PATIENT'))='INSURANCE'
                            THEN amount ELSE 0 END),0) AS insurance_paid
                  FROM payments WHERE bill_id=%s AND UPPER(payment_status) IN ('SUCCESS','PAID','COMPLETED')""", (bill_id,))
    paid = cur.fetchone()
    patient_paid, insurance_paid = (paid[0], paid[1]) if not isinstance(paid, dict) else (paid['patient_paid'], paid['insurance_paid'])
    cur.execute("SELECT COALESCE(SUM(settled_amount),0) AS settled_amount FROM insurance_claims WHERE bill_id=%s", (bill_id,))
    settled = cur.fetchone()
    insurance_paid = float(insurance_paid or 0) + float(settled[0] if not isinstance(settled, dict) else settled.get('settled_amount', 0) or 0)
    patient_baseline = float(patient_baseline or 0)
    insurance_baseline = float(insurance_baseline or 0)
    if str(previous_status or '').strip().lower() in ('settled', 'paid', 'cleared'):
        # Older settled bills may predate payment-row tracking. Preserve the
        # settled baseline when an incremental order charge reopens the bill.
        patient_baseline = max(patient_baseline, old_pat - float(patient_paid or 0))
        insurance_baseline = max(insurance_baseline, old_ins - insurance_paid)
    effective_patient_paid = float(patient_paid or 0) + patient_baseline
    effective_insurance_paid = insurance_paid + insurance_baseline
    patient_due = max(0.0, new_pat - effective_patient_paid)
    insurance_due = max(0.0, new_ins - effective_insurance_paid)
    status = 'Settled' if patient_due <= 0 and insurance_due <= 0 else ('Partially Paid' if effective_patient_paid + effective_insurance_paid > 0 else 'Pending')
    cur.execute("""UPDATE bills SET gross_amount=%s,net_amount=%s,insurance_amount=%s,
                     patient_amount=%s,bill_status=%s,patient_settled_baseline=%s,
                     insurance_settled_baseline=%s WHERE bill_id=%s""",
                (new_gross, new_net, new_ins, new_pat, status, patient_baseline,
                 insurance_baseline, bill_id))
    cur.execute("""UPDATE patient_charges SET billing_status='BILLED'
                  WHERE source_type=%s AND source_order_id=%s AND service_code=%s""",
                (source_type, str(source_order_id), service_code))


def bill_lab_order(cur, *, patient_id, visit_id, admission_id, order_id, test_code, test_name, source):
    service_code = resolve_lab_service_code(cur, test_code, test_name)
    _insert_charge(cur, patient_id=patient_id, visit_id=visit_id, admission_id=admission_id,
                   source_type='LAB', source_order_id=order_id, service_code=service_code,
                   view=None, source=source)


def bill_xray_order(cur, *, patient_id, visit_id, admission_id, order_id, examination, source):
    projections = ['PA', 'AP'] if examination == 'Chest X-ray PA + AP' else [examination.rsplit(' ', 1)[-1]]
    for projection in projections:
        service_code = f'XR-CHEST-{projection}'
        _insert_charge(cur, patient_id=patient_id, visit_id=visit_id, admission_id=admission_id,
                       source_type='XRAY', source_order_id=order_id, service_code=service_code,
                       view=projection, source=source)

