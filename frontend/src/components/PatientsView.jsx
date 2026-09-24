import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { apiService, parseAdmissionLlmRecord, parseDischargeSummaryRecord, extractDischargedPatientIds, matchesDoctor, cleanDiagnosis } from "../services/api";
import ModuleLoadingScreen, { TableSkeleton } from "./ModuleLoadingScreen";

function getStatusPill(status) {
  if (!status) return { bg: "#f2f3f4", fg: "#52585e", label: "Unknown" };
  const s = String(status).toLowerCase();
  if (s.includes("discharge ready")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Discharge ready" };
  if (s.includes("discharge planning")) return { bg: "oklch(0.95 0.03 200)", fg: "oklch(0.4 0.1 200)", label: "Discharge planning" };
  if (s.includes("post-op") || s.includes("postop")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.45 0.13 70)", label: "Post-operative" };
  if (s.includes("fit for discharge")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Fit for discharge" };
  if (s.includes("awaiting")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.5 0.13 70)", label: status };
  if (s.includes("confirmed") || s.includes("booked")) return { bg: "#e0f2fe", fg: "#0369a1", label: "Confirmed" };
  if (s.includes("resuscitation") || s.includes("critical") || s.includes("icu") || s.includes("stroke")) return { bg: "#fee2e2", fg: "#b91c1c", label: status };
  if (s.includes("triage") || s.includes("workup") || s.includes("stabilization") || s.includes("nebulization") || s.includes("resuscitation") || s.includes("treatment")) return { bg: "#fef3c7", fg: "#92400e", label: status };
  if (s.includes("stable")) return { bg: "#f6f7f8", fg: "#52585e", label: "Stable" };
  if (s.includes("signed off")) return { bg: "#f2f3f4", fg: "#8a9096", label: "Signed off" };
  if (s.includes("long stay")) return { bg: "oklch(0.96 0.03 25)", fg: "oklch(0.5 0.18 25)", label: "Long stay" };
  if (s.includes("discharged")) return { bg: "#f2f3f4", fg: "#52585e", label: "Discharged" };
  if (s.includes("admitted") || s.includes("active")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: status.length > 20 ? "Admitted" : status };
  return { bg: "#f6f7f8", fg: "#52585e", label: status };
}

const dept = (p) => p.department || p.dept || p.ward || "—";
const lang = (p) => p.language || p.preferred_language || "Tamil";
const insurer = (p) => p.insurer || p.insurance || p.insurance_company || p.payor || "Self-pay";

const GRID = "160px minmax(140px,1fr) 80px 90px 120px 150px 130px 140px";

export default function PatientsView({
  onSelectPatient,
  onOpenSoap,
  onNavigate,
  doctorName = null,
  userRole = 'Hospital Management'
}) {
  const isDoctor = userRole === 'Doctor' || (doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const activeDoctorName = isDoctor ? doctorName : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [admitted, setAdmitted] = useState([]);
  const [discharged, setDischarged] = useState([]);
  const [opPatients, setOpPatients] = useState([]);
  const [erPatients, setErPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, activeDoctorName]);

  useEffect(() => {
    let alive = true;
    const loadPatients = async (isSilent = false) => {
      if (!isSilent && admitted.length === 0 && discharged.length === 0 && opPatients.length === 0 && erPatients.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const [ar, dr, opRes, erRes] = await Promise.all([
          apiService.getCurrentAdmissions({ discharge_status: 'all' }, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getAllPatientsDirectory({ category: 'OP' }, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getAllPatientsDirectory({ category: 'ER' }, { forceRefresh: true }).catch(() => ({ data: [] })),
        ]);
        if (!alive) return;

        const rawDischarges = dr?.data || [];
        const rawAdmissions = ar?.data || [];

        const dischargedTracker = extractDischargedPatientIds(rawDischarges);

        const seenDischargedPids = new Set();
        const parsedDischargedList = [];
        const actualAdmitted = [];

        rawAdmissions.forEach(r => {
          const st = String(r.discharge_status || r.admission_status || '').trim().toLowerCase();
          const pid = String(r.patient_id || r.id || '').trim();

          const isDischarged = st === 'discharged' || dischargedTracker.has(r);

          const parsed = parseAdmissionLlmRecord(r);
          const pName = r.patient_name || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null) || parsed.name || parsed.patient_name;

          if (isDischarged) {
            if (pid) seenDischargedPids.add(pid);
            parsedDischargedList.push({
              ...parsed,
              name: pName,
              patient_name: pName,
              patient: pName,
              age: r.age_at_admission || parsed.age || 45,
              sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : r.gender.toLowerCase().startsWith('m') ? 'M' : r.gender) : (parsed.sex || 'F'),
              gender: r.gender || parsed.gender || 'Unknown',
              doctor: r.attending_doctor || parsed.doctor || 'Attending Physician',
              diagnosis: cleanDiagnosis(r.primary_diagnosis || parsed.diagnosis || ''),
              _type: "Discharged",
              _status: "Discharged"
            });
          } else {
            const isReady = String(r.discharge_status || '').trim().toLowerCase() === 'ready';
            actualAdmitted.push({
              ...parsed,
              name: pName,
              patient_name: pName,
              diagnosis: cleanDiagnosis(r.primary_diagnosis || parsed.diagnosis || ''),
              _type: "IP",
              _status: isReady ? "Fit for discharge" : (parsed.status || "Admitted")
            });
          }
        });

        // 2. Add any additional finalized discharge records if not already in admissions
        rawDischarges.forEach(r => {
          const isApproved = String(r.approval_status || '').trim().toLowerCase() === 'approved';
          const isExplicitDischarge = String(r.status || '').trim().toLowerCase() === 'discharged';
          if (!isApproved && !isExplicitDischarge && !r.is_discharged) return;

          const pid = String(r.patient_id || r.id || '').trim();
          if (pid && seenDischargedPids.has(pid)) return;

          const d = parseDischargeSummaryRecord(r);
          const pName = r.patient_name || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null) || d.patient || d.name || d.patient_name;

          if (pid) seenDischargedPids.add(pid);
          parsedDischargedList.push({
            ...d,
            name: pName,
            patient_name: pName,
            patient: pName,
            age: d.age || r.age_at_admission || r.age || 45,
            sex: d.sex || (r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : r.gender.toLowerCase().startsWith('m') ? 'M' : r.gender) : 'F'),
            gender: d.gender || r.gender || 'Unknown',
            doctor: d.doctor || r.primary_consultant || r.doctor_name || 'Attending Physician',
            diagnosis: cleanDiagnosis(d.diagnosis || d.diagnoses || r.diagnoses || ''),
            _type: "Discharged",
            _status: "Discharged"
          });
        });

        // 3. Outpatient (OP) Records from Live Directory API
        const parsedOp = (opRes?.data || []).map(r => ({
          patient_id: r.patient_id,
          id: r.patient_id,
          uhid: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
          patient_code: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
          patient_number: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
          name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          patient_name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          age: r.age || 40,
          sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : 'M') : 'M',
          gender: r.gender || 'Male',
          language: r.preferred_language || 'English',
          department: r.department || 'Outpatient Clinic',
          doctor: r.doctor || 'Consultant Doctor',
          insurer: r.insurer || 'Direct / Outpatient',
          status: r.status || 'CONFIRMED',
          _status: r.status || 'CONFIRMED',
          diagnosis: cleanDiagnosis(r.diagnosis || 'Outpatient Consultation'),
          _type: "OP",
          appointment_date: r.admission_date,
          appointment_time: r.appointment_time
        }));

        // 4. Emergency (ER) Records from Live Directory API
        const parsedEr = (erRes?.data || []).map(r => ({
          patient_id: r.patient_id,
          id: r.patient_id,
          uhid: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
          patient_code: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
          patient_number: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
          name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          patient_name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          age: r.age || 40,
          sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : 'M') : 'M',
          gender: r.gender || 'Male',
          language: r.preferred_language || 'English',
          department: r.bed_number ? `${r.department} (${r.bed_number})` : (r.department || 'Emergency Bay'),
          doctor: r.doctor || 'Dr. Divya Verma',
          insurer: r.insurer || 'Emergency Cover',
          status: r.status || 'Active Triage',
          _status: r.status || 'Active Triage',
          diagnosis: cleanDiagnosis(r.diagnosis || 'Emergency Care'),
          _type: "ER",
          triage_level: r.discharge_status
        }));

        setAdmitted(actualAdmitted);
        setDischarged(parsedDischargedList);
        setOpPatients(parsedOp);
        setErPatients(parsedEr);
      } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    };

    loadPatients();

    const timer = setInterval(() => {
      loadPatients(true);
    }, 6000);

    const handleUpdate = () => loadPatients(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  const rows = useMemo(() => {
    let list = filter === "All" ? [...admitted, ...opPatients, ...erPatients, ...discharged]
      : filter === "IP" ? admitted
        : filter === "OP" ? opPatients
          : filter === "ER" ? erPatients
            : filter === "Discharged" ? discharged
              : [...admitted, ...opPatients, ...erPatients, ...discharged].filter(p => p._type === filter);

    if (activeDoctorName) {
      list = list.filter(p =>
        matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName)
      );
    }

    if (!search.trim()) return list;
    const s = search.toLowerCase().trim();
    const isDigits = /^\d+$/.test(s);

    return list.filter(p => {
      const pidStr = p.patient_id !== undefined && p.patient_id !== null ? String(p.patient_id).trim() : "";
      const patNumStr = String(p.patient_number || p.patient_code || p.uhid || "").toLowerCase();

      // When user searches a numeric ID (e.g. 87314), match EXACT patient_id or patient UHID/code!
      // NEVER match admission_id or admission_number when searching by numeric patient ID.
      if (isDigits) {
        return (
          pidStr === s ||
          patNumStr === s ||
          patNumStr.endsWith(s)
        );
      }

      const name = p.name ? p.name.toLowerCase() : "";
      const doctor = p.doctor ? p.doctor.toLowerCase() : "";
      const diagnosis = p.diagnosis ? p.diagnosis.toLowerCase() : "";
      const diagnoses = p.diagnoses ? String(p.diagnoses).toLowerCase() : "";
      const phone = p.phone ? String(p.phone).toLowerCase() : "";
      const admNumStr = String(p.admission_number || "").toLowerCase();

      return (
        pidStr.includes(s) ||
        patNumStr.includes(s) ||
        admNumStr.includes(s) ||
        name.includes(s) ||
        doctor.includes(s) ||
        diagnosis.includes(s) ||
        diagnoses.includes(s) ||
        phone.includes(s)
      );
    });
  }, [admitted, discharged, filter, search, activeDoctorName]);

  const total = admitted.length + opPatients.length + erPatients.length + discharged.length;
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

  const exportCsv = () => {
    if (!rows.length) return alert("No records to export");
    const hdr = ["UHID", "Name", "Age", "Sex", "Language", "Department", "Doctor", "Insurer", "Status"];
    const lines = [hdr, ...rows.map(p => [p.mrn || p.patient_id || "", p.name || "", p.age || "", p.sex || "", lang(p), dept(p), p.doctor || "", insurer(p), p._status || ""].map(v => `"${v}"`))]
      .map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([lines], { type: "text/csv" })), download: "patients.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* breadcrumb + title + actions */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span>Clinical Workspace</span>{" · "}<span>{isDoctor ? 'My Patients' : 'Patients'}</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>
            {isDoctor && activeDoctorName ? `Patients · ${activeDoctorName}` : 'Patients'}
          </div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            {loading
              ? "Loading patients…"
              : isDoctor && activeDoctorName
                ? `Doctor Scope: ${activeDoctorName} · Showing ${rows.length} patient${rows.length === 1 ? '' : 's'} under your care`
                : `${total} active patients · shared Patient 360 across every module`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by Name, Patient ID, UHID..."
            style={{ height: "30px", width: "240px", border: "1px solid #e3e6e8", borderRadius: "6px", padding: "0 10px", fontSize: "12px", outline: "none" }} />
          <button type="button" onClick={exportCsv}
            style={{ height: "30px", padding: "0 12px", borderRadius: "6px", border: "1px solid #e3e6e8", background: "#fff", cursor: "pointer", fontSize: "12px" }}>
            Export CSV
          </button>
          <button type="button" onClick={() => alert("Register patient")}
            style={{ height: "30px", padding: "0 12px", borderRadius: "6px", border: 0, background: "oklch(0.5 0.1 200)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "12px" }}>
            + Register patient
          </button>
        </div>
      </div>

      {error && <div style={{ background: "oklch(0.96 0.03 25)", border: "1px solid oklch(0.88 0.06 25)", borderRadius: "6px", padding: "9px 12px", color: "oklch(0.45 0.17 25)", fontSize: "12px" }}>Unable to load: {error}</div>}

      {/* filter pills + pagination summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {["All", "IP", "OP", "ER", "Discharged"].map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              style={{
                height: "28px", padding: "0 14px", borderRadius: "14px", border: "1px solid #e3e6e8",
                background: filter === f ? "#15181b" : "#fff", color: filter === f ? "#fff" : "#52585e",
                fontWeight: filter === f ? 600 : 400, fontSize: "12px", cursor: "pointer"
              }}>
              {f}
            </button>
          ))}
        </div>

        {totalRows > 0 && (
          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>
              Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong>
            </span>
          </div>
        )}
      </div>

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", overflowX: "auto" }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: "16px" }}>
            <ModuleLoadingScreen
              title="Loading Patient Directory..."
              subtitle="Retrieving real-time IP, OP, ER, and Discharged patient records..."
              badgeText="Live Directory Sync"
              showKpis={false}
              tableRows={8}
              tableColumns={8}
            />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a9096" }}>
            <div style={{ fontWeight: 600, color: "#52585e", marginBottom: "4px" }}>Nothing matches</div>
            {search ? `No records for "${search}". Clear the search or choose "All".` : "No patient records available."}
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
              color: "#8a9096", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".04em",
              borderBottom: "1px solid #eef0f1", minWidth: "940px"
            }}>
              {["UHID", "NAME", "AGE \u00b7 SEX", "LANGUAGE", "DEPARTMENT", "DOCTOR", "INSURER", "STATUS"].map(h => <span key={h}>{h}</span>)}
            </div>

            {paginatedRows.map((p, idx) => {
              const pill = getStatusPill(p._status);
              const uhid = p.patient_number || p.uhid || (p.patient_id ? `MER-PAT-${String(p.patient_id).padStart(7, "0")}` : (p.mrn || `MER-PAT-${String(startIndex + idx + 1).padStart(7, "0")}`));
              return (
                <div key={p.id || p.patient_id || idx}
                  onClick={() => onSelectPatient && onSelectPatient(p)}
                  onMouseEnter={e => e.currentTarget.style.background = "#f6f7f8"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{
                    display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
                    borderBottom: "1px solid #f2f3f4", alignItems: "center", cursor: "pointer",
                    fontSize: "12px", minWidth: "940px", transition: "background 0.1s"
                  }}>
                  <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "11px", color: "#8a9096" }}>{uhid}</span>
                  <span style={{ fontWeight: 600, color: "#15181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "\u2014"}</span>
                  <span style={{ color: "#52585e" }}>{p.age ? `${p.age} \u00b7 ${p.sex || "F"}` : (p.sex ? `\u2014 \u00b7 ${p.sex}` : "\u2014")}</span>
                  <span style={{ color: "#52585e" }}>{lang(p)}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dept(p)}</span>
                  <span style={{ color: "oklch(0.45 0.1 200)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.doctor || "\u2014"}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insurer(p)}</span>
                  <span><span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: pill.bg, color: pill.fg, whiteSpace: "nowrap" }}>{pill.label}</span></span>
                </div>
              );
            })}

            {/* Pagination Controls Footer */}
            <div style={{
              padding: "10px 14px",
              background: "#fafbfc",
              borderTop: "1px solid #eef0f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              fontSize: "12px",
              color: "#64748b"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span>
                  Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> patients
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "11.5px", color: "#8a9096" }}>Per page:</span>
                  {[15, 25, 50, 100].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                      style={{
                        height: "24px",
                        padding: "0 8px",
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor: pageSize === sz ? "#0284c7" : "#e2e8f0",
                        background: pageSize === sz ? "#f0f9ff" : "#ffffff",
                        color: pageSize === sz ? "#0369a1" : "#64748b",
                        fontWeight: pageSize === sz ? 700 : 500,
                        fontSize: "11px",
                        cursor: "pointer"
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  title="First Page"
                  style={{
                    height: "28px",
                    width: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: safeCurrentPage <= 1 ? "not-allowed" : "pointer",
                    opacity: safeCurrentPage <= 1 ? 0.35 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#334155"
                  }}
                >
                  <ChevronsLeft style={{ width: "14px", height: "14px" }} />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  title="Previous Page"
                  style={{
                    height: "28px",
                    width: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: safeCurrentPage <= 1 ? "not-allowed" : "pointer",
                    opacity: safeCurrentPage <= 1 ? 0.35 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#334155"
                  }}
                >
                  <ChevronLeft style={{ width: "14px", height: "14px" }} />
                </button>

                <span style={{ padding: "0 8px", fontWeight: 600, color: "#0f172a", fontSize: "12px" }}>
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  title="Next Page"
                  style={{
                    height: "28px",
                    width: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                    opacity: safeCurrentPage >= totalPages ? 0.35 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#334155"
                  }}
                >
                  <ChevronRight style={{ width: "14px", height: "14px" }} />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  title="Last Page"
                  style={{
                    height: "28px",
                    width: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                    opacity: safeCurrentPage >= totalPages ? 0.35 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#334155"
                  }}
                >
                  <ChevronsRight style={{ width: "14px", height: "14px" }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}