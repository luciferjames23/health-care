# Hospital Healthcare AI Agents — Business Overview

**Prepared for:** Executive, clinical, operations, and digital health leaders  
**Reviewed:** 15 October 2026

## Executive view

Six AI-enabled capabilities can help move information to the right person sooner, reduce repetitive work, and improve traceability across clinical and operational workflows. These agents support staff decisions and tasks; clinicians and operational owners remain accountable for decisions and actions.

This is a business overview of objectives, problems addressed, proposed solutions, organisational value, scope, model approach, and available performance evidence. It is not a technical specification.

## Portfolio summary

| Agent | Business outcome | Primary users |
|---|---|---|
| Radiology Triage | Prioritised chest X-ray review and image workflow traceability | Radiologists, ordering doctors |
| AI Trainer | Faster access to hospital protocols | Clinical staff, educators |
| Voice Documentation (SOAP) | Structured note drafts from clinician dictation | Doctors, clinical teams |
| RAG Chat for Doctors | Cited retrieval of authorised clinical information | Doctors, authorised care teams |
| Diagnostic Coordinator | Preparation evidence and readiness coordination | Doctors, nurses, diagnostic teams |
| Management Copilot | Visibility into selected operational queues and bottlenecks | Hospital leaders, operations |

---

## 1. Radiology Triage

**Objective**  
Help radiology teams identify chest X-ray studies that may need earlier human review and make the image review workflow traceable.

**Business problem**  
Busy imaging queues can make time-sensitive studies harder to distinguish quickly. Requests, images, and reviews can also become disconnected across systems.

**Solution offered**  
For supported chest X-ray PA/AP studies, the workflow links the doctor’s request, accession, uploaded DICOM image, AI screening output, and radiologist review. AI assigns a prioritisation category and can mark candidate lung-opacity regions for radiologist attention.

**Organisational value**  
Supports attention management, review traceability, and doctor–radiologist communication. It may help teams direct attention sooner; it does not establish a diagnosis or replace the radiologist.

**Scope**  
Chest X-rays only (PA, AP, or PA+AP) in the implemented workflow. Radiologist review remains required. The system is not an autonomous diagnostic or reporting service.

**Model / approach**  
DenseNet121 binary classification plus YOLO11n candidate-region detection. The configured screening thresholds are 0.20 for classification and 0.10 for region confidence.

**Accuracy / performance evidence**  
The repository reports DenseNet ROC-AUC of **0.85**. YOLO evaluation is recorded on 400 images (200 positive, 200 negative): precision **0.483**, recall **0.431**, mAP@0.5 **0.444**, and mAP@0.5:0.95 **0.179**. The evaluation records 143/200 positive images localized at IoU 0.5 and 54/200 negative images generating false alerts.

These are development evaluation figures, not clinical accuracy, clinical sensitivity/specificity claims, or regulatory validation. Local clinical validation is needed before operational reliance.

---

## 2. AI Trainer

**Objective**  
Give staff a quick way to find and understand relevant hospital procedures and approved protocols.

**Business problem**  
Policies may be lengthy, distributed, or difficult to search during work. Staff can spend time locating the applicable section or rely on inconsistent recollection.

**Solution offered**  
Retrieves relevant protocol passages to answer questions, signals when evidence is missing or conflicting, and provides high-alert medication warnings. Current demo content is explicitly marked as not approved for live patient care.

**Organisational value**  
Can reduce search effort and support more consistent policy access, onboarding, and refresher learning—provided source documents are current and approved.

**Scope**  
Information support based on available protocols. It is not a substitute for clinical judgement or escalation to the responsible hospital authority.

**Model / approach**  
Embedding-based protocol retrieval plus a language model. The configured default answer model is **Llama 3.3 70B Versatile**; model and provider settings may differ by deployment.

**Accuracy / performance evidence**  
No validated accuracy percentage or clinical benchmark is documented. Evaluate answer correctness, source fidelity, safe abstention, and protocol coverage on an approved local question set.

---

## 3. Voice Documentation (SOAP)

**Objective**  
Turn a clinician’s spoken encounter summary into a structured SOAP note draft for clinician review.

**Business problem**  
Manual note preparation takes clinician time and can create documentation delays or inconsistent structure, especially in high-volume sessions.

**Solution offered**  
Speech is transcribed and converted into Subjective, Objective, Assessment, and Plan fields. The generation prompt is constrained to supplied dictation, preserves uncertainty, and leaves unsupported fields empty. The resulting note is a draft.

**Organisational value**  
Can reduce typing and structuring effort, improve first-draft consistency, and return clinician time to patient care. The clinician remains responsible for reviewing, correcting, and signing off the note.

**Scope**  
Clinician dictation to draft SOAP note. Automatic signing, diagnosis creation, and autonomous order placement are not implied.

**Model / approach**  
Configurable language model. Repository defaults are **GPT-OSS-20B through Groq** when configured, otherwise **GPT-4o mini through OpenAI**. Speech-to-text is a separate service/provider and may be configured independently.

**Accuracy / performance evidence**  
No end-to-end transcription or SOAP accuracy result is documented. Assess transcription error, clinical-term recognition, omissions and additions, field-level correctness, and clinician editing effort using representative accents and clinical terminology.

---

## 4. RAG Chat for Doctors

**Objective**  
Help authorised doctors ask questions across permitted clinical information and receive answers grounded in retrieved records.

**Business problem**  
Relevant patient facts may be spread across records and modules. Manual navigation and repeated searches consume time and make it harder to assemble context consistently.

**Solution offered**  
Retrieves authorised source material and generates a grounded response with citations and verification labels. A source-summary fallback is available when language-model generation is unavailable.

**Organisational value**  
Can shorten information retrieval and support a more complete view of available records. Citations help doctors verify answers in context while they retain clinical control.

**Scope**  
Role- and scope-authorised clinical information retrieval with cited answers. Consequential facts should be verified in their source.

**Model / approach**  
Retrieval and embeddings combined with a configurable language model. Repository defaults are **Llama 3.3 70B Versatile** for generation and **text-embedding-3-small** for embeddings. Deployment configuration may vary.

**Accuracy / performance evidence**  
No validated answer-accuracy score is documented. The repository audit defines release gates such as zero leakage in release tests, 100% exact match for structured facts in the release set, and agreed citation-faithfulness and refusal thresholds. These are targets, not achieved outcomes.

---

## 5. Diagnostic Coordinator

**Objective**  
Help teams capture and review preparation evidence linked to diagnostic orders so readiness can be checked before a procedure.

**Business problem**  
Missing, unclear, or stale preparation information can trigger clarification calls, avoidable delays, or repeated coordination work.

**Solution offered**  
An order-scoped workflow records the latest preparation evidence, including fasting assertion, relevant times, source type, staff identity, and recording time.

**Organisational value**  
Improves readiness visibility and accountability, reduces avoidable follow-up, and supports smoother diagnostic throughput when embedded in team procedures.

**Scope**  
Structured diagnostic preparation evidence, including fasting/NPO information. It does not independently establish patient readiness or replace clinical protocol checks.

**Model / approach**  
The reviewed implementation is a rules-based, persisted evidence workflow. No predictive AI model is evidenced.

**Accuracy / performance evidence**  
Model accuracy is not applicable. Reliability can be measured through completeness, freshness, correct order linkage, and concordance with staff-verified readiness. No such benchmark is documented.

---

## 6. Management Copilot

**Objective**  
Give hospital leaders a consolidated, timely view of selected operational queues and unresolved work.

**Business problem**  
Operational signals are distributed across modules, making demand, ageing work, and follow-up priorities harder to see together.

**Solution offered**  
Combines selected queue, follow-up, callback, escalation, feedback, X-ray, and radiology-review indicators. Summary metrics and bottleneck items include source provenance.

**Organisational value**  
Supports faster operational review, prioritisation, and accountability for follow-up. It can help leaders see where work accumulates and who may need to act.

**Scope**  
Operational decision support from selected persisted records. It does not make staffing or clinical decisions autonomously.

**Model / approach**  
No predictive model is evidenced in AG-21. It uses database-backed queries and deterministic counts, filters, and age calculations.

**Accuracy / performance evidence**  
Model accuracy is not applicable. No independent live-data accuracy or operational impact benchmark is provided here. Metric validity depends on source completeness, definitions, and integration.

---

## Model performance and business measurement

“Accuracy” is not one comparable number across this portfolio. Image classification, region detection, speech recognition, language generation, rules-based workflows, and database summaries have different outcomes and need different evaluation measures. Model size or fluent output does not establish factual accuracy.

A practical leadership scorecard could include:

- Staff time saved per completed task compared with a measured baseline.
- Time from imaging order to radiologist review, alongside missed-priority and false-alert rates.
- SOAP draft acceptance, correction effort, and clinically significant omission tracking.
- Protocol and RAG answer correctness, citation support, and safe no-answer behaviour.
- Diagnostic readiness completeness and avoidable delay rate.
- Operational bottleneck age, resolution time, and source-data availability.

## Implementation and governance considerations

- Connect each agent to approved source systems and confirm source-of-truth ownership.
- Define accountable clinical and operational owners, escalation paths, and review/sign-off requirements.
- Complete privacy, security, access, retention, vendor, and data-residency reviews for external AI providers.
- Validate locally before operational reliance and monitor quality and workflow outcomes after launch.
- Keep generated clinical content visibly marked as draft or decision support until a human takes responsibility.

## Source note

Prepared from the local Hospital Healthcare repository implementation and documentation, reviewed 15 October 2026. Radiology metrics come from project configuration; model defaults come from the reviewed service configuration; diagnostic preparation and AG-21 management summaries are structured evidence and deterministic database workflows. Configuration may differ by deployment. No live clinical validation was performed for this document.
