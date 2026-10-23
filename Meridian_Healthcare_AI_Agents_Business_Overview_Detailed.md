# Meridian Healthcare Agents and Workflows

- **Purpose:** Simple business overview with each capability’s purpose, solution, model, and measured or recorded performance.
- **Review date:** 21 October 2026.
- **Score rule:** A code-test pass rate measures tested software behavior; it is not clinical or model accuracy.

## AI Agents

### AI Trainer — hospital protocol assistant

- **Classification:** Retrieval-augmented AI assistant.
- **Objective:** Help staff find approved protocol guidance with a source citation.
- **Problem solved:** Staff lose time searching long procedures and may use outdated or unsourced guidance.
- **Solution:** Search protocol sections, return grounded answers and citations, and abstain when evidence is missing.
- **Model:** Llama 3.3 70B Versatile configured for answer generation; local deterministic embeddings were used in this evaluation.
- **Why this approach:** Retrieve local policy first, then use a language model to explain the retrieved evidence.
- **Public model benchmark:** Llama 3.3 70B Instruct reports MMLU 86.0%, GPQA Diamond 50.5%, MMLU-Pro 68.9%; these are general benchmarks, not hospital protocol accuracy.
- **System test set:** 8 synthetic demo protocols, 27 sections, 24 answerable questions, 8 no-answer questions, 6 high-alert wordings, 5 out-of-scope requests.
- **Measured retrieval:** Expected protocol ranked first in 22/24 cases (91.7%); in top 3 for 23/24 (95.8%); in top 5 for 24/24 (100%); MRR 0.946.
- **Measured response:** Correct expected citation 20/24 (83.3%); correct abstention 6/8 (75.0%); out-of-scope requests restricted 5/5 (100%); high-alert warning shown 5/6 (83.3%).
- **Test condition:** Offline run against synthetic demo content; external model calls were blocked, so the LLM answer-generation path was not scored.
- **Known misses:** Two unsupported questions got unrelated answers; the phrase “high-alert medicines” missed a warning.
- **Business value:** Faster protocol lookup and more consistent access to current guidance.
- **Human role:** Staff verify the cited policy; clinicians and policy owners remain authoritative.

### RAG Chat for Doctors — clinical information assistant

- **Classification:** Role- and patient-scoped retrieval assistant.
- **Objective:** Help authorised doctors find relevant clinical context with citations.
- **Problem solved:** Patient information is spread across records and modules, requiring repeated manual searches.
- **Solution:** Apply access scope, retrieve permitted records, and return a cited answer or verified source summary.
- **Model:** Configurable LLM; default generation path uses Llama 3.3 70B Versatile. External embedding default is text-embedding-3-small; a local deterministic fallback is available.
- **Why this approach:** Base answers on the hospital record and make the source visible for verification.
- **Public model benchmark:** Llama MMLU 86.0%, GPQA Diamond 50.5%, MMLU-Pro 68.9%; embedding model MTEB 62.3%, MIRACL 44.0%. These are public model benchmarks, not Meridian RAG accuracy.
- **RAG Chat test score:** Not available; no RAG Chat-specific test run or benchmark was identified in this review.
- **Security score:** Production privacy/security release gates are proposed; zero-leakage results have not been reported.
- **Business value:** Less time assembling context and easier source checking.
- **Human role:** Doctor verifies consequential facts and makes clinical decisions.

## Workflows

### Radiology Triage — chest X-ray prioritisation

- **Classification:** AI-assisted workflow; not an autonomous diagnostic agent.
- **Objective:** Help radiologists prioritise chest X-rays and inspect candidate regions.
- **Problem solved:** Time-sensitive studies can be difficult to identify in a busy worklist; images, orders, and follow-up may be disconnected.
- **Solution:** Link the order and image, run screening and localisation, rank the worklist, and keep radiologist review attached.
- **Models:** DenseNet121 classifier + YOLO11n detector + deterministic category rule.
- **Why this approach:** Classifier screens the study; detector highlights candidate regions; fixed rules combine signals for review priority.
- **Recorded DenseNet result:** ROC-AUC 0.85 (project configuration; not independently rerun in this review).
- **Recorded YOLO evaluation:** 400 images (200 positive, 200 negative); precision 0.483; recall 0.431; mAP@0.5 0.444; mAP@0.5:0.95 0.179.
- **Recorded localisation counts:** 143/200 positive images localised at IoU 0.5 (71.5%); false alert on 54/200 negative images (27.0%).
- **Decision-rule test:** 4/4 expected categories matched for positive/negative classifier and detector combinations in a local code check.
- **Clinical accuracy:** Not measured here; recorded model metrics are development evaluation results, not local clinical validation.
- **Business value:** More organised review priority and traceability from order to image to radiologist decision.
- **Human role:** Radiologist reviews the image and owns the final interpretation.
- **Scope:** Chest X-ray PA/AP workflow; do not assume performance for other modalities.

### Voice Documentation (SOAP) — clinical note drafting

- **Classification:** AI-assisted documentation workflow.
- **Objective:** Turn clinician dictation into a structured SOAP draft for review and signature.
- **Problem solved:** Manual note writing takes time and can create inconsistent structure.
- **Solution:** Speech recognition creates a transcript; a language model fills Subjective, Objective, Assessment, and Plan; clinician reviews and signs.
- **Models:** Configurable speech recognition; GPT-OSS-20B via Groq when configured, otherwise GPT-4o mini via OpenAI by default.
- **Why this approach:** Voice captures the encounter; structured generation creates a readable draft while keeping the clinician in control.
- **Public benchmark:** Whisper multilingual mean WER 5.44% (Hindi 19.25%) in one external evaluation; GPT-OSS/GPT-4o mini public scores are general benchmarks, not SOAP-note accuracy.
- **System tests:** 29/29 passed (20 SOAP note tests + 9 SOAP action workflow tests).
- **Test coverage:** Patient/visit matching, note format, medication/dose/unit/vital mismatch blocking, clinician correction, silence detection, and safe handling of suggested actions.
- **Dictation and note accuracy:** Not measured on real clinical audio or notes.
- **Business value:** Less typing and more consistent first drafts.
- **Human role:** Clinician edits and signs every note.

### Diagnostic Coordinator — preparation evidence workflow

- **Classification:** Deterministic workflow automation; no predictive or generative model in the reviewed implementation.
- **Objective:** Record and display patient-preparation evidence against the correct diagnostic order.
- **Problem solved:** Fasting or preparation status may be missing, verbally passed, or hard to verify.
- **Solution:** Capture status, source, staff identity, and relevant time; validate required fields and order access.
- **Model:** Not applicable; explicit validation and access rules are used.
- **System tests:** 10/10 API tests passed.
- **Test coverage:** Authentication, staff role, order scope, identity, time validation, missing evidence, read-only retrieval, and append-only records.
- **Operational accuracy:** Not measured against live orders; no delay/cancellation baseline was available.
- **Business value:** Clearer readiness evidence and fewer repeated calls when information is complete.
- **Human role:** Staff apply the procedure-specific protocol and decide readiness.

### Management Copilot — operational summaries and bottlenecks

- **Classification:** Deterministic reporting workflow in the reviewed AG-21 service.
- **Objective:** Show selected queue, follow-up, escalation, imaging, radiology, and discharge workload with source provenance.
- **Problem solved:** Managers need to visit multiple systems to see ageing work and unresolved issues.
- **Solution:** Query persisted records, apply explicit status/date rules, calculate counts and ages, and show source/as-of details.
- **Model:** No predictive model in the reviewed AG-21 summary service.
- **System test score:** No live database-to-dashboard reconciliation run; operational accuracy is unmeasured.
- **Forecast score check:** Related bed-demand endpoint returns R² 0.948 as a fixed code value; its forecast is generated from preset rules, so 94.8% is not a validated model score.
- **Business value:** Faster operational review and easier identification of bottlenecks.
- **Human role:** Managers verify source, timing, and metric definitions before acting.

## Overall score summary

- **AI Trainer:** 91.7% top-1 document retrieval; 83.3% correct citations; 75.0% correct abstention on demo questions.
- **Doctor RAG:** No RAG Chat-specific score available; security release score not established.
- **Radiology Triage:** DenseNet AUC 0.85; YOLO precision 0.483, recall 0.431, mAP@0.5 0.444; rule test 4/4.
- **Voice SOAP:** 29/29 software behavior tests passed; clinical transcription/note accuracy not measured.
- **Diagnostic Coordinator:** 10/10 API/process tests passed; live operational outcome score not measured.
- **Management Copilot:** Live reconciliation not run; no validated accuracy score.

## Evidence files

- **AI Trainer:** `scratch/ai_trainer_demo_benchmark.py`; `backend/knowledge/ai_trainer/demo/`.
- **Doctor RAG:** `docs/rag_production_readiness_audit.md` (release gaps and proposed gates; no measured RAG Chat score).
- **AI Trainer recorded workflow checks:** `docs/AG13_VALIDATION_MATRIX_2026-10-06.md`.
- **Radiology:** `backend/radiology_ai/config.py`; decision-rule code in `backend/radiology_ai/services/decision_service.py`.
- **Voice SOAP:** `backend/tests/test_soap_notes.py`; `backend/tests/test_soap_action_workflow.py`.
- **Diagnostic Coordinator:** `backend/tests/test_diagnostic_preparation.py`.
- **Management Copilot:** `backend/services/ag21_management_service.py`; related forecast logic in `backend/routers/gold.py`.
- **Evidence boundary:** Executed tests used synthetic/test fixtures; no live patient records or clinical validation dataset was used.
