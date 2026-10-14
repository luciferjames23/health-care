import re
import os

target_file = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\agent_service.py"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

print("Original file length:", len(content))

# 1. Add import
if "import services.patient_360_service as patient_360_service" not in content:
    content = content.replace(
        "import services.patient_service as patient_service",
        "import services.patient_service as patient_service\nimport services.patient_360_service as patient_360_service",
        1
    )
    print("1. Added patient_360_service import")

# 2. Add cleanup in handle_switch_patient_flow
old_switch = '''    state["booking_patient_id"] = None
    state["modifying_booking_id"] = None
    if isinstance(state.get("entities"), dict):'''
new_switch = '''    state["booking_patient_id"] = None
    state["modifying_booking_id"] = None
    state["selected_xray_id"] = None
    state["selected_discharge_id"] = None
    state["selected_report_id"] = None
    if isinstance(state.get("entities"), dict):'''
assert old_switch in content, "old_switch not found"
content = content.replace(old_switch, new_switch, 1)
print("2. Added cleanup in handle_switch_patient_flow")

# 3. Add cleanup in btn_select_pat_
old_select = '''            state["booking_patient_id"] = None
            state["modifying_booking_id"] = None
            if isinstance(state.get("entities"), dict):'''
new_select = '''            state["booking_patient_id"] = None
            state["modifying_booking_id"] = None
            state["selected_xray_id"] = None
            state["selected_discharge_id"] = None
            state["selected_report_id"] = None
            if isinstance(state.get("entities"), dict):'''
assert old_select in content, "old_select not found"
content = content.replace(old_select, new_select, 1)
print("3. Added cleanup in btn_select_pat_")

# 4. Add natural language triggers before btn_my_appts
old_nlp = '''        elif any(kw in m_strip for kw in ["my appointment", "my appts", "appointment details", "check appointment", "view appointment", "show my appointment", "my appointment details", "upcoming appointment", "my bookings", "check my appt"]) or m_strip in ["my appointments", "my appt"]:
            btn_id = "btn_my_appts"'''
new_nlp = '''        elif any(kw in m_strip for kw in ["show my x-ray", "show my xray", "my x-ray", "my xray", "x-ray", "xray", "show x-ray", "view x-ray", "x-ray image", "x-ray scan", "i need my x-ray", "send my x-ray"]):
            btn_id = "btn_cat_xrays"
        elif any(kw in m_strip for kw in ["i need my radiology report", "radiology report", "x-ray report", "radiology", "imaging report"]):
            btn_id = "btn_cat_xrays"
        elif any(kw in m_strip for kw in ["send my discharge summary", "discharge summary", "discharge document", "discharge papers", "discharge instructions", "my discharge summary"]):
            btn_id = "btn_cat_discharge"
        elif any(kw in m_strip for kw in ["how much do i still owe", "how much do i owe", "outstanding balance", "my balance", "due amount", "what do i owe"]):
            btn_id = "btn_balance"
        elif any(kw in m_strip for kw in ["show my previous payments", "payment history", "previous payments", "my payments", "past payments"]):
            btn_id = "btn_payment_history"
        elif any(kw in m_strip for kw in ["i want my medical records", "medical records", "clinical records", "clinical notes", "my medical records"]):
            btn_id = "btn_clinical_records"
        elif any(kw in m_strip for kw in ["insurance status", "insurance details", "my insurance", "tpa status", "insurance"]):
            btn_id = "btn_insurance"
        elif any(kw in m_strip for kw in ["appointment details", "my appointment details", "view appointment details"]):
            btn_id = "btn_appt_details"
        elif any(kw in m_strip for kw in ["documents / forms", "my documents", "documents", "hospital documents"]):
            btn_id = "btn_my_documents"
        elif any(kw in m_strip for kw in ["my appointment", "my appts", "appointment details", "check appointment", "view appointment", "show my appointment", "my appointment details", "upcoming appointment", "my bookings", "check my appt"]) or m_strip in ["my appointments", "my appt"]:
            btn_id = "btn_my_appts"'''
assert old_nlp in content, "old_nlp not found"
content = content.replace(old_nlp, new_nlp, 1)
print("4. Added natural language triggers")

# 5. Add structured button pass-through prefixes
old_pass = '''        elif m_strip.startswith("btn_date_") or m_strip.startswith("btn_doc_") \\
                or m_strip.startswith("btn_dep_") or m_strip.startswith("btn_slot_") \\
                or m_strip.startswith("btn_pay_") or m_strip.startswith("btn_report_") \\
                or m_strip.startswith("btn_appt_") or m_strip.startswith("btn_cancel_existing_") \\
                or m_strip.startswith("btn_reschedule_existing_") or m_strip.startswith("btn_exec_cancel_") \\
                or m_strip.startswith("btn_confirm_") or m_strip.startswith("btn_change_") or m_strip.startswith("btn_cancel_"):
            # Pass structured IDs through unchanged
            btn_id = m_strip'''
new_pass = '''        elif m_strip.startswith("btn_date_") or m_strip.startswith("btn_doc_") \\
                or m_strip.startswith("btn_dep_") or m_strip.startswith("btn_slot_") \\
                or m_strip.startswith("btn_pay_") or m_strip.startswith("btn_report_") \\
                or m_strip.startswith("btn_appt_") or m_strip.startswith("btn_cancel_existing_") \\
                or m_strip.startswith("btn_reschedule_existing_") or m_strip.startswith("btn_exec_cancel_") \\
                or m_strip.startswith("btn_confirm_") or m_strip.startswith("btn_change_") or m_strip.startswith("btn_cancel_") \\
                or m_strip.startswith("btn_xray_") or m_strip.startswith("btn_send_xray_image_") \\
                or m_strip.startswith("btn_view_rad_report_") or m_strip.startswith("btn_discharge_") \\
                or m_strip.startswith("btn_send_discharge_pdf_") or m_strip.startswith("btn_cat_"):
            # Pass structured IDs through unchanged
            btn_id = m_strip'''
assert old_pass in content, "old_pass not found"
content = content.replace(old_pass, new_pass, 1)
print("5. Added structured button pass-through prefixes")

# 6. Update btn_cat_health and add btn_appt_details
old_health_billing = '''        elif btn_id == "btn_cat_health":
            resp = "📋 *My Health & Records*\\n\\nWhat would you like to access?"
            if current_lang == "TAMIL":
                resp = "📋 *என் சுகாதாரம் & பதிவுகள்*\\n\\nஎதைப் பார்க்க விரும்புகிறீர்கள்?"
            elif current_lang == "HINDI":
                resp = "📋 *स्वास्थ्य व रिकॉर्ड*\\n\\nआप क्या देखना चाहते हैं?"

            state["interactive_buttons"] = [
                language_service.get_translated_button("btn_my_reports", current_lang),
                language_service.get_translated_button("btn_preadmission", current_lang),
                language_service.get_translated_button("btn_my_appts", current_lang),
                language_service.get_translated_button("btn_my_documents", current_lang),
                language_service.get_translated_button("btn_my_profile", current_lang),
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "MY_HEALTH_AND_RECORDS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "MY_HEALTH_AND_RECORDS", state)
            return {
                "response": resp,
                "intent": "MY_HEALTH_AND_RECORDS",
                "language": current_lang,
                "interactive_buttons": state["interactive_buttons"]
            }

        elif btn_id == "btn_cat_billing":
            state["payment_context"] = "BILL_PAYMENT"
            state["is_balance_payment"] = False
            state["modifying_booking_id"] = None
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            out_str = "₹4,850"
            if pat_id:
                b_id, b_num, total_amt, b_stat = get_or_create_patient_bill(pat_id, "INV-2026-8841", 4850.0)
                paid_amt = calculate_bill_payments(b_id, pat_id)
                outstanding = max(0.0, total_amt - paid_amt)
                out_str = f"₹{int(outstanding):,}" if outstanding.is_integer() else f"₹{outstanding:,.2f}"

            resp = (
                "💳 *Billing & Payments*\\n\\n"
                f"Outstanding Balance: {out_str}\\n"
                "Account Status: Active\\n\\n"
                "Select an option below to view or manage billing:"
            )
            state["interactive_buttons"] = [
                language_service.get_translated_button("btn_view_bill", current_lang),
                language_service.get_translated_button("btn_balance", current_lang),
                language_service.get_translated_button("btn_book_appt", current_lang),
                language_service.get_translated_button("btn_insurance", current_lang),
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {
                "response": resp,
                "intent": "BILLING_AND_PAYMENTS",
                "language": current_lang,
                "interactive_buttons": state["interactive_buttons"]
            }'''

new_health_billing = '''        elif btn_id == "btn_cat_health":
            resp = "📋 *My Health & Records*\\n\\nWhat would you like to access?"
            if current_lang == "TAMIL":
                resp = "📋 *என் சுகாதாரம் & பதிவுகள்*\\n\\nஎதைப் பார்க்க விரும்புகிறீர்கள்?"
            elif current_lang == "HINDI":
                resp = "📋 *स्वास्थ्य व रिकॉर्ड*\\n\\nआप क्या देखना चाहते हैं?"

            state["interactive_buttons"] = [
                language_service.get_translated_button("btn_my_profile", current_lang),
                language_service.get_translated_button("btn_my_reports", current_lang),
                language_service.get_translated_button("btn_my_appts", current_lang),
                language_service.get_translated_button("btn_appt_details", current_lang),
                language_service.get_translated_button("btn_my_documents", current_lang),
                language_service.get_translated_button("btn_preadmission", current_lang),
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "MY_HEALTH_AND_RECORDS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "MY_HEALTH_AND_RECORDS", state)
            return {
                "response": resp,
                "intent": "MY_HEALTH_AND_RECORDS",
                "language": current_lang,
                "interactive_buttons": state["interactive_buttons"]
            }

        elif btn_id == "btn_appt_details":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="APPOINTMENT_DETAILS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            appt_row = None
            try:
                cur.execute("""
                    SELECT a.id, a.appointment_code, a.appointment_date, a.appointment_time,
                           a.status, a.reason, d.display_name, dept.department_name, d.consultation_fee
                    FROM appointments a
                    LEFT JOIN doctors d ON a.doctor_id = d.id
                    LEFT JOIN departments dept ON a.department_id = dept.id
                    WHERE a.patient_id = %s
                    ORDER BY a.appointment_date DESC, a.appointment_time DESC
                    LIMIT 1;
                """, (pat_id,))
                appt_row = cur.fetchone()
            finally:
                cur.close()
                conn.close()

            if appt_row:
                a_id, a_code, a_date, a_time, a_status, a_reason, doc_n, dept_n, fee = appt_row
                t_str = format_time_12h(str(a_time))
                d_str = str(a_date)
                fee_str = f"₹{int(fee):,}" if fee else "₹800"
                resp = (
                    f"📅 *Appointment Details*\\n\\n"
                    f"Booking Reference: {a_code or f'APT{a_id}'}\\n"
                    f"Doctor: {doc_n or 'Consultant Physician'}\\n"
                    f"Department: {dept_n or 'General Medicine'}\\n"
                    f"Date: {d_str}\\n"
                    f"Time: {t_str}\\n"
                    f"Consultation Fee: {fee_str}\\n"
                    f"Status: {a_status or 'CONFIRMED'}\\n"
                    f"Reason: {a_reason or 'General Consultation'}"
                )
                buttons = [
                    language_service.get_translated_button("btn_my_appts", current_lang),
                    language_service.get_translated_button("btn_reschedule_appt", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                resp = "You have no upcoming or recent appointments recorded for this profile."
                buttons = [
                    language_service.get_translated_button("btn_book_appt", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            state["interactive_buttons"] = buttons
            state["intent"] = "APPOINTMENT_DETAILS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "APPOINTMENT_DETAILS", state)
            return {"response": resp, "intent": "APPOINTMENT_DETAILS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_cat_billing":
            state["payment_context"] = "BILL_PAYMENT"
            state["is_balance_payment"] = False
            state["modifying_booking_id"] = None
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            bill_info = patient_360_service.get_authoritative_patient_bill(pat_id) if pat_id else None
            out_str = "₹0"
            stat_str = "No Active Bill"
            if bill_info:
                outstanding = bill_info.get("outstanding_balance", 0.0)
                out_str = f"₹{int(outstanding):,}" if outstanding.is_integer() else f"₹{outstanding:,.2f}"
                stat_str = bill_info.get("bill_status", "Active")
                state["bill_id"] = bill_info.get("bill_id")
                state["bill_reference"] = bill_info.get("bill_number")
                state["bill_total_amount"] = bill_info.get("total_payable_amount")
                state["bill_paid_amount"] = bill_info.get("net_payments")
                state["bill_outstanding_amount"] = outstanding
                state["bill_patient_id"] = pat_id

            resp = (
                "💳 *Billing & Payments*\\n\\n"
                f"Outstanding Balance: {out_str}\\n"
                f"Bill Status: {stat_str}\\n\\n"
                "Select an option below to view or manage billing:"
            )
            state["interactive_buttons"] = [
                language_service.get_translated_button("btn_view_bill", current_lang),
                language_service.get_translated_button("btn_balance", current_lang),
                language_service.get_translated_button("btn_pay_bill", current_lang),
                language_service.get_translated_button("btn_insurance", current_lang),
                language_service.get_translated_button("btn_payment_history", current_lang),
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {
                "response": resp,
                "intent": "BILLING_AND_PAYMENTS",
                "language": current_lang,
                "interactive_buttons": state["interactive_buttons"]
            }'''
assert old_health_billing in content, "old_health_billing not found"
content = content.replace(old_health_billing, new_health_billing, 1)
print("6. Updated btn_cat_health and btn_cat_billing")

# 7. Update btn_view_bill, btn_balance, btn_pay_bill, btn_payment_history, btn_insurance, btn_my_documents
old_view_bill_block = '''        elif btn_id == "btn_view_bill":
            state["payment_context"] = "BILL_PAYMENT"
            state["is_balance_payment"] = False
            state["modifying_booking_id"] = None
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            p_name, p_code = "Patient", "P9989"
            if pat_id:
                conn = db_config.get_db_connection()
                cur = conn.cursor()
                try:
                    cur.execute("SELECT first_name, last_name, patient_code FROM patients WHERE id = %s;", (pat_id,))
                    p_r = cur.fetchone()
                    if p_r:
                        p_name = format_patient_full_name(p_r[0], p_r[1])
                        p_code = p_r[2] or f"P{pat_id}"
                finally:
                    cur.close()
                    conn.close()

            b_id, b_num, total_amt, b_stat = get_or_create_patient_bill(pat_id, "INV-2026-8841", 4850.0)
            paid_amt = calculate_bill_payments(b_id, pat_id)
            outstanding = max(0.0, total_amt - paid_amt)

            state["bill_id"] = b_id
            state["bill_reference"] = b_num
            state["bill_total_amount"] = total_amt
            state["bill_paid_amount"] = paid_amt
            state["bill_outstanding_amount"] = outstanding
            state["bill_patient_id"] = pat_id
            state["bill_patient_name"] = p_name
            state["bill_patient_code"] = p_code

            tot_str = f"₹{int(total_amt):,}" if total_amt.is_integer() else f"₹{total_amt:,.2f}"
            paid_str = f"₹{int(paid_amt):,}" if paid_amt.is_integer() else f"₹{paid_amt:,.2f}"
            out_str = f"₹{int(outstanding):,}" if outstanding.is_integer() else f"₹{outstanding:,.2f}"

            if outstanding <= 0:
                resp = (
                    f"💳 *Itemized Hospital Bill*\\n\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Bill Reference: {b_num}\\n"
                    f"Bill Date: 10-Sep-2026\\n\\n"
                    f"• OPD Consultation Fee: ₹800\\n"
                    f"• Diagnostic Lab Tests: ₹2,450\\n"
                    f"• Pharmacy Charges: ₹1,600\\n"
                    f"----------------------------------------\\n"
                    f"Total Amount Due: {tot_str}\\n"
                    f"Paid Amount: {paid_str}\\n"
                    f"Outstanding Balance: ₹0\\n\\n"
                    f"✅ *This bill has already been paid in full.*"
                )
                state["interactive_buttons"] = [
                    {"id": "btn_cat_billing", "title": "Billing & Payments"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                resp = (
                    f"💳 *Itemized Hospital Bill*\\n\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Bill Reference: {b_num}\\n"
                    f"Bill Date: 10-Sep-2026\\n\\n"
                    f"• OPD Consultation Fee: ₹800\\n"
                    f"• Diagnostic Lab Tests: ₹2,450\\n"
                    f"• Pharmacy Charges: ₹1,600\\n"
                    f"----------------------------------------\\n"
                    f"Total Amount Due: {tot_str}\\n"
                    f"Paid Amount: {paid_str}\\n"
                    f"Outstanding Balance: {out_str}\\n\\n"
                    f"Select a payment method below to clear outstanding balance:"
                )
                state["interactive_buttons"] = [
                    {"id": "btn_pay_gpay", "title": "Google Pay"},
                    {"id": "btn_pay_upi", "title": "UPI / PhonePe"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}

        elif btn_id == "btn_payment_history":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            resp = (
                "📜 *Payment & Billing History*\\n\\n"
                "1. TXN9981 — ₹800 (OPD Consultation - Dermatology) — Paid on 02-Sep-2026\\n"
                "2. TXN9102 — ₹1,200 (Lab Test - CBC & Lipid) — Paid on 15-Aug-2026\\n\\n"
                "All receipts have been issued to your registered account."
            )
            state["interactive_buttons"] = [language_service.get_translated_button("btn_main_menu", current_lang)]
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}

        elif btn_id == "btn_insurance":
            resp = (
                "🛡️ *Insurance & Cashless Desk*\\n\\n"
                "Meridian Hospital partners with major TPA and Health Insurance Providers (Star Health, ICICI Lombard, HDFC ERGO, Max Bupa, Care Health).\\n\\n"
                "📞 *Insurance Desk Helpline:* 044 6666 9910\\n"
                "📍 *Location:* Ground Floor, Main Block Counter 4\\n"
                "📧 *TPA Email:* insurance@meridian-hospital.com"
            )
            state["interactive_buttons"] = [language_service.get_translated_button("btn_cat_staff", current_lang), language_service.get_translated_button("btn_main_menu", current_lang)]
            state["intent"] = "HOSPITAL_INFORMATION"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "HOSPITAL_INFORMATION", state)
            return {"response": resp, "intent": "HOSPITAL_INFORMATION", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}

        elif btn_id == "btn_my_documents":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            resp = (
                "📑 *My Documents*\\n\\n"
                "1. Discharge Summary (2026-06-10)\\n"
                "2. Doctor Prescription (2026-09-02)\\n"
                "3. Vaccination Certificate\\n\\n"
                "All documents are securely archived in your digital health folder."
            )
            state["interactive_buttons"] = [language_service.get_translated_button("btn_my_reports", current_lang), language_service.get_translated_button("btn_main_menu", current_lang)]
            state["intent"] = "MY_HEALTH_AND_RECORDS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "MY_HEALTH_AND_RECORDS", state)
            return {"response": resp, "intent": "MY_HEALTH_AND_RECORDS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}'''

new_view_bill_block = '''        elif btn_id == "btn_view_bill":
            state["payment_context"] = "BILL_PAYMENT"
            state["is_balance_payment"] = False
            state["modifying_booking_id"] = None
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            bill = patient_360_service.get_authoritative_patient_bill(pat_id) if pat_id else None

            if not bill:
                resp = (
                    "💳 *Hospital Bill & Payments*\\n\\n"
                    "No hospital bill records were found for this patient profile.\\n"
                    "Outstanding Balance: ₹0\\n\\n"
                    "All hospital dues are fully settled."
                )
                buttons = [
                    {"id": "btn_cat_billing", "title": "Billing & Payments"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
                state["interactive_buttons"] = buttons
                state["intent"] = "BILLING_AND_PAYMENTS"
                state_manager.save_conversation_state(conversation_code, state)
                log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
                return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

            b_id = bill["bill_id"]
            b_num = bill["bill_number"]
            total_amt = bill["total_payable_amount"]
            paid_amt = bill["net_payments"]
            outstanding = bill["outstanding_balance"]
            p_name = bill["patient_name"]
            p_code = bill["patient_code"]
            b_date_str = str(bill["bill_date"])

            state["bill_id"] = b_id
            state["bill_reference"] = b_num
            state["bill_total_amount"] = total_amt
            state["bill_paid_amount"] = paid_amt
            state["bill_outstanding_amount"] = outstanding
            state["bill_patient_id"] = pat_id
            state["bill_patient_name"] = p_name
            state["bill_patient_code"] = p_code

            tot_str = f"₹{int(total_amt):,}" if isinstance(total_amt, (int, float)) and float(total_amt).is_integer() else f"₹{total_amt:,.2f}"
            paid_str = f"₹{int(paid_amt):,}" if isinstance(paid_amt, (int, float)) and float(paid_amt).is_integer() else f"₹{paid_amt:,.2f}"
            out_str = f"₹{int(outstanding):,}" if isinstance(outstanding, (int, float)) and float(outstanding).is_integer() else f"₹{outstanding:,.2f}"

            # Format itemized charges
            item_lines = []
            for itm in bill.get("line_items", []):
                amt = itm.get("amount", 0.0)
                qty = itm.get("quantity", 1)
                desc = itm.get("item_name") or itm.get("item_description") or "Hospital Service"
                amt_str = f"₹{int(amt):,}" if isinstance(amt, (int, float)) and float(amt).is_integer() else f"₹{amt:,.2f}"
                item_lines.append(f"• {desc} (x{qty}): {amt_str}")

            items_str = "\\n".join(item_lines) if item_lines else "• Inpatient / Daycare Hospital Care"

            if outstanding <= 0:
                resp = (
                    f"💳 *Itemized Hospital Bill*\\n\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Bill Number: {b_num}\\n"
                    f"Billing Date: {b_date_str}\\n"
                    f"Status: {bill['bill_status']}\\n\\n"
                    f"*Itemized Charges:*\\n{items_str}\\n"
                    f"----------------------------------------\\n"
                    f"Total Payable: {tot_str}\\n"
                    f"Paid Amount: {paid_str}\\n"
                    f"Outstanding Balance: ₹0\\n\\n"
                    f"✅ *This hospital bill has been paid in full / settled.*"
                )
                buttons = [
                    language_service.get_translated_button("btn_payment_history", current_lang),
                    {"id": "btn_cat_billing", "title": "Billing & Payments"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                resp = (
                    f"💳 *Itemized Hospital Bill*\\n\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Bill Number: {b_num}\\n"
                    f"Billing Date: {b_date_str}\\n"
                    f"Status: {bill['bill_status']}\\n\\n"
                    f"*Itemized Charges:*\\n{items_str}\\n"
                    f"----------------------------------------\\n"
                    f"Total Payable: {tot_str}\\n"
                    f"Paid Amount: {paid_str}\\n"
                    f"*Outstanding Balance:* {out_str}\\n\\n"
                    f"Select Make Payment below to clear your balance:"
                )
                buttons = [
                    language_service.get_translated_button("btn_pay_bill", current_lang),
                    language_service.get_translated_button("btn_payment_history", current_lang),
                    {"id": "btn_cat_billing", "title": "Billing & Payments"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]

            state["interactive_buttons"] = buttons
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_pay_bill":
            state["payment_context"] = "BILL_PAYMENT"
            state["is_balance_payment"] = False
            state["modifying_booking_id"] = None
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            bill = patient_360_service.get_authoritative_patient_bill(pat_id) if pat_id else None

            if not bill or bill["outstanding_balance"] <= 0:
                resp = (
                    "✅ *No Outstanding Dues*\\n\\n"
                    "There is no outstanding hospital balance to pay for this patient profile.\\n"
                    "All bills have been settled in full."
                )
                buttons = [
                    {"id": "btn_cat_billing", "title": "Billing & Payments"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
                state["interactive_buttons"] = buttons
                state["intent"] = "BILLING_AND_PAYMENTS"
                state_manager.save_conversation_state(conversation_code, state)
                log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
                return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

            b_id = bill["bill_id"]
            b_num = bill["bill_number"]
            total_amt = bill["total_payable_amount"]
            paid_amt = bill["net_payments"]
            outstanding = bill["outstanding_balance"]
            p_name = bill["patient_name"]
            p_code = bill["patient_code"]

            state["bill_id"] = b_id
            state["bill_reference"] = b_num
            state["bill_total_amount"] = total_amt
            state["bill_paid_amount"] = paid_amt
            state["bill_outstanding_amount"] = outstanding
            state["bill_patient_id"] = pat_id
            state["bill_patient_name"] = p_name
            state["bill_patient_code"] = p_code

            out_str = f"₹{int(outstanding):,}" if isinstance(outstanding, (int, float)) and float(outstanding).is_integer() else f"₹{outstanding:,.2f}"

            resp = (
                f"💳 *Hospital Bill Payment*\\n\\n"
                f"Patient: {p_name} ({p_code})\\n"
                f"Bill Reference: {b_num}\\n"
                f"Total Bill Amount: ₹{total_amt:,.0f}\\n"
                f"Outstanding Balance Due: {out_str}\\n\\n"
                f"Select a payment method below to clear outstanding balance:"
            )
            buttons = [
                {"id": "btn_pay_gpay", "title": "Google Pay"},
                {"id": "btn_pay_upi", "title": "UPI / PhonePe"},
                {"id": "btn_cat_billing", "title": "Billing Menu"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_payment_history":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            txns = patient_360_service.get_patient_all_payment_history(pat_id) if pat_id else []

            if txns:
                lines = []
                for idx, t in enumerate(txns[:6], 1):
                    amt = t.get("amount", 0.0)
                    amt_str = f"₹{int(amt):,}" if isinstance(amt, (int, float)) and float(amt).is_integer() else f"₹{amt:,.2f}"
                    dt_str = str(t.get("date", ""))[:10]
                    ref = t.get("reference") or f"TXN{t.get('id')}"
                    p_type = t.get("type", "Payment")
                    stat = t.get("status", "SUCCESS")
                    mth = t.get("method", "ONLINE")
                    lines.append(f"{idx}. {ref} — {amt_str} ({p_type} via {mth})\\n   Status: {stat} | Date: {dt_str}")

                txn_list = "\\n".join(lines)
                resp = (
                    f"📜 *Payment & Transaction History*\\n\\n"
                    f"{txn_list}\\n\\n"
                    f"Authoritative receipts are issued under your patient registration."
                )
            else:
                resp = (
                    "📜 *Payment & Transaction History*\\n\\n"
                    "No prior payment records found for this patient profile.\\n\\n"
                    "If you recently paid at the hospital desk, please allow a few minutes for the ledger to update."
                )
            buttons = [
                language_service.get_translated_button("btn_view_bill", current_lang),
                {"id": "btn_cat_billing", "title": "Billing & Payments"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_insurance":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            ins_data = patient_360_service.get_patient_insurance_and_claims(pat_id) if pat_id else {}
            policies = ins_data.get("policies", [])
            claims = ins_data.get("claims", [])

            if policies:
                p_lines = []
                for p in policies:
                    prov = p.get("provider", "Health Insurance")
                    p_num = p.get("policy_number", "N/A")
                    cov = p.get("coverage_amount", 0.0)
                    cov_str = f"₹{int(cov):,}" if cov else "Standard"
                    p_stat = p.get("status", "ACTIVE")
                    p_lines.append(f"• {prov} — Policy: {p_num}\\n  Coverage: {cov_str} | Status: {p_stat}")
                pol_str = "\\n".join(p_lines)
            else:
                pol_str = "No active health insurance policy currently linked."

            if claims:
                c_lines = []
                for c in claims:
                    c_num = c.get("claim_number", "N/A")
                    c_amt = c.get("claim_amount", 0.0)
                    c_app = c.get("approved_amount", 0.0)
                    c_stat = c.get("claim_status", "SUBMITTED")
                    c_lines.append(f"• Claim #{c_num}: ₹{c_amt:,.0f} (Approved: ₹{c_app:,.0f}) | Status: {c_stat}")
                claim_str = "\\n".join(c_lines)
            else:
                claim_str = "No pending or historical claims filed."

            resp = (
                f"🛡️ *Insurance & Cashless Desk*\\n\\n"
                f"*Linked Policies:*\\n{pol_str}\\n\\n"
                f"*Claims Status:*\\n{claim_str}\\n\\n"
                f"📞 *TPA & Insurance Helpline:* 044 6666 9910\\n"
                f"📍 *Location:* Ground Floor, Main Block Counter 4\\n"
                f"📧 *TPA Email:* insurance@meridian-hospital.com"
            )
            buttons = [
                {"id": "btn_cat_billing", "title": "Billing & Payments"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "HOSPITAL_INFORMATION"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "HOSPITAL_INFORMATION", state)
            return {"response": resp, "intent": "HOSPITAL_INFORMATION", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id in ("btn_my_documents", "btn_cat_documents"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            disch_list = patient_360_service.get_patient_discharge_summaries(pat_id) if pat_id else []
            d_count = len(disch_list)

            resp = (
                "📑 *Patient Documents & Records*\\n\\n"
                "Meridian Hospital stores authorized electronic records in your Patient 360 folder.\\n\\n"
                f"• Inpatient Discharge Summaries: {d_count} record(s)\\n"
                "• Clinical Diagnoses & Medication Orders\\n"
                "• Outpatient Medical Reports\\n\\n"
                "Select a document type below to view or download:"
            )
            state["interactive_buttons"] = [
                {"id": "btn_cat_discharge", "title": f"Discharge Summaries ({d_count})"},
                {"id": "btn_clinical_records", "title": "Clinical Records"},
                language_service.get_translated_button("btn_my_reports", current_lang),
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "PATIENT_DOCUMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_DOCUMENTS", state)
            return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}

        elif btn_id == "btn_cat_discharge":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            summaries = patient_360_service.get_patient_discharge_summaries(pat_id) if pat_id else []

            if not summaries:
                resp = (
                    "📑 *Discharge Summaries*\\n\\n"
                    "No inpatient discharge summaries or hospitalization records were found for this patient profile.\\n\\n"
                    "Discharge summaries are generated by your attending physician upon formal hospital discharge."
                )
                buttons = [
                    {"id": "btn_my_documents", "title": "My Documents"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                resp = (
                    f"📑 *Discharge Summaries ({len(summaries)} found)*\\n\\n"
                    "Select an admission record below to view or download the authorized summary:"
                )
                buttons = []
                for s in summaries[:5]:
                    s_id = s["id"]
                    d_dt = str(s.get("discharge_date", ""))[:10]
                    stat_icon = "✅ Signed" if s.get("is_approved") else "⏳ Pending"
                    buttons.append({"id": f"btn_discharge_{s_id}", "title": f"Discharge {d_dt} ({stat_icon})"[:24]})
                buttons.append({"id": "btn_my_documents", "title": "My Documents"})
                buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))

            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_DOCUMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_DOCUMENTS", state)
            return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id and btn_id.startswith("btn_discharge_"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            try:
                s_id = int(btn_id.replace("btn_discharge_", "").strip())
            except ValueError:
                s_id = None

            details = patient_360_service.get_discharge_summary_details(s_id, pat_id) if s_id and pat_id else None
            if not details:
                resp = "Access denied or discharge summary record not found for this patient profile."
                buttons = [
                    {"id": "btn_cat_discharge", "title": "Discharge Records"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                p_name = details.get("patient_name") or "Patient"
                p_code = details.get("patient_code") or f"P{pat_id}"
                adm_date = str(details.get("admission_date", "N/A"))[:10]
                dis_date = str(details.get("discharge_date", "N/A"))[:10]
                doc_name = details.get("doctor_name") or "Attending Physician"
                diag = details.get("diagnosis") or "Clinical assessment recorded"
                cond = details.get("condition_at_discharge") or "Stable"
                app_stat = details.get("approval_status") or "Approved"
                is_app = details.get("is_approved", True)

                if is_app:
                    status_text = f"✅ *Status: Final & Signed by {doc_name}*"
                    btn_download = {"id": f"btn_send_discharge_pdf_{s_id}", "title": "📄 Download PDF"}
                    buttons = [
                        btn_download,
                        {"id": "btn_cat_discharge", "title": "Discharge List"},
                        language_service.get_translated_button("btn_main_menu", current_lang)
                    ]
                else:
                    status_text = f"⏳ *Status: {app_stat} (Awaiting Doctor Signature)*\\n⚠️ This document has not been finalized yet and cannot be issued as a signed summary."
                    buttons = [
                        {"id": "btn_cat_discharge", "title": "Discharge List"},
                        language_service.get_translated_button("btn_main_menu", current_lang)
                    ]

                resp = (
                    f"📑 *Inpatient Discharge Record*\\n\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Admission Date: {adm_date}\\n"
                    f"Discharge Date: {dis_date}\\n"
                    f"Attending Doctor: {doc_name}\\n"
                    f"{status_text}\\n\\n"
                    f"*Primary Diagnosis:*\\n{diag}\\n\\n"
                    f"*Condition at Discharge:* {cond}"
                )

            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_DOCUMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_DOCUMENTS", state)
            return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id and btn_id.startswith("btn_send_discharge_pdf_"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            try:
                s_id = int(btn_id.replace("btn_send_discharge_pdf_", "").strip())
            except ValueError:
                s_id = None

            details = patient_360_service.get_discharge_summary_details(s_id, pat_id) if s_id and pat_id else None
            if not details:
                resp = "Discharge summary record not found or access denied."
                buttons = [{"id": "btn_cat_discharge", "title": "Discharge List"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}

            if not details.get("is_approved"):
                resp = (
                    f"⏳ *Discharge Summary Pending Approval*\\n\\n"
                    f"This discharge summary is currently marked as *{details.get('approval_status')}*.\\n"
                    f"Signed PDF documents can only be exported after formal physician approval."
                )
                buttons = [{"id": "btn_cat_discharge", "title": "Discharge List"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}

            pdf_path = patient_360_service.generate_discharge_summary_pdf(s_id, pat_id)
            if not pdf_path or not os.path.exists(pdf_path):
                resp = "Error generating signed discharge summary PDF. Please contact hospital reception."
                buttons = [{"id": "btn_cat_discharge", "title": "Discharge List"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}

            resp = (
                f"📄 *Official Discharge Summary PDF*\\n\\n"
                f"Patient: {details.get('patient_name')} ({details.get('patient_code')})\\n"
                f"Discharge Date: {str(details.get('discharge_date'))[:10]}\\n"
                f"Status: Signed & Verified by {details.get('doctor_name')}\\n\\n"
                f"The authorized discharge summary document has been generated and dispatched below."
            )
            buttons = [
                {"id": "btn_cat_discharge", "title": "Discharge Records"},
                {"id": "btn_my_documents", "title": "My Documents"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_DOCUMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_DOCUMENTS", state)
            return {
                "response": resp,
                "intent": "PATIENT_DOCUMENTS",
                "language": current_lang,
                "media_document": pdf_path,
                "interactive_buttons": buttons
            }

        elif btn_id == "btn_clinical_records":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_DOCUMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            c_data = patient_360_service.get_patient_clinical_records(pat_id) if pat_id else {}

            diags = c_data.get("diagnoses", [])
            meds = c_data.get("medications", [])
            encs = c_data.get("encounters", [])

            if diags:
                diag_lines = [f"• {d['diagnosis']} ({d['status']})" for d in diags[:4]]
                diag_str = "\\n".join(diag_lines)
            else:
                diag_str = "No active chronic diagnoses recorded."

            if meds:
                med_lines = [f"• {m['medication_name']} — {m['dosage']} ({m['instructions'] or 'As directed'})" for m in meds[:5]]
                med_str = "\\n".join(med_lines)
            else:
                med_str = "No active prescriptions on file."

            if encs:
                enc_lines = [f"• {e['type']} on {e['date']} ({e['status']})" for e in encs[:3]]
                enc_str = "\\n".join(enc_lines)
            else:
                enc_str = "No recent outpatient/inpatient visits."

            resp = (
                f"🩺 *Clinical Records & Prescriptions*\\n\\n"
                f"*Active Diagnoses:*\\n{diag_str}\\n\\n"
                f"*Current Medications:*\\n{med_str}\\n\\n"
                f"*Recent Encounters:*\\n{enc_str}\\n\\n"
                f"Records are verified and synchronized with Meridian Hospital Patient 360."
            )
            buttons = [
                language_service.get_translated_button("btn_my_reports", current_lang),
                {"id": "btn_my_documents", "title": "My Documents"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_DOCUMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_DOCUMENTS", state)
            return {"response": resp, "intent": "PATIENT_DOCUMENTS", "language": current_lang, "interactive_buttons": buttons}'''

assert old_view_bill_block in content, "old_view_bill_block not found"
content = content.replace(old_view_bill_block, new_view_bill_block, 1)
print("7. Updated btn_view_bill, btn_balance, btn_pay_bill, btn_insurance, btn_my_documents")

# 8. Update btn_balance (around line 3732)
old_btn_balance = '''        elif btn_id == "btn_balance":
            resp = (
                "💰 *Outstanding Balance*\\n\\n"
                "Outstanding Balance: ₹4,850\\n"
                "Account Status: Active\\n\\n"
                "Select a payment option below to clear your balance:"
            )
            state["interactive_buttons"] = [
                language_service.get_translated_button("btn_view_bill", current_lang),
                {"id": "btn_pay_gpay", "title": "Google Pay"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}'''

new_btn_balance = '''        elif btn_id == "btn_balance":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="BILLING_AND_PAYMENTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            bill = patient_360_service.get_authoritative_patient_bill(pat_id) if pat_id else None

            if not bill or bill["outstanding_balance"] <= 0:
                resp = (
                    "💰 *Outstanding Balance*\\n\\n"
                    "Outstanding Balance: ₹0\\n"
                    "Account Status: Active (Settled)\\n\\n"
                    "✅ All hospital bills for this account are fully cleared."
                )
                buttons = [
                    language_service.get_translated_button("btn_view_bill", current_lang),
                    language_service.get_translated_button("btn_payment_history", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                outstanding = bill["outstanding_balance"]
                out_str = f"₹{int(outstanding):,}" if isinstance(outstanding, (int, float)) and float(outstanding).is_integer() else f"₹{outstanding:,.2f}"
                total_str = f"₹{int(bill['total_payable_amount']):,}" if isinstance(bill['total_payable_amount'], (int, float)) and float(bill['total_payable_amount']).is_integer() else f"₹{bill['total_payable_amount']:,.2f}"
                paid_str = f"₹{int(bill['net_payments']):,}" if isinstance(bill['net_payments'], (int, float)) and float(bill['net_payments']).is_integer() else f"₹{bill['net_payments']:,.2f}"

                resp = (
                    f"💰 *Authoritative Hospital Balance*\\n\\n"
                    f"Patient: {bill['patient_name']} ({bill['patient_code']})\\n"
                    f"Bill Number: {bill['bill_number']}\\n"
                    f"Total Bill Amount: {total_str}\\n"
                    f"Amount Paid So Far: {paid_str}\\n"
                    f"*Outstanding Balance Due:* {out_str}\\n\\n"
                    f"Select Make Payment below to settle this balance:"
                )
                buttons = [
                    language_service.get_translated_button("btn_pay_bill", current_lang),
                    language_service.get_translated_button("btn_view_bill", current_lang),
                    language_service.get_translated_button("btn_payment_history", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]

            state["interactive_buttons"] = buttons
            state["intent"] = "BILLING_AND_PAYMENTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "BILLING_AND_PAYMENTS", state)
            return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}'''

assert old_btn_balance in content, "old_btn_balance not found"
content = content.replace(old_btn_balance, new_btn_balance, 1)
print("8. Updated btn_balance")

# 9. Update btn_my_reports and add X-Ray handlers
old_reports_block = '''        elif btn_id == "btn_my_reports":
            w_num = conversation_code.replace("WA_", "").split("_")[0]
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("SELECT whatsapp_number FROM conversations WHERE conversation_code = %s;", (conversation_code,))
                r = cur.fetchone()
                if r and r[0]:
                    w_num = r[0]
            finally:
                cur.close()
                conn.close()

            all_pats = patient_id_service.get_all_patients_by_phone(w_num)
            if len(all_pats) > 1 and not state.get("selected_patient_id"):
                return prompt_patient_selection(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")

            pat_id = state.get("selected_patient_id") or state.get("dependent_patient_id") or state.get("patient_id") or state.get("primary_patient_id")
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            reports = []
            try:
                cur.execute("""
                    SELECT id, report_reference, report_type, report_title, report_date, status, summary
                    FROM patient_reports
                    WHERE patient_id = %s AND UPPER(status) IN ('AVAILABLE', 'COMPLETED', 'READY', 'ACTIVE')
                    ORDER BY report_date DESC LIMIT 5;
                """, (pat_id,))
                reports = cur.fetchall()
            finally:
                cur.close()
                conn.close()

            if reports:
                report_buttons = []
                for r in reports:
                    r_id, r_ref, r_type, r_title, r_date, r_status, r_sum = r
                    d_str = r_date.strftime("%d %b") if hasattr(r_date, "strftime") else str(r_date)[:10]
                    title_btn = f"{r_title} — {d_str}"[:24]
                    report_buttons.append({"id": f"btn_report_{r_id}", "title": title_btn})
                report_buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))
                resp = "📄 *Your Reports*\\n\\nPlease select a report to view details:"
                state["interactive_buttons"] = report_buttons
            else:
                resp = "No medical reports were found for your account.\\n\\nIf you recently had lab tests done, please allow 24–48 hours for reports to be uploaded to your patient record."
                state["interactive_buttons"] = [
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {
                "response": resp,
                "intent": "PATIENT_REPORTS",
                "language": current_lang,
                "interactive_buttons": state["interactive_buttons"]
            }
        elif btn_id and btn_id.startswith("btn_report_"):'''

new_reports_block = '''        elif btn_id == "btn_my_reports":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            rep_summary = patient_360_service.get_patient_authorized_reports(pat_id) if pat_id else {}

            x_count = rep_summary.get("xray_count", 0)
            l_count = rep_summary.get("lab_count", 0)
            d_count = rep_summary.get("discharge_count", 0)

            resp = (
                "📋 *My Health Reports*\\n\\n"
                "Available authorized clinical records in Patient 360:\\n\\n"
                f"• X-Ray & Radiology Scans: {x_count} available\\n"
                f"• Diagnostic Lab Reports: {l_count} available\\n"
                f"• Discharge Summaries: {d_count} available\\n\\n"
                "Select a category below to explore:"
            )
            buttons = [
                {"id": "btn_cat_xrays", "title": f"X-Ray & Scans ({x_count})"},
                {"id": "btn_cat_lab_reports", "title": f"Lab Reports ({l_count})"},
                {"id": "btn_cat_discharge", "title": f"Discharge ({d_count})"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_cat_xrays":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            scans = patient_360_service.get_patient_xray_scans(pat_id) if pat_id else []

            if not scans:
                resp = (
                    "🩻 *X-Ray & Radiology Records*\\n\\n"
                    "No X-ray or radiology records are available for this patient profile.\\n\\n"
                    "If you recently had imaging performed, please allow time for radiologist verification and upload."
                )
                buttons = [
                    language_service.get_translated_button("btn_my_reports", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                resp = (
                    f"🩻 *X-Ray & Radiology Scans ({len(scans)} found)*\\n\\n"
                    "Select a scan below to view details, radiology report, or high-resolution image:"
                )
                buttons = []
                for s in scans[:5]:
                    s_id = s["id"]
                    reg = s.get("body_region") or s.get("modality") or "Scan"
                    d_str = str(s.get("scan_date", ""))[:10]
                    has_img = "📸" if s.get("has_image") else "📝"
                    buttons.append({"id": f"btn_xray_{s_id}", "title": f"{has_img} {reg} {d_str}"[:24]})
                buttons.append(language_service.get_translated_button("btn_my_reports", current_lang))
                buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))

            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id and btn_id.startswith("btn_xray_"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            try:
                scan_id = int(btn_id.replace("btn_xray_", "").strip())
            except ValueError:
                scan_id = None

            scan = patient_360_service.get_xray_scan_details(scan_id, pat_id) if scan_id and pat_id else None
            if not scan:
                resp = "Access denied or X-ray record not found for this patient profile."
                buttons = [
                    {"id": "btn_cat_xrays", "title": "X-Ray List"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            else:
                reg = scan.get("body_region") or "X-Ray"
                mod = scan.get("modality") or "X-Ray"
                dt = str(scan.get("scan_date", "N/A"))[:10]
                stat = scan.get("status") or "Completed"
                rad = scan.get("radiologist_name") or "Radiology Department"
                has_img = scan.get("has_image")
                has_rep = bool(scan.get("scan_report") or scan.get("findings"))

                img_status_text = "✅ Digital Image Available" if has_img else "⚠️ Digital Image Not Available (Report Only)"

                resp = (
                    f"🩻 *{mod} — {reg}*\\n\\n"
                    f"Patient ID: P{pat_id}\\n"
                    f"Examination Date: {dt}\\n"
                    f"Radiologist: {rad}\\n"
                    f"Status: {stat}\\n"
                    f"{img_status_text}\\n\\n"
                    f"Choose an option below to view report or download image:"
                )

                buttons = []
                if has_img:
                    buttons.append({"id": f"btn_send_xray_image_{scan_id}", "title": "📸 Send X-Ray Image"})
                if has_rep:
                    buttons.append({"id": f"btn_view_rad_report_{scan_id}", "title": "📄 Radiology Report"})
                buttons.append({"id": "btn_cat_xrays", "title": "All X-Rays"})
                buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))

            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id and btn_id.startswith("btn_send_xray_image_"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            try:
                scan_id = int(btn_id.replace("btn_send_xray_image_", "").strip())
            except ValueError:
                scan_id = None

            scan = patient_360_service.get_xray_scan_details(scan_id, pat_id) if scan_id and pat_id else None
            if not scan:
                resp = "Access denied or X-ray record not found for this patient profile."
                buttons = [{"id": "btn_cat_xrays", "title": "X-Ray List"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

            img_bytes = patient_360_service.get_xray_image_bytes(scan_id, pat_id)
            if not img_bytes:
                resp = (
                    "⚠️ *Image File Not Available*\\n\\n"
                    "The radiology report is available for this examination, but the digital X-ray image is not available through the current system."
                )
                buttons = [
                    {"id": f"btn_view_rad_report_{scan_id}", "title": "View Radiology Report"},
                    {"id": "btn_cat_xrays", "title": "All X-Rays"},
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
                return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

            # Save to scratch directory
            scratch_dir = os.path.join(backend_dir, "scratch")
            os.makedirs(scratch_dir, exist_ok=True)
            img_path = os.path.join(scratch_dir, f"xray_scan_{scan_id}.png")
            with open(img_path, "wb") as f_img:
                f_img.write(img_bytes)

            reg = scan.get("body_region") or "X-Ray"
            dt = str(scan.get("scan_date", "N/A"))[:10]
            resp = (
                f"📸 *Authorized X-Ray Image — {reg}*\\n\\n"
                f"Patient ID: P{pat_id}\\n"
                f"Examination Date: {dt}\\n"
                f"Status: {scan.get('status', 'Verified')}\\n\\n"
                f"The verified high-resolution X-ray image has been dispatched below."
            )
            buttons = [
                {"id": f"btn_view_rad_report_{scan_id}", "title": "📄 Radiology Report"},
                {"id": "btn_cat_xrays", "title": "All X-Rays"},
                language_service.get_translated_button("btn_main_menu", current_lang)
            ]
            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {
                "response": resp,
                "intent": "PATIENT_REPORTS",
                "language": current_lang,
                "media_image": img_path,
                "interactive_buttons": buttons
            }

        elif btn_id and btn_id.startswith("btn_view_rad_report_"):
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            try:
                scan_id = int(btn_id.replace("btn_view_rad_report_", "").strip())
            except ValueError:
                scan_id = None

            scan = patient_360_service.get_xray_scan_details(scan_id, pat_id) if scan_id and pat_id else None
            if not scan:
                resp = "Access denied or radiology report not found for this patient profile."
                buttons = [{"id": "btn_cat_xrays", "title": "X-Ray List"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

            reg = scan.get("body_region") or "X-Ray"
            dt = str(scan.get("scan_date", "N/A"))[:10]
            findings = scan.get("findings") or "No acute abnormality detected."
            impression = scan.get("scan_report") or "Normal study."
            rad = scan.get("radiologist_name") or "Radiology Department"

            resp = (
                f"📄 *Radiology Report — {reg}*\\n\\n"
                f"Patient ID: P{pat_id}\\n"
                f"Date of Study: {dt}\\n"
                f"Radiologist: {rad}\\n"
                f"Status: {scan.get('status', 'Completed')}\\n\\n"
                f"*Findings:*\\n{findings}\\n\\n"
                f"*Impression / Summary:*\\n{impression}"
            )
            buttons = []
            if scan.get("has_image"):
                buttons.append({"id": f"btn_send_xray_image_{scan_id}", "title": "📸 Send X-Ray Image"})
            buttons.append({"id": "btn_cat_xrays", "title": "All X-Rays"})
            buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))

            state["interactive_buttons"] = buttons
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": buttons}

        elif btn_id == "btn_cat_lab_reports":
            is_sel, p_res = ensure_patient_selected(conversation_code, state, current_lang, action_intent="PATIENT_REPORTS")
            if not is_sel:
                return p_res
            pat_id = state.get("selected_patient_id") or state.get("patient_id")
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            reports = []
            try:
                cur.execute("""
                    SELECT id, report_reference, report_type, report_title, report_date, status, summary
                    FROM patient_reports
                    WHERE patient_id = %s AND UPPER(status) IN ('AVAILABLE', 'COMPLETED', 'READY', 'ACTIVE')
                    ORDER BY report_date DESC LIMIT 5;
                """, (pat_id,))
                reports = cur.fetchall()
            finally:
                cur.close()
                conn.close()

            if reports:
                report_buttons = []
                for r in reports:
                    r_id, r_ref, r_type, r_title, r_date, r_status, r_sum = r
                    d_str = r_date.strftime("%d %b") if hasattr(r_date, "strftime") else str(r_date)[:10]
                    title_btn = f"{r_title} — {d_str}"[:24]
                    report_buttons.append({"id": f"btn_report_{r_id}", "title": title_btn})
                report_buttons.append(language_service.get_translated_button("btn_my_reports", current_lang))
                report_buttons.append(language_service.get_translated_button("btn_main_menu", current_lang))
                resp = "📄 *Diagnostic Lab Reports*\\n\\nPlease select a report to view details:"
                state["interactive_buttons"] = report_buttons
            else:
                resp = "No diagnostic lab reports were found for this patient profile.\\n\\nIf you recently had lab tests done, please allow 24–48 hours for reports to be uploaded to your patient record."
                state["interactive_buttons"] = [
                    language_service.get_translated_button("btn_my_reports", current_lang),
                    language_service.get_translated_button("btn_main_menu", current_lang)
                ]
            state["intent"] = "PATIENT_REPORTS"
            state_manager.save_conversation_state(conversation_code, state)
            log_message_to_db(conversation_code, "AI_AGENT", resp, current_lang, "PATIENT_REPORTS", state)
            return {"response": resp, "intent": "PATIENT_REPORTS", "language": current_lang, "interactive_buttons": state["interactive_buttons"]}

        elif btn_id and btn_id.startswith("btn_report_"):'''

assert old_reports_block in content, "old_reports_block not found"
content = content.replace(old_reports_block, new_reports_block, 1)
print("9. Updated btn_my_reports and added X-Ray/Lab handlers")

# 10. Update Bill payment execution for real authoritative balance and idempotency
old_pay_exec = '''            if p_context == "BILL_PAYMENT":
                pay_id = state.get("payment_id")
                pay_ref = state.get("payment_reference") or f"PAYBILL{datetime.datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}"
                b_id = state.get("bill_id") or 1
                b_num = state.get("bill_reference") or "INV-2026-8841"
                pat_id = state.get("bill_patient_id") or state.get("selected_patient_id") or state.get("patient_id")
                p_name = state.get("bill_patient_name") or "Patient"
                p_code = state.get("bill_patient_code") or (f"P{pat_id}" if pat_id else "P1000061")
                fee_val = float(state.get("payment_amount", 4850.0))
                total_amt = float(state.get("bill_total_amount", 4850.0))
                txn_ref = f"MOCKTXN{random.randint(100000, 999999)}"

                conn = db_config.get_db_connection()
                cur = conn.cursor()
                try:
                    if pay_id:
                        cur.execute("UPDATE payments SET payment_status = 'SUCCESS', transaction_reference = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (txn_ref, pay_id))
                        conn.commit()
                except Exception as e:
                    print(f"[BILL_PAYMENT_SUCCESS_ERR] {e}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()

                paid_so_far = calculate_bill_payments(b_id, pat_id)
                remaining_balance = max(0.0, total_amt - paid_so_far)
                new_status = 'Settled' if remaining_balance == 0 else 'Partially Paid'

                conn = db_config.get_db_connection()
                cur = conn.cursor()
                try:
                    cur.execute("UPDATE bills SET bill_status = %s WHERE bill_id = %s;", (new_status, b_id))
                    conn.commit()
                except Exception as e:
                    print(f"[UPDATE_BILL_STATUS_ERR] {e}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()

                state["payment_context"] = None
                state["conversation_state"] = None
                state["payment_status"] = "SUCCESS"
                state["bill_outstanding_amount"] = remaining_balance

                fee_str = f"₹{int(fee_val):,}" if fee_val.is_integer() else f"₹{fee_val:,.2f}"
                rem_str = f"₹{int(remaining_balance):,}" if remaining_balance.is_integer() else f"₹{remaining_balance:,.2f}"

                resp = (
                    f"✅ *Bill Payment Successful!*\\n\\n"
                    f"Bill Reference: {b_num}\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Amount Paid: {fee_str}\\n"
                    f"Remaining Balance: {rem_str}\\n"
                    f"Payment Reference: {pay_ref}\\n"
                    f"Transaction Reference: {txn_ref}\\n\\n"
                    f"Your hospital bill has been cleared successfully."
                )'''

new_pay_exec = '''            if p_context == "BILL_PAYMENT":
                pat_id = state.get("bill_patient_id") or state.get("selected_patient_id") or state.get("patient_id")
                # Authoritative check from backend before applying payment
                authoritative_bill = patient_360_service.get_authoritative_patient_bill(pat_id) if pat_id else None

                if not authoritative_bill or authoritative_bill["outstanding_balance"] <= 0:
                    resp = (
                        f"✅ *Bill Already Paid*\\n\\n"
                        f"This hospital bill has already been settled in full.\\n"
                        f"Outstanding Balance: ₹0"
                    )
                    state["payment_context"] = None
                    state["conversation_state"] = None
                    buttons = [{"id": "btn_cat_billing", "title": "Billing & Payments"}, language_service.get_translated_button("btn_main_menu", current_lang)]
                    return {"response": resp, "intent": "BILLING_AND_PAYMENTS", "language": current_lang, "interactive_buttons": buttons}

                b_id = authoritative_bill["bill_id"]
                b_num = authoritative_bill["bill_number"]
                p_name = authoritative_bill["patient_name"]
                p_code = authoritative_bill["patient_code"]
                pay_id = state.get("payment_id")
                pay_ref = state.get("payment_reference") or f"PAYBILL{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"
                fee_val = float(state.get("payment_amount", authoritative_bill["outstanding_balance"]))
                total_amt = float(authoritative_bill["total_payable_amount"])
                txn_ref = f"TXN{datetime.datetime.now().strftime('%Y%m%d')}{random.randint(100000, 999999)}"

                conn = db_config.get_db_connection()
                cur = conn.cursor()
                try:
                    if pay_id:
                        cur.execute("UPDATE payments SET payment_status = 'SUCCESS', transaction_reference = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (txn_ref, pay_id))
                        conn.commit()
                    else:
                        cur.execute("""
                            INSERT INTO payments (payment_reference, patient_id, appointment_id, bill_id, amount, currency, payment_method, payment_status, payment_date, payer_type, transaction_reference, created_at, updated_at)
                            VALUES (%s, %s, NULL, %s, %s, 'INR', %s, 'SUCCESS', CURRENT_TIMESTAMP, 'PATIENT', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            RETURNING id;
                        """, (pay_ref, pat_id, b_id, fee_val, state.get("payment_method", "ONLINE"), txn_ref))
                        conn.commit()
                except Exception as e:
                    print(f"[BILL_PAYMENT_SUCCESS_ERR] {e}")
                    conn.rollback()
                finally:
                    cur.close()
                    conn.close()

                # Authoritative re-fetch of bill status after payment
                updated_bill = patient_360_service.get_authoritative_patient_bill(pat_id)
                remaining_balance = updated_bill["outstanding_balance"] if updated_bill else 0.0

                state["payment_context"] = None
                state["conversation_state"] = None
                state["payment_status"] = "SUCCESS"
                state["bill_outstanding_amount"] = remaining_balance

                fee_str = f"₹{int(fee_val):,}" if fee_val.is_integer() else f"₹{fee_val:,.2f}"
                rem_str = f"₹{int(remaining_balance):,}" if remaining_balance.is_integer() else f"₹{remaining_balance:,.2f}"

                resp = (
                    f"✅ *Hospital Bill Payment Successful!*\\n\\n"
                    f"Bill Number: {b_num}\\n"
                    f"Patient: {p_name} ({p_code})\\n"
                    f"Amount Paid: {fee_str}\\n"
                    f"Remaining Balance: {rem_str}\\n"
                    f"Payment Reference: {pay_ref}\\n"
                    f"Transaction ID: {txn_ref}\\n\\n"
                    f"Your hospital bill ledger has been updated successfully."
                )'''

assert old_pay_exec in content, "old_pay_exec not found"
content = content.replace(old_pay_exec, new_pay_exec, 1)
print("10. Updated Bill payment execution for authoritative balance and idempotency")

# 11. Add BILLING_AND_PAYMENTS and PATIENT_DOCUMENTS to process_agent_message end intent router
old_end_router = '''    elif intent == "PATIENT_REPORTS":
        return process_agent_message(conversation_code, patient_code, "btn_my_reports", current_lang, "btn_my_reports")'''

new_end_router = '''    elif intent == "PATIENT_REPORTS":
        return process_agent_message(conversation_code, patient_code, "btn_my_reports", current_lang, "btn_my_reports")

    elif intent in ("BILLING_AND_PAYMENTS", "BILLING", "PAYMENT"):
        return process_agent_message(conversation_code, patient_code, "btn_cat_billing", current_lang, "btn_cat_billing")

    elif intent in ("PATIENT_DOCUMENTS", "DISCHARGE_SUMMARY"):
        return process_agent_message(conversation_code, patient_code, "btn_my_documents", current_lang, "btn_my_documents")'''

assert old_end_router in content, "old_end_router not found"
content = content.replace(old_end_router, new_end_router, 1)
print("11. Added intent mapping for billing and documents at end of process_agent_message")

with open(target_file, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: agent_service.py has been updated. New length:", len(content))
