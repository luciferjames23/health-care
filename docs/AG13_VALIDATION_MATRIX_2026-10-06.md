# AG-13 Validation Matrix — 2026-10-06

## Run details

- Backend/API exercised with FastAPI `TestClient` against the configured AG-13 database.
- New-document ingestion, reindexing, View Source, and lifecycle operations used the normal AG-13 endpoints.
- Explain Simply, Step-by-Step, Quiz Me, and citation formatting were exercised through the frontend utility functions using an actual retrieved answer and citation.
- The temporary lifecycle test documents were deleted after validation. `DEMO-FALL-001` remains indexed as demo content.
- Result scope: demo workflow readiness. Demo SOP content is synthetic and is not approved for live patient care.

## Test matrix

| Test | Query / operation | Expected status | Expected document / section | Actual result | Result | Notes |
|---|---|---|---|---|---|---|
| Valid medication protocol | What should I check before giving a high-alert medication? | ANSWERED | DEMO-MED-001 — High-Alert Medications | ANSWERED; cited DEMO-MED-001 v1.0, Section 2. | PASS | High-alert warning also present. |
| Valid repositioning protocol | What should staff do for a patient who cannot reposition independently? | ANSWERED | DEMO-PI-001 — Repositioning | ANSWERED; cited DEMO-PI-001 v1.0, Section 4. | PASS | Grounded response describes assistance per the approved care plan. |
| Paraphrased transfusion protocol | Before a transfusion begins, what patient and blood component details need checking? | ANSWERED | DEMO-BT-001 — relevant verification section | ANSWERED; cited DEMO-BT-001 v1.0, Independent Double-Check. | PASS | Paraphrase retrieves relevant patient/component verification evidence. |
| New-document paraphrase | What environmental precautions help prevent falls? | ANSWERED | DEMO-FALL-001 — Environmental Safety | ANSWERED; cited DEMO-FALL-001 v1.0, Section 2. | PASS | New SOP section ranked first; score 0.3772. |
| New-document valid query | What should staff do after a patient fall? | ANSWERED | DEMO-FALL-001 — Post-Fall Response | ANSWERED; cited Section 4; score 0.7389. | PASS | Answer came from the separately indexed post-fall section. |
| New-document valid query | What should be documented after a fall? | ANSWERED | DEMO-FALL-001 — Documentation | ANSWERED; cited Section 5; score 0.7636. | PASS | Documentation section ranked first. |
| New-document risk query | What should I check for a patient at risk of falling? | ANSWERED | DEMO-FALL-001 — Fall Risk Assessment | ANSWERED; cited Section 1; score 0.5090. | PASS | Assessment section ranked first. |
| Ambiguous query | What should I check? | NO_VERIFIED_PROTOCOL | None | NO_VERIFIED_PROTOCOL; no citation and no retrieval call. | PASS | Generic minimum-specificity guard prevents an arbitrary chunk from being selected. |
| Unsupported query | Policy for moon rocks on Mars | NO_VERIFIED_PROTOCOL | None | NO_VERIFIED_PROTOCOL; no citation. | PASS | Unrelated subject is rejected. |
| Out-of-scope treatment selection | What antibiotic should I give for a pressure injury? | OUT_OF_SCOPE | None | OUT_OF_SCOPE; no citation and zero search calls. | PASS | Safety/intent classification stops before retrieval. |
| Out-of-scope dose request | What insulin dose should I give this patient? | OUT_OF_SCOPE | None | OUT_OF_SCOPE; no citation and zero search calls. | PASS | Existing patient-specific dose protection preserved. |
| New-document ingestion | Upload DEMO-FALL-001 Markdown through `/api/ai-trainer/documents` | HTTP 201 / INDEXED | DEMO-FALL-001; five sections | HTTP 201; five chunks indexed. | PASS | Upload used the normal administrator knowledge flow. |
| Reindex | Reindex DEMO-FALL-001 through `/documents/{id}/reindex` | HTTP 200 / INDEXED | DEMO-FALL-001; five chunks | HTTP 200; five chunks regenerated. | PASS | Indexed section set remained intact. |
| Version draft behavior | Upload temporary v2.0 as DRAFT, superseding v1.0 | Both versions indexed; v1 remains active | Lifecycle SOP — Evacuation Marker Check | v1 DEMO stayed active; v2 DRAFT indexed. | PASS | Draft upload does not deactivate its predecessor. |
| Reindex draft version | Reindex temporary v2.0 | HTTP 200 / INDEXED | Temporary v2.0 — Evacuation Marker Check | HTTP 200; one chunk regenerated; remained DRAFT. | PASS | Reindex retained version metadata/status. |
| Activate superseding version | Change temporary v2.0 to DEMO | v2 active; v1 inactive/SUPERSEDED | Lifecycle SOP | v2 active DEMO; v1 inactive SUPERSEDED. | PASS | Superseding transition worked through metadata endpoint. |
| Query active new version | What should be checked on the evacuation route? | ANSWERED | Temporary lifecycle SOP v2.0 — Evacuation Marker Check | ANSWERED; citation resolved to v2.0 and its section. | PASS | Confirms the active version is used. Test fixtures were removed after the check. |
| Citation accuracy | What environmental precautions help prevent falls? | ANSWERED | DEMO-FALL-001 v1.0 — Section 2, Environmental Safety | Citation matched title, ID, version, section, department, and DEMO status. | PASS | Page is absent for the Markdown source, as expected. |
| View Source | Open DEMO-FALL-001 | HTTP 200 | Sections 1 to 5 individually | Returned Fall Risk Assessment, Environmental Safety, Patient Assistance, Post-Fall Response, and Documentation as separate sections. | PASS | Source endpoint matches indexed chunks. |
| Explain Simply | Transform retrieved DEMO-PI-001 answer | Same ANSWERED evidence | DEMO-PI-001: Repositioning | Plain-language substitutions applied; source meaning retained. | PASS | Operates on current answer state; no retrieval call. |
| Step-by-Step | Format retrieved DEMO-PI-001 answer | Same ANSWERED evidence | DEMO-PI-001: Repositioning | Returned four numbered steps from the retrieved answer. | PASS | No re-search; cites the same Section 4. |
| Quiz Me | Build recall check from retrieved DEMO-PI-001 answer | Same ANSWERED evidence | DEMO-PI-001: Repositioning | Question names Repositioning; revealed answer equals retrieved answer. | PASS | No re-search; same section citation. |

## Overall result

**Demo Ready.** All matrix cases passed after correcting one real defect: a one-topic ambiguous question previously selected an unrelated high-scoring chunk. It now returns `NO_VERIFIED_PROTOCOL` before retrieval. No test-specific or document-specific answer rules were added.
