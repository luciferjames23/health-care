# Radiology report discussions

Apply `004_radiology_clarifications.sql` to the same PostgreSQL database as X-ray orders, after migrations 001–003. It is additive and rerunnable. It creates four tables and indexes; existing orders, scans, reports, and patient data are not updated. Restart the backend after deploying the new router and rebuild/reload the frontend.

Doctors open **Report discussions** on Patient360 order cards or in the X-ray tab, then **Request clarification**. The report must have report text and a radiologist review timestamp. Radiologists use **Radiology → Clarifications** or the clarification inbox. Inbox badges poll every 15 seconds; lists refresh every 10 seconds and an open thread every 5 seconds. These are in-app notifications, not email or SMS.

Access is checked using the signed session and active database role. Doctors must be the ordering doctor or the doctor assigned to the patient's latest admission. Radiologists share a department queue, can claim unassigned discussions, and can explicitly take ownership from another radiologist; every ownership change is audited. Other roles have no access to discussion endpoints. Legacy reviewer names are matched exactly to a unique active radiologist; unmatched or ambiguous names remain unassigned in the shared queue.

Messages are append-only through the API. Every message has an authenticated author ID, a name/role snapshot, and a database timestamp. Explicit read acknowledgements preserve the first read time per message and reader. Resolving and reopening do not delete history. UUID request identifiers make retries safe. Server-side row locks serialize replies, ownership changes, and resolution.

Each thread stores a snapshot of the report text, scan ID, review state, reviewer name, and review timestamp at creation. The compose form captures a report fingerprint; if the report changes while composing, creation fails with a refresh instruction. The snapshot is not a new signed report version or addendum. This feature does not change the existing reporting workflow, introduce report amendments, or send patient messages.

Run tests from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m unittest tests.test_radiology_clarifications tests.test_radiology_access -v
```

Clarification integration tests require PostgreSQL schema-creation permission. They create a uniquely named schema inside a transaction, use synthetic identities, and roll everything back, leaving patient records untouched.
