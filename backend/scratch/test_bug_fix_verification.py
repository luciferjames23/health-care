import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.patient_360_service import (
    resolve_patient_id,
    get_patient_authorized_reports,
    get_patient_clinical_overview,
    get_xray_scan_details,
    get_xray_image_bytes,
    get_discharge_summary_details,
    generate_discharge_summary_pdf
)
from agent.agent_service import process_agent_message

def run_tests():
    print("=== TEST 1: Patient Code and ID Resolution ===")
    pid1 = resolve_patient_id("P1000019")
    pid2 = resolve_patient_id(1004434)
    print(f"P1000019 -> {pid1}, 1004434 -> {pid2}")
    assert pid1 == 1004434, f"Expected 1004434, got {pid1}"
    assert pid2 == 1004434, f"Expected 1004434, got {pid2}"

    print("\n=== TEST 2: Reports Summary Counts ===")
    rep = get_patient_authorized_reports("P1000019")
    print(f"xray_count: {rep.get('xray_count')}")
    print(f"discharge_count: {rep.get('discharge_count')}")
    print(f"total_count: {rep.get('total_count')}")
    assert rep.get("xray_count") == 2, f"Expected 2 X-rays, got {rep.get('xray_count')}"
    assert rep.get("discharge_count") == 3, f"Expected 3 discharge summaries, got {rep.get('discharge_count')}"
    assert rep.get("total_count") == 5, f"Expected 5 total records, got {rep.get('total_count')}"

    print("\n=== TEST 3: Clinical Records Retrieval ===")
    clin = get_patient_clinical_overview("P1000019")
    print(f"encounters: {len(clin.get('encounters', []))}")
    print(f"diagnoses: {len(clin.get('diagnoses', []))}")
    print(f"prescriptions: {len(clin.get('prescriptions', []))}")
    assert len(clin.get("encounters", [])) == 2, f"Expected 2 encounters, got {len(clin.get('encounters', []))}"
    assert len(clin.get("diagnoses", [])) >= 2, f"Expected >=2 diagnoses, got {len(clin.get('diagnoses', []))}"

    print("\n=== TEST 4: Agent Dialog - btn_my_reports ===")
    conv_code = "WA_8072851813_TEST"
    import agent.state_manager as state_manager
    state_manager.clear_conversation_state(conv_code)

    # First trigger prompts multi-patient selection for phone 8072851813
    res_prompt = process_agent_message(conv_code, "P1000019", "btn_my_reports", "ENGLISH", interactive_id="btn_my_reports")
    assert any("btn_select_pat_1004434" in b.get("id", "") for b in res_prompt.get("interactive_buttons", [])), "Profile selection prompt failed!"

    # Select Jacky K (1004434)
    res_rep = process_agent_message(conv_code, "P1000019", "btn_select_pat_1004434", "ENGLISH", interactive_id="btn_select_pat_1004434")
    print(f"Response: {res_rep.get('response')[:150]}...")
    assert "X-Ray & Radiology Scans: 2 available" in res_rep.get("response"), "Missing 2 X-rays in summary!"
    assert "Discharge Summaries: 3 available" in res_rep.get("response"), "Missing 3 discharge summaries in summary!"

    print("\n=== TEST 5: Agent Dialog - btn_cat_discharge ===")
    res_dis_cat = process_agent_message(conv_code, "P1000019", "btn_cat_discharge", "ENGLISH", interactive_id="btn_cat_discharge")
    print(f"Response: {res_dis_cat.get('response')[:150]}...")
    buttons = res_dis_cat.get("interactive_buttons", [])
    print(f"Buttons: {[b.get('id') for b in buttons]}")
    assert any("btn_discharge_87524" == b.get("id") for b in buttons), "btn_discharge_87524 missing!"
    assert any("btn_discharge_87519" == b.get("id") for b in buttons), "btn_discharge_87519 missing!"
    assert any("btn_discharge_90057" == b.get("id") for b in buttons), "btn_discharge_90057 missing!"

    print("\n=== TEST 6: Agent Dialog - btn_discharge_87524 ===")
    res_dis_single = process_agent_message(conv_code, "P1000019", "btn_discharge_87524", "ENGLISH", interactive_id="btn_discharge_87524")
    print(f"Response: {res_dis_single.get('response')[:150]}...")
    assert "Inpatient Discharge Record" in res_dis_single.get("response"), "Discharge record not in response!"
    assert any("btn_send_discharge_pdf_87524" == b.get("id") for b in res_dis_single.get("interactive_buttons", [])), "Download PDF button missing!"

    print("\n=== TEST 7: Agent Dialog - btn_send_discharge_pdf_87524 ===")
    res_pdf = process_agent_message(conv_code, "P1000019", "btn_send_discharge_pdf_87524", "ENGLISH", interactive_id="btn_send_discharge_pdf_87524")
    print(f"PDF media_document: {res_pdf.get('media_document')}")
    assert res_pdf.get("media_document") and os.path.exists(res_pdf.get("media_document")), "PDF file does not exist!"

    print("\n=== TEST 8: Agent Dialog - btn_cat_xrays ===")
    res_xray_cat = process_agent_message(conv_code, "P1000019", "btn_cat_xrays", "ENGLISH", interactive_id="btn_cat_xrays")
    print(f"Response: {res_xray_cat.get('response')[:150]}...")
    xray_buttons = res_xray_cat.get("interactive_buttons", [])
    print(f"Buttons: {[b.get('id') for b in xray_buttons]}")
    assert any("btn_xray_144" == b.get("id") for b in xray_buttons), "btn_xray_144 missing!"
    assert any("btn_xray_145" == b.get("id") for b in xray_buttons), "btn_xray_145 missing!"

    print("\n=== TEST 9: Agent Dialog - btn_send_xray_image_144 ===")
    res_img = process_agent_message(conv_code, "P1000019", "btn_send_xray_image_144", "ENGLISH", interactive_id="btn_send_xray_image_144")
    print(f"Image media_image: {res_img.get('media_image')}")
    assert res_img.get("media_image") and os.path.exists(res_img.get("media_image")), "Image file does not exist!"
    assert os.path.getsize(res_img.get("media_image")) > 400000, f"Image size too small: {os.path.getsize(res_img.get('media_image'))}"

    print("\n=== TEST 10: Agent Dialog - btn_clinical_records ===")
    res_clin = process_agent_message(conv_code, "P1000019", "btn_clinical_records", "ENGLISH", interactive_id="btn_clinical_records")
    print(f"Response: {res_clin.get('response')[:150]}...")
    assert "issue processing your request" not in res_clin.get("response"), "Failed clinical records request!"
    assert "Hair Fall problem" in res_clin.get("response"), "Hair Fall diagnosis missing!"
    assert "Heart Transplant" in res_clin.get("response"), "Heart Transplant diagnosis missing!"
    assert "Meridian Hospital Patient 360" in res_clin.get("response"), "Patient 360 footer missing!"

    print("\n=== ALL 10 BUG VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
