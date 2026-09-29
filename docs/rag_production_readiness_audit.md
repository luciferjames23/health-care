# Clinical RAG production-readiness audit

Audit target: current working tree on 2026-09-28. Existing uncommitted RAG hardening was preserved and reviewed as part of the target.

## Executive decision

**Not approved for production with PHI yet.** The implemented patch closes several direct bypasses and adds authorization-first entity resolution, but release remains blocked until the hospital supplies the canonical role/module/record-ownership matrix and radiologist assignment source, migration 024 is deployed, identity/session controls are fully integrated across non-RAG endpoints, and the security/evaluation gates below pass in the deployment environment.

## Findings ranked by severity

### Critical

1. **JWT authorization claims were treated as live authority.** `role`, `doctor_id`, and department could remain stale after a role/permission change. `build_access_context` now re-reads active user, role, doctor and department state from PostgreSQL and fails closed.
2. **Radiologist retrieval had no record-ownership prefilter.** A radiologist could search all radiology chunks and aggregates. Document retrieval is now prefiltered by department metadata and post-filtered again. Aggregate retrieval for radiologists is fail-closed because the current schema has no authoritative radiologist-to-order assignment mapping.
3. **Most hospital roles have no canonical RAG permission mapping.** Lab, billing, nurse, pharmacy and other roles are denied. Enabling guessed modules would be unsafe; the real matrix is required.
4. **Restricted and nonexistent records produced distinguishable responses.** Direct cross-patient attempts and forbidden radiologist questions could return 403 while missing data returned 200. Valid authenticated requests now use the same generic empty response and shape for both cases.
5. **Name resolution was missing.** Natural-language names, misspellings and ambiguity could not be resolved safely. The new resolver queries only `AccessContext.allowed_patient_ids` for non-admin users and produces only in-scope clarification candidates.
6. **A development authentication path was previously enabled by default.** The working tree already changed `RAG_DEV_MODE` to opt-in. This must stay disabled in production and be deployment-tested.
7. **Database credentials are embedded as fallback literals in `backend/db_config.py`.** Secrets must be removed from source/history, rotated, and supplied by a secrets manager. This patch does not rotate credentials because that requires infrastructure authority.

### High

1. **The retriever was not true hybrid retrieval.** It selected candidates by FTS and only then computed vector similarity in application memory, so semantic-only matches could never enter the candidate set. The patch uses all rewrites rather than only the original query, but native pgvector candidate retrieval plus scoped fusion/reranking remains required.
2. **360-degree completeness was top-k dependent.** Module balancing helps, but it does not prove all relevant records were included and has no map/reduce overflow path or context-recall gate.
3. **Patient identifiers supplied in natural language were not enforced.** Prefixed patient/UHID/MRN identifiers are now checked against the authorized set before retrieval. Bare numbers remain intentionally ambiguous because they may be beds, values, dates or record IDs.
4. **Conversation pronouns were not bound to authorized patient state.** Follow-ups now reuse a session patient only if it is still authorized and bind an unambiguous scoped resolution to the conversation.
5. **Output guardrail checked citations only, and citations were optional.** It now requires citations, rejects unknown record citations, checks explicit patient identifiers, and fails closed. A production NER/DLP guard for names and other PHI is still required.
6. **Indexed metadata lacked a complete version/deletion contract.** Ingestion now records module, ownership fields, timestamp, version and deletion state; tombstones deactivate documents. Migration 024 adds first-class columns and indexes.
7. **Audit rows were mutable and contained more query text than necessary.** Query text is hashed in the current working tree; migration 024 adds an append-only database trigger and guardrail/scope fields. A separate WORM/SIEM export is still recommended.
8. **Raw questions and conversation content can be sent to third-party LLM APIs.** No provider/region/BAA enforcement exists. Production must disable external calls unless the provider and region are approved, and apply PHI-minimizing routing.

### Medium

1. Normalization covered too few HMS/medical abbreviations and common misspellings. The new deterministic layer expands the requested core abbreviations and common voice/typing errors; language coverage still needs hospital-specific corpora.
2. Relative dates were not converted into absolute hospital-timezone ranges. The new layer resolves today, yesterday, last week, last N days and since Monday. Retrieval must still apply these ranges consistently to structured and narrative sources.
3. Structured lookups exist only for a few count workflows. Labs, vitals, bills and dates still need parameterized structured adapters rather than narrative chunks.
4. Search status filters use broad `ILIKE`; clinical "abnormal" semantics should come from source flags, not text.
5. No proven per-scope answer cache exists. Any future cache must use `(user_id, role, scope_hash, permission_version, model/index version)` and invalidate on record or permission changes.
6. No request timeout/circuit-breaker policy or p95 enforcement is present around database, embedding and generation calls.
7. Health output exposes deployment configuration details and should be restricted to operational roles/networks.

## Target architecture

```text
Verified session/JWT
       |
Live identity + permission lookup
       |
AccessContext(user, role, modules, patient/department/ward scope, scope hash)
       |
Authorization-first query understanding
  normalization -> intent/date/entities -> scoped patient resolution -> clarification
       |
Central query planner
  +-- parameterized structured adapters (labs/vitals/bills/counts)
  +-- scoped BM25 candidate query
  +-- scoped pgvector candidate query
       \-- authorized fusion/reranker
       |
Post-retrieval authorization check
       |
Grounded generation (untrusted user + untrusted records, mandatory citations)
       |
Output ID/name/DLP authorization guard
       |
Generic response + isolated conversation/cache + append-only audit
```

Authorization predicates must be generated once by the central policy layer and consumed by every data path. PostgreSQL RLS/read-only roles should duplicate the same boundary beneath the application.

## Implemented in this change

- Live database identity/role revalidation and immutable `AccessContext` scope hashing.
- Department-aware radiologist prefilter and fail-closed unsafe aggregates.
- Authorization-first normalization, abbreviation/spelling expansion, intent/module/date parsing, scoped fuzzy patient matching, safe ambiguity prompts and pronoun continuity.
- Field-driven collection query plans for names, demographics, diagnoses, admission reasons, location, latest vitals, billing and discharge state; collection follow-ups reuse only the prior authorized patient-ID set.
- Per-conversation authorized collection state keyed by user, live role and scope hash (`025_rag_authorized_collection_context.sql`).
- Multi-query terms are now actually used by retrieval.
- Generic restricted/nonexistent response parity for valid sessions.
- Stronger untrusted-context generation prompt and mandatory citation/patient-ID output guard.
- Version/deletion ingestion metadata, deletion tombstoning, security migration and append-only audit trigger.
- Automated unit/eval coverage, including a generated 200-case messy-query corpus.

## Release gates

- Leakage rate: exactly 0 across direct IDs, names, fuzzy names, counts, follow-ups, caches and timing tests.
- Role/module/ownership matrix tests: 100% pass for every deployed role.
- 360-degree context recall: agreed threshold against seeded ground truth; no required module silently absent.
- Structured fact exact-match accuracy: 100% for copied values, units, dates and totals in the release set.
- Refusal correctness and source faithfulness: agreed thresholds; every factual paragraph cites an authorized source.
- Permission-change and deletion propagation: within the hospital's documented SLA.
- Lookup p95: below 4 seconds under representative concurrency, measured in the deployment region.

## Required decisions and inputs

1. Canonical role-to-module matrix, including department/ward/assigned-patient rules and temporary coverage/delegation.
2. Authoritative radiologist assignment/visibility relation for orders and reports.
3. Final schema for labs, vitals, bills, visits, beds/wards and record version/deletion events.
4. Vector database choice and supported native metadata/RLS filtering (pgvector is assumed by the current code).
5. Approved LLM/embedding providers, BAA status, data residency region and retention policy.
6. Hospital timezone confirmation (`Asia/Kolkata` is the current default).
7. Audit retention/WORM destination, alert routing, latency/load targets and concurrency profile.
