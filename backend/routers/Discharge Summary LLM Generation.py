# Databricks notebook source
# /// script
# [tool.databricks.environment]
# environment_version = "5"
# ///
# DBTITLE 1,Discharge Summary LLM Generation
# MAGIC %md
# MAGIC # Discharge Summary Generation with LLM
# MAGIC
# MAGIC This notebook generates discharge summaries for **multiple patients** using an LLM model and validates them against expected outputs.
# MAGIC
# MAGIC ## Workflow
# MAGIC
# MAGIC 1. **Enter `patient_id`** in the widget — comma-separated IDs (e.g. `2,3,4,5,6`) or `all` for every currently admitted patient
# MAGIC 2. **Retrieve LLM input** from `health_care.gold.dim_admission_inputs` (currently admitted patients). If a patient is not in gold (already discharged), it falls back to `health_care.silver.discharge_summary_input` to build the same LLM input format from clinical data.
# MAGIC 3. **Retrieve expected output** from `health_care.bronze.discharge_summaries` (the reference discharge summary for comparison).
# MAGIC 4. **Send all LLM inputs** to `databricks-meta-llama-3-3-70b-instruct` via `ai_query()` in a single batch.
# MAGIC 5. **Parse the LLM responses** into structured fields: Diagnoses, Case History, Investigations, Treatment, Primary Consultant, Discharge Advice, Surgery Details, Patient Condition.
# MAGIC 6. **Compare** each generated output field-by-field against the expected output.
# MAGIC 7. **Store** all LLM-generated discharge summaries in `health_care.gold.dim_generated_discharge_summaries` with the same schema as `health_care.bronze.discharge_summaries`.

# COMMAND ----------

# DBTITLE 1,Widget: Enter patient IDs
# ──────────────────────────────────────────────────────────────────────
# CELL 1: Widget — Enter patient IDs (comma-separated or 'all')
# ──────────────────────────────────────────────────────────────────────

dbutils.widgets.text("patient_id", "all", "Enter Patient IDs (comma-separated or 'all')")

patient_id_input = dbutils.widgets.get("patient_id").strip()

if not patient_id_input:
    print("Please enter Patient IDs in the widget at the top of the notebook.")
    print("  • Comma-separated IDs: 2,3,4,5,6")
    print("  • 'all' for every currently admitted patient in gold table")
    print("Test patient_ids from discharged patients (with expected output): 2, 3, 4, 5, 6")
    print("Test patient_ids from currently admitted patients (gold table): 87224, 87225, 87226")
elif patient_id_input.lower() == "all":
    patient_ids = "all"
    print("Mode: ALL admitted patients from gold table")
else:
    patient_ids = [int(x.strip()) for x in patient_id_input.split(",") if x.strip()]
    print(f"Patient IDs entered: {patient_ids} ({len(patient_ids)} patients)")

# COMMAND ----------

# DBTITLE 1,Retrieve LLM input and expected output for all patients
# ─────────────────────────────────────────────────────────────────────
# CELL 2: Retrieve LLM input and expected output for ALL patients
# ─────────────────────────────────────────────────────────────────────
from pyspark.sql import functions as F

# ── Helper: build LLM input text from a silver table row ──
def build_silver_llm_input(r):
    """Build the same LLM input text format as the gold table from a silver row dict."""
    # Patient demographics section
    patient_section = "--- PATIENT DEMOGRAPHICS ---\n"
    patient_section += f"Name: {r['first_name']} {r['last_name']}\n"
    patient_section += f"Gender: {r['gender']}, Age: {r['age_at_admission']} years\n"
    patient_section += f"Blood Group: {r['blood_group']}, DOB: {r['date_of_birth']}\n"
    patient_section += f"Marital Status: {r['marital_status']}, Language: {r['preferred_language']}\n"
    patient_section += f"Phone: {r['phone']} | Email: {r['email']}\n"
    patient_section += f"Address: {r['address']}, {r['city']}, {r['state']}, {r['postal_code']}\n"
    patient_section += f"Emergency Contact: {r['emergency_contact_name']} {r['emergency_contact_phone']}"

    # Admission details section
    admission_section = "--- ADMISSION DETAILS ---\n"
    admission_section += f"Admission Number: {r['admission_number']}\n"
    admission_section += f"Admission Date: {r['admission_date']}, Discharge Date: {r['discharge_date']}\n"
    admission_section += f"Admission Type: {r['admission_type']}, Source: {r['admission_source']}\n"
    admission_section += f"Reason for Admission: {r['reason_for_admission']}\n"
    admission_section += f"Discharge Status: {r['discharge_status']}, Length of Stay: {r['length_of_stay_days']} days\n"
    admission_section += f"Attending Doctor: {r['attending_doctor']}, Specialization: {r['doctor_specialization']}\n"
    admission_section += f"Doctor Qualification: {r['doctor_qualification']}"

    # Diagnoses section
    diag_lines = []
    if r['diagnoses_list']:
        for d in r['diagnoses_list']:
            primary_flag = "PRIMARY" if d['is_primary'] else "secondary"
            diag_lines.append(f"{d['diagnosis_code']} | {d['diagnosis_name']} | {d['diagnosis_type']} | {primary_flag}")
    diagnoses_section = "--- DIAGNOSES ---\n"
    diagnoses_section += f"Primary Diagnosis: {r['primary_diagnosis']}\n"
    diagnoses_section += f"Secondary Diagnoses: {'; '.join(r['secondary_diagnoses']) if r['secondary_diagnoses'] else ''}\n"
    diagnoses_section += "All Diagnoses:\n - " + "\n - ".join(diag_lines)

    # Medications section - emphasize dosage/volume
    med_lines = []
    if r['medications_list']:
        for m in r['medications_list']:
            med_lines.append(f"{m['medication_name']} ({m['generic_name']}) - DOSAGE: {m['dosage']} - {m['frequency']} - {m['route']} - Duration: {m['duration']} - {m['instructions']}")
    medications_section = "--- MEDICATIONS (with dosage/volume) ---\n" + ("\n - ".join(med_lines) if med_lines else "")

    # Lab results section
    lab_lines = []
    if r['lab_results_list']:
        for l in r['lab_results_list']:
            flag = "ABNORMAL" if l['abnormal_flag'] else "normal"
            lab_lines.append(f"{l['test_parameter']} | {l['result_value']} | {l['unit']} | Ref:{l['reference_range']} | {flag} | {l['priority']}")
    labs_section = "--- LAB RESULTS ---\n" + ("\n - ".join(lab_lines) if lab_lines else "")

    # Procedures section
    proc_lines = []
    if r['procedures_list']:
        for p in r['procedures_list']:
            proc_lines.append(f"{p['procedure_code']} | {p['procedure_name']} | {p['procedure_date']} | {p['status']} | {p['notes']}")
    procedures_section = "--- PROCEDURES ---\n" + ("\n - ".join(proc_lines) if proc_lines else "")

    # Vital signs section
    vit_lines = []
    if r['vital_signs_list']:
        for v in r['vital_signs_list']:
            vit_lines.append(f"{v['recorded_at']} | Temp:{v['temperature']}F | HR:{v['heart_rate']}bpm | {v['systolic_bp']}/{v['diastolic_bp']} | RR:{v['respiratory_rate']}/min | SpO2:{v['oxygen_saturation']}% | Wt:{v['weight']}kg")
    vitals_section = "--- VITAL SIGNS ---\n"
    vitals_section += f"Latest Vitals: Temp:{r['latest_temperature']}F, HR:{r['latest_heart_rate']}bpm, {r['latest_systolic_bp']}/{r['latest_diastolic_bp']}mmHg, SpO2:{r['latest_oxygen_saturation']}%\n"
    vitals_section += "All Vital Sign Records:\n - " + "\n - ".join(vit_lines)

    separator = "=" * 80
    return "\n\n".join([
        "You are a medical AI assistant. Below is the clinical data for a patient. Generate a comprehensive discharge summary.",
        separator,
        patient_section,
        admission_section,
        diagnoses_section,
        medications_section,
        labs_section,
        procedures_section,
        vitals_section,
        separator,
    ])


# ── Resolve the list of patient IDs to process ──
if patient_id_input and patient_id_input.lower() != "all":
    pid_list = [int(x.strip()) for x in patient_id_input.split(",") if x.strip()]
elif patient_ids == "all":
    # Get all patient_ids from the gold table (currently admitted)
    pid_list = [row['patient_id'] for row in spark.sql(
        "SELECT DISTINCT patient_id FROM health_care.gold.dim_admission_inputs ORDER BY patient_id"
    ).collect()]
    print(f"Found {len(pid_list)} admitted patients in gold table")
else:
    pid_list = []

# ── Process each patient ──
patients = []  # List of dicts: {patient_id, admission_id, source, llm_input_text, existing_fields, expected}

print(f"\n{'=' * 80}")
print(f"Processing {len(pid_list)} patient(s)...")
print(f"{'=' * 80}")

for idx, pid in enumerate(pid_list, 1):
    print(f"\n── Patient {idx}/{len(pid_list)}: patient_id={pid} ──")
    p = {'patient_id': pid, 'admission_id': None, 'source': None,
         'llm_input_text': None, 'existing_fields': {}, 'expected': None}

    # ── Step 1: Try GOLD table (currently admitted patients) ──
    gold_row = spark.sql(f"""
        SELECT admission_id, patient_id, first_name, last_name,
               admission_date, discharge_status, primary_diagnosis,
               attending_doctor, llm_input, llm_input_json
        FROM health_care.gold.dim_admission_inputs
        WHERE patient_id = {pid}
        LIMIT 1
    """).collect()

    if gold_row:
        row = gold_row[0]
        p['source'] = "gold (currently admitted)"
        p['admission_id'] = row['admission_id']
        p['llm_input_text'] = row['llm_input']
        p['existing_fields'] = {}  # gold patients have no existing DS fields
        print(f"  ✓ Found in {p['source']}")
        print(f"    Patient: {row['first_name']} {row['last_name']}")
        print(f"    Admission ID: {p['admission_id']}, Status: {row['discharge_status']}")
        print(f"    Primary Diagnosis: {row['primary_diagnosis']}")
        print(f"    Existing DS fields: 0/8 (patient not discharged yet)")
    else:
        # ── Step 2: Fall back to SILVER table (discharged patients) ──
        silver_row = spark.sql(f"""
            SELECT admission_id, patient_id, first_name, last_name,
                   admission_date, discharge_date, discharge_status,
                   primary_diagnosis, attending_doctor, age_at_admission,
                   gender, blood_group, date_of_birth, marital_status,
                   preferred_language, phone, email, address, city, state, postal_code,
                   emergency_contact_name, emergency_contact_phone,
                   admission_number, admission_type, admission_source,
                   reason_for_admission, length_of_stay_days,
                   doctor_specialization, doctor_qualification,
                   diagnoses_list, secondary_diagnoses,
                   medications_list, lab_results_list, procedures_list,
                   vital_signs_list,
                   latest_temperature, latest_heart_rate,
                   latest_systolic_bp, latest_diastolic_bp, latest_oxygen_saturation,
                   existing_ds_diagnoses, existing_ds_case_history,
                   existing_ds_investigations, existing_ds_treatment,
                   existing_ds_primary_consultant, existing_ds_discharge_advice,
                   existing_ds_surgery_details, existing_ds_patient_condition
            FROM health_care.silver.discharge_summary_input
            WHERE patient_id = {pid}
            LIMIT 1
        """).collect()

        if silver_row:
            r = silver_row[0]
            p['source'] = "silver (discharged)"
            p['admission_id'] = r['admission_id']
            p['llm_input_text'] = build_silver_llm_input(r)
            p['existing_fields'] = {
                'diagnoses': r['existing_ds_diagnoses'],
                'case_history': r['existing_ds_case_history'],
                'investigations': r['existing_ds_investigations'],
                'treatment': r['existing_ds_treatment'],
                'primary_consultant': r['existing_ds_primary_consultant'],
                'discharge_advice': r['existing_ds_discharge_advice'],
                'surgery_details': r['existing_ds_surgery_details'],
                'patient_condition': r['existing_ds_patient_condition']
            }
            filled = sum(1 for v in p['existing_fields'].values()
                        if v and str(v).strip() and str(v).strip().lower() not in ['null', 'none', 'n/a'])
            print(f"  ✓ Found in {p['source']}")
            print(f"    Patient: {r['first_name']} {r['last_name']}")
            print(f"    Admission ID: {p['admission_id']}, Discharge: {r['discharge_date']}")
            print(f"    Primary Diagnosis: {r['primary_diagnosis']}")
            print(f"    Existing DS fields: {filled}/8 available")
        else:
            print(f"  ✗ Patient ID {pid} not found in gold or silver tables.")

    # ── Step 3: Retrieve expected output from bronze.discharge_summaries ──
    if p['admission_id']:
        ds_row = spark.sql(f"""
            SELECT diagnoses, case_history, investigations, treatment,
                   primary_consultant, discharge_advice, surgery_details,
                   patient_condition, generated_at
            FROM health_care.bronze.discharge_summaries
            WHERE admission_id = {p['admission_id']}
            ORDER BY generated_at DESC
            LIMIT 1
        """).collect()

        if ds_row:
            p['expected'] = ds_row[0].asDict()
            print(f"  ✓ Expected output found (generated at: {p['expected']['generated_at']})")
        else:
            print(f"  ℹ No expected output (currently admitted — no reference discharge summary)")

    if p['llm_input_text']:
        patients.append(p)

print(f"\n{'=' * 80}")
print(f"Summary: {len(patients)}/{len(pid_list)} patients ready for LLM generation")
print(f"  Gold (admitted): {sum(1 for p in patients if p['source'] == 'gold (currently admitted)')}")
print(f"  Silver (discharged): {sum(1 for p in patients if p['source'] == 'silver (discharged)')}")
print(f"  With expected output: {sum(1 for p in patients if p['expected'])}")
print(f"{'=' * 80}")

# COMMAND ----------

# DBTITLE 1,Batch LLM generation for all patients
# ─────────────────────────────────────────────────────────────────────
# CELL 3: Send ALL LLM inputs to the model in a single batch
# ─────────────────────────────────────────────────────────────────────
import json
import re

field_descriptions = {
    'diagnoses': 'List all diagnoses with codes and descriptions',
    'case_history': 'Detailed clinical history including presenting complaint, past medical history, and course of treatment',
    'investigations': 'All lab results, imaging, and diagnostic investigations with values and interpretations',
    'treatment': 'All treatments given during hospitalization including medications WITH EXACT DOSAGE/VOLUME (e.g., 500mg, 10ml), frequency, route, procedures, and interventions. ALWAYS include medication dosage/volume.',
    'primary_consultant': 'Name of the primary attending doctor',
    'discharge_advice': 'Advice and instructions given to patient at discharge including medications WITH DOSAGE/VOLUME, diet, activity, and follow-up',
    'surgery_details': "Details of any surgical procedures performed, or 'Nil' if none",
    'patient_condition': "Patient's condition at discharge including vital signs and overall status"
}

def build_prompt(patient):
    """Build an LLM prompt for a single patient, only asking for missing fields."""
    existing_fields = patient['existing_fields']
    fields_to_generate = []
    for field, desc in field_descriptions.items():
        val = existing_fields.get(field)
        if not val or str(val).strip() == '' or str(val).strip().lower() in ['null', 'none', 'n/a']:
            fields_to_generate.append((field, desc))

    if not fields_to_generate:
        return None  # All fields already exist

    system_instruction = f"""You are a medical AI assistant specializing in generating discharge summaries.

Based on the patient clinical data provided below, generate ONLY the following missing discharge summary fields:

"""
    json_fields = []
    for field, desc in fields_to_generate:
        system_instruction += f"- {field}: {desc}\n"
        json_fields.append(f'  "{field}": "..."')

    system_instruction += f"""

You MUST output ONLY a valid JSON object with EXACTLY these {len(fields_to_generate)} field(s):
{{
""" + ",\n".join(json_fields) + """
}

Do NOT include any text before or after the JSON. Output ONLY the JSON object.
Do NOT generate fields that are not listed above.
"""

    return system_instruction + "\n" + patient['llm_input_text'], fields_to_generate

def parse_llm_json(raw_response):
    """Parse LLM response as JSON, handling markdown code blocks and extraction."""
    if not raw_response:
        return {}
    clean = raw_response.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        clean = "\n".join(lines)
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
    return {}

if not patients:
    print("No patients with LLM input available. Please run the data retrieval cell above first.")
else:
    # ── Build prompts for all patients that need LLM generation ──
    prompt_rows = []  # (row_id, prompt_text)
    patients_needing_llm = []  # parallel list of (patient, fields_to_generate)

    for i, p in enumerate(patients):
        result = build_prompt(p)
        if result is None:
            print(f"Patient {p['patient_id']}: All 8 fields already exist — skipping LLM")
            p['parsed_output'] = p['existing_fields'].copy()
            p['llm_skipped'] = True
        else:
            prompt_text, fields_to_gen = result
            prompt_rows.append((i, prompt_text))
            patients_needing_llm.append((p, fields_to_gen))
            print(f"Patient {p['patient_id']}: {len(fields_to_gen)}/8 fields to generate via LLM")

    # ── Batch call ai_query for all prompts at once ──
    if prompt_rows:
        print(f"\n{'=' * 80}")
        print(f"Sending {len(prompt_rows)} prompts to databricks-meta-llama-3-3-70b-instruct (batch)...")
        print(f"{'=' * 80}")

        prompt_df_data = [(row_id, prompt) for row_id, prompt in prompt_rows]
        spark.createDataFrame(prompt_df_data, ["row_id", "prompt"]).createOrReplaceTempView("_batch_llm_prompts")

        try:
            batch_results = spark.sql("""
                SELECT row_id,
                       ai_query(
                           'databricks-meta-llama-3-3-70b-instruct',
                           prompt,
                           map('temperature', '0.3', 'max_tokens', '2000')
                       ) as response
                FROM _batch_llm_prompts
            """).collect()

            print(f"\n✓ Received {len(batch_results)} LLM responses")

            for row in batch_results:
                row_id = row['row_id']
                response_text = row['response']
                p = patients[row_id]
                p['llm_response'] = response_text

                llm_generated = parse_llm_json(response_text)
                if llm_generated:
                    p['parsed_output'] = p['existing_fields'].copy()
                    p['parsed_output'].update(llm_generated)
                    print(f"  ✓ Patient {p['patient_id']}: parsed {len(llm_generated)} LLM fields")
                else:
                    p['parsed_output'] = p['existing_fields'].copy()
                    print(f"  ⚠ Patient {p['patient_id']}: could not parse JSON, using existing fields only")
                    print(f"    Raw response (first 500 chars): {str(response_text)[:500]}")

        except Exception as e:
            print(f"\n✗ Batch LLM call failed: {e}")
            for p, _ in patients_needing_llm:
                p['parsed_output'] = p['existing_fields'].copy()
    else:
        print("\nAll patients have complete discharge summaries — no LLM generation needed.")

    # ── Summary ──
    print(f"\n{'=' * 80}")
    print(f"LLM Generation Summary:")
    for p in patients:
        if p.get('llm_skipped'):
            print(f"  Patient {p['patient_id']}: skipped (all fields from existing data)")
        elif p.get('parsed_output'):
            llm_count = len([k for k in p['parsed_output'] if k not in p['existing_fields'] or not p['existing_fields'].get(k)])
            print(f"  Patient {p['patient_id']}: ✓ {len(p['parsed_output'])} total fields ({llm_count} from LLM)")
        else:
            print(f"  Patient {p['patient_id']}: ✗ no output generated")
    print(f"{'=' * 80}")

# COMMAND ----------

# DBTITLE 1,Compare all patients' generated vs expected
# ─────────────────────────────────────────────────────────────────────
# CELL 4: Compare generated output against expected output for ALL patients
# ─────────────────────────────────────────────────────────────────────

def field_similarity(expected_text, generated_text):
    """Simple word-overlap similarity between expected and generated text."""
    if not expected_text and not generated_text:
        return 1.0
    if not expected_text or not generated_text:
        return 0.0
    expected_words = set(expected_text.lower().split())
    generated_words = set(generated_text.lower().split())
    if not expected_words:
        return 0.0
    overlap = expected_words & generated_words
    return len(overlap) / len(expected_words)

fields = [
    ("diagnoses", "Diagnoses"),
    ("case_history", "Case History"),
    ("investigations", "Investigations"),
    ("treatment", "Treatment"),
    ("primary_consultant", "Primary Consultant"),
    ("discharge_advice", "Discharge Advice"),
    ("surgery_details", "Surgery Details"),
    ("patient_condition", "Patient Condition"),
]

if not patients or not any(p.get('parsed_output') for p in patients):
    print("No output to compare. Please run the previous cells first.")
else:
    all_similarities = []

    for p in patients:
        parsed_output = p.get('parsed_output')
        expected = p.get('expected')
        existing_fields = p.get('existing_fields', {})

        if not parsed_output:
            continue

        existing_count = sum(1 for k, v in existing_fields.items() if v and str(v).strip() and str(v).strip().lower() not in ['null', 'none', 'n/a'])
        llm_count = len([k for k, v in parsed_output.items() if k not in existing_fields or not existing_fields.get(k) or str(existing_fields.get(k)).strip() == '' or str(existing_fields.get(k)).strip().lower() in ['null', 'none', 'n/a']])

        print(f"\n{'=' * 80}")
        print(f"Patient ID: {p['patient_id']} | Admission ID: {p['admission_id']} | Source: {p['source']}")
        print(f"{'=' * 80}")

        if expected:
            print(f"Comparison: Generated vs Expected | Data Source: {existing_count} existing + {llm_count} LLM")
            print(f"{'=' * 80}")

            similarities = []
            for field_key, field_label in fields:
                exp_val = expected.get(field_key, "") or ""
                gen_val = parsed_output.get(field_key, "") or ""
                sim = field_similarity(str(exp_val), str(gen_val))
                similarities.append(sim)

                is_existing = existing_fields.get(field_key) and str(existing_fields[field_key]).strip() and str(existing_fields[field_key]).strip().lower() not in ['null', 'none', 'n/a']
                source_tag = "[FROM DATA]" if is_existing else "[FROM LLM]"
                match_icon = "✓" if sim >= 0.5 else "~" if sim >= 0.2 else "✗"
                print(f"\n{'─' * 80}")
                print(f"{match_icon} {field_label} {source_tag} (similarity: {sim:.0%})")
                print(f"{'─' * 80}")
                print(f"  EXPECTED:   {str(exp_val)[:300]}")
                print(f"  GENERATED:  {str(gen_val)[:300]}")

            overall = sum(similarities) / len(similarities)
            all_similarities.append(overall)
            assessment = "GOOD MATCH" if overall >= 0.5 else ("PARTIAL MATCH" if overall >= 0.3 else "LOW MATCH")
            print(f"\n{'=' * 80}")
            print(f"OVERALL SIMILARITY: {overall:.0%} — {assessment}")
            print(f"{'=' * 80}")
        else:
            print(f"No expected output (currently admitted — no reference discharge summary)")
            print(f"Data Source: {existing_count} existing + {llm_count} LLM")
            print(f"{'=' * 80}")
            for key, label in fields:
                val = parsed_output.get(key, "") or ""
                is_existing = existing_fields.get(key) and str(existing_fields[key]).strip() and str(existing_fields[key]).strip().lower() not in ['null', 'none', 'n/a']
                source_tag = "[FROM DATA]" if is_existing else "[FROM LLM]"
                print(f"\n{'─' * 80}")
                print(f"{label} {source_tag}:")
                print(f"{'─' * 80}")
                print(f"  {val}")

    # ── Overall summary across all patients ──
    if all_similarities:
        avg_sim = sum(all_similarities) / len(all_similarities)
        print(f"\n{'=' * 80}")
        print(f"BATCH SUMMARY: {len(all_similarities)} patient(s) with expected output")
        print(f"  Average similarity across all patients: {avg_sim:.0%}")
        for i, p in enumerate(patients):
            if p.get('expected') and i < len(all_similarities):
                print(f"    Patient {p['patient_id']}: {all_similarities[i]:.0%}")
        print(f"{'=' * 80}")

def field_similarity(expected_text, generated_text):
    """Simple word-overlap similarity between expected and generated text."""
    if not expected_text and not generated_text:
        return 1.0
    if not expected_text or not generated_text:
        return 0.0
    expected_words = set(expected_text.lower().split())
    generated_words = set(generated_text.lower().split())
    if not expected_words:
        return 0.0
    overlap = expected_words & generated_words
    return len(overlap) / len(expected_words)



# COMMAND ----------

# DBTITLE 1,Store all LLM outputs in gold table
# ─────────────────────────────────────────────────────────────────────
# CELL 5: Store ALL LLM-generated discharge summaries in gold table
#         (same schema as health_care.bronze.discharge_summaries)
# ─────────────────────────────────────────────────────────────────────
from delta.tables import DeltaTable
from datetime import datetime, timezone, timedelta

# Use IST (Indian Standard Time = UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

input_table = "health_care.gold.dim_admission_inputs"
output_table = "health_care.gold.dim_generated_discharge_summaries"

# Collect all patients that have parsed output
patients_to_store = [p for p in patients if p.get('parsed_output') and p.get('admission_id')]

if not patients_to_store:
    print("No parsed LLM output to store. Please run the LLM generation cell first.")
else:
    print(f"Storing discharge summaries for {len(patients_to_store)} patient(s)...\n")

    # ── Step 1: Get admission metadata for all patients at once ──
    admission_ids = [p['admission_id'] for p in patients_to_store]
    aid_list_str = ",".join(str(aid) for aid in admission_ids)

    meta_rows = spark.sql(f"""
        SELECT g.admission_id, g.patient_id, g.admission_date,
               a.doctor_id
        FROM {input_table} g
        JOIN health_care.bronze.admissions a ON g.admission_id = a.admission_id
        WHERE g.admission_id IN ({aid_list_str})
    """).collect()

    meta_map = {row['admission_id']: row for row in meta_rows}

    # ── Step 2: Build a DataFrame with all patient records ──
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    now = now_utc + timedelta(hours=5, minutes=30)  # IST

    gen_data = []
    gen_schema = """
        summary_id LONG, admission_id LONG, patient_id LONG, doctor_id LONG,
        admission_date TIMESTAMP, discharge_date TIMESTAMP,
        diagnoses STRING, case_history STRING, investigations STRING,
        treatment STRING, primary_consultant STRING, discharge_advice STRING,
        surgery_details STRING, patient_condition STRING,
        generated_at TIMESTAMP, ingestion_timestamp TIMESTAMP,
        source_system STRING, source_table STRING, bronze_ingestion_time TIMESTAMP
    """

    for p in patients_to_store:
        aid = p['admission_id']
        po = p['parsed_output']
        m = meta_map.get(aid)

        if not m:
            print(f"  ✗ Could not find admission metadata for admission_id={aid} (patient_id={p['patient_id']})")
            continue

        gen_data.append((
            aid,                                                    # summary_id
            aid,                                                    # admission_id
            m['patient_id'],                                        # patient_id
            m['doctor_id'],                                         # doctor_id
            m['admission_date'],                                    # admission_date
            now,                                                    # discharge_date
            po.get("diagnoses", ""),                                 # diagnoses
            po.get("case_history", ""),                             # case_history
            po.get("investigations", ""),                           # investigations
            po.get("treatment", ""),                                # treatment
            po.get("primary_consultant", ""),                      # primary_consultant
            po.get("discharge_advice", ""),                         # discharge_advice
            po.get("surgery_details", ""),                          # surgery_details
            po.get("patient_condition", ""),                        # patient_condition
            now,                                                    # generated_at
            now,                                                    # ingestion_timestamp
            "LLM",                                                  # source_system
            "databricks-meta-llama-3-3-70b-instruct",              # source_table
            now,                                                    # bronze_ingestion_time
        ))
        print(f"  ✓ Prepared record for admission_id={aid} (patient_id={p['patient_id']})")

    if not gen_data:
        print("\n✗ No records to store (no admission metadata found for any patient).")
    else:
        gen_df = spark.createDataFrame(gen_data, schema=gen_schema)

        # ── Step 3: Create table or batch MERGE ──
        if not spark.catalog.tableExists(output_table):
            print(f"\nCreating new table: {output_table}")
            (gen_df.write
                .format("delta")
                .mode("overwrite")
                .option("overwriteSchema", "true")
                .saveAsTable(output_table)
            )
            print(f"  ✓ Created with {len(gen_data)} record(s)")
        else:
            # MERGE (UPSERT) on admission_id for all records at once
            gold_delta = DeltaTable.forName(spark, output_table)

            (gold_delta.alias("target")
                .merge(
                    gen_df.alias("source"),
                    "target.admission_id = source.admission_id"
                )
                .whenMatchedUpdate(set={
                    "discharge_date": "source.discharge_date",
                    "diagnoses": "source.diagnoses",
                    "case_history": "source.case_history",
                    "investigations": "source.investigations",
                    "treatment": "source.treatment",
                    "primary_consultant": "source.primary_consultant",
                    "discharge_advice": "source.discharge_advice",
                    "surgery_details": "source.surgery_details",
                    "patient_condition": "source.patient_condition",
                    "generated_at": "source.generated_at",
                    "ingestion_timestamp": "source.ingestion_timestamp",
                    "bronze_ingestion_time": "source.bronze_ingestion_time",
                })
                .whenNotMatchedInsertAll()
                .execute()
            )
            print(f"\n  ✓ Merged {len(gen_data)} record(s) into {output_table}")

        # ── Step 4: Verify ──
        print(f"\n=== Verification: {output_table} ===")
        spark.sql(f"""
            SELECT admission_id, patient_id, doctor_id, admission_date,
                   diagnoses, primary_consultant, patient_condition,
                   generated_at, source_system
            FROM {output_table}
            WHERE admission_id IN ({aid_list_str})
            ORDER BY admission_id
        """).show(truncate=False, n=len(gen_data))

        print(f"=== Total records in {output_table} ===")
        spark.sql(f"SELECT COUNT(*) as total FROM {output_table}").show()
from delta.tables import DeltaTable
from datetime import datetime, timezone, timedelta

# Use IST (Indian Standard Time = UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Source gold table (LLM inputs)
input_table = "health_care.gold.dim_admission_inputs"

# NEW output table — same schema as bronze.discharge_summaries
output_table = "health_care.gold.dim_generated_discharge_summaries"

