import React, { useState, useEffect, useMemo } from "react";
import { apiService, parseAdmissionLlmRecord, parseDischargeSummaryRecord, extractDischargedPatientIds } from "../services/api";

function getStatusPill(status) {
  if (!status) return { bg: "#f2f3f4", fg: "#52585e", label: "Unknown" };
  const s = String(status).toLowerCase();
  if (s.includes("discharge planning")) return { bg: "oklch(0.95 0.03 200)", fg: "oklch(0.4 0.1 200)", label: "Discharge planning" };
  if (s.includes("post-op") || s.includes("postop")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.45 0.13 70)", label: "Post-operative" };
  if (s.includes("fit for discharge")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Fit for discharge" };
  if (s.includes("awaiting")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.5 0.13 70)", label: "Awaiting results" };
  if (s.includes("stable")) return { bg: "#f6f7f8", fg: "#52585e", label: "Stable" };
  if (s.includes("signed off")) return { bg: "#f2f3f4", fg: "#8a9096", label: "Signed off" };
  if (s.includes("long stay")) return { bg: "oklch(0.96 0.03 25)", fg: "oklch(0.5 0.18 25)", label: "Long stay" };
  if (s.includes("discharged")) return { bg: "#f2f3f4", fg: "#52585e", label: status };
  if (s.includes("admitted") || s.includes("active")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Admitted" };
  if (s.includes("critical") || s.includes("icu")) return { bg: "oklch(0.96 0.03 25)", fg: "oklch(0.45 0.17 25)", label: status };
  return { bg: "#f6f7f8", fg: "#52585e", label: status };
}

const dept = (p) => p.department || p.dept || p.ward || "\u2014";
const lang = (p) => p.language || p.preferred_language || "Tamil";
const insurer = (p) => p.insurer || p.insurance || p.insurance_company || p.payor || "Self-pay";

const GRID = "160px minmax(140px,1fr) 80px 90px 120px 150px 130px 140px";

export default function PatientsView({ onSelectPatient, onOpenSoap, onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [admitted, setAdmitted] = useState([]);
  const [discharged, setDischarged] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let alive = true;
    const loadPatients = async (isSilent = false) => {
      if (!isSilent && admitted.length === 0 && discharged.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const [ar, dr] = await Promise.all([
          apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        ]);
        if (!alive) return;

        // Only patients whose discharge has been approved or completed are discharged.
        // If a discharge summary is only "Pending Approval" or a draft, the patient is still admitted!
        const rawDischarges = dr?.data || [];
        const actuallyDischargedRecords = rawDischarges.filter(r => {
          if (!r) return false;
          const approval = String(r.approval_status || '').trim().toLowerCase();
          const status = String(r.status || '').trim().toLowerCase();
          return approval === 'approved' || status === 'discharged' || r.is_discharged === true;
        });

        const dischargedTracker = extractDischargedPatientIds(actuallyDischargedRecords);
        const rawAdmissions = ar?.data || [];
        const actualAdmitted = rawAdmissions
          .filter(r => !dischargedTracker.has(r))
          .map(r => ({ ...parseAdmissionLlmRecord(r), _type: "IP", _status: parseAdmissionLlmRecord(r).status || "Admitted" }));

        const parsedDischarged = actuallyDischargedRecords.map(r => {
          const d = parseDischargeSummaryRecord(r);
          return {
            ...d,
            name: d.patient || d.name,
            age: d.age || r.age,
            sex: d.sex || (r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : r.gender.toLowerCase().startsWith('m') ? 'M' : r.gender) : 'F'),
            gender: d.gender || r.gender || 'Unknown',
            _type: "Discharged",
            _status: "Discharged"
          };
        });

        setAdmitted(actualAdmitted);
        setDischarged(parsedDischarged);
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
    let list = filter === "All" ? [...admitted, ...discharged]
      : filter === "IP" ? admitted
      : filter === "Discharged" ? discharged
      : admitted.filter(p => p._type === filter);
    if (!search.trim()) return list;
    const s = search.toLowerCase().trim();
    const isDigits = /^\d+$/.test(s);

    return list.filter(p => {
      const pidStr = p.patient_id !== undefined && p.patient_id !== null ? String(p.patient_id).trim() : "";
      const codeStr = p.patient_code ? String(p.patient_code).toLowerCase() : "";
      const mrnStr = p.mrn ? String(p.mrn).toLowerCase() : "";
      const uhidStr = p.uhid ? String(p.uhid).toLowerCase() : "";
      const computedUhid = pidStr ? `mer-2026-${pidStr.padStart(6, "0")}` : "";

      // When user searches a numeric ID (e.g. 87226), match exact patient_id or patient UHID/code!
      // Do NOT match admission_id or discharge summary id.
      if (isDigits) {
        return (
          pidStr === s ||
          computedUhid.endsWith(s) ||
          mrnStr.endsWith(s) ||
          uhidStr.endsWith(s) ||
          codeStr.endsWith(s)
        );
      }

      const name = p.name ? p.name.toLowerCase() : "";
      const doctor = p.doctor ? p.doctor.toLowerCase() : "";
      const diagnosis = p.diagnosis ? p.diagnosis.toLowerCase() : "";
      const diagnoses = p.diagnoses ? String(p.diagnoses).toLowerCase() : "";
      const phone = p.phone ? String(p.phone).toLowerCase() : "";

      return (
        pidStr.includes(s) ||
        codeStr.includes(s) ||
        mrnStr.includes(s) ||
        uhidStr.includes(s) ||
        computedUhid.includes(s) ||
        name.includes(s) ||
        doctor.includes(s) ||
        diagnosis.includes(s) ||
        diagnoses.includes(s) ||
        phone.includes(s)
      );
    });
  }, [admitted, discharged, filter, search]);

  const total = admitted.length + discharged.length;

  const exportCsv = () => {
    if (!rows.length) return alert("No records to export");
    const hdr = ["UHID","Name","Age","Sex","Language","Department","Doctor","Insurer","Status"];
    const lines = [hdr, ...rows.map(p => [p.mrn||p.patient_id||"", p.name||"", p.age||"", p.sex||"", lang(p), dept(p), p.doctor||"", insurer(p), p._status||""].map(v => `"${v}"`))]
      .map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([lines],{type:"text/csv"})), download: "patients.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* breadcrumb + title + actions */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span onClick={() => onNavigate && onNavigate("command")} style={{ cursor: "pointer", color: "oklch(0.5 0.1 200)" }}>{"\u2190 Back"}</span>
            {" \u00b7 "}<span>Clinical Workspace</span>{" \u00b7 "}<span>Patients</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>Patients</div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            {loading ? "Loading patients\u2026" : `${total} patients \u00b7 shared Patient 360 across every module`}
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

      {/* filter pills */}
      <div style={{ display: "flex", gap: "4px" }}>
        {["All","IP","OP","ER","Discharged"].map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={{ height: "28px", padding: "0 14px", borderRadius: "14px", border: "1px solid #e3e6e8",
              background: filter === f ? "#15181b" : "#fff", color: filter === f ? "#fff" : "#52585e",
              fontWeight: filter === f ? 600 : 400, fontSize: "12px", cursor: "pointer" }}>
            {f}
          </button>
        ))}
      </div>

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", overflowX: "auto" }}>
        {loading && admitted.length === 0 && discharged.length === 0 ? (
          <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[80,60,70,55,65].map((w,i) => <div key={i} style={{ height: "14px", borderRadius: "6px", background: "#eef0f1", animation: "mpulse 1s infinite", width: w+"%" }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a9096" }}>
            <div style={{ fontWeight: 600, color: "#52585e", marginBottom: "4px" }}>Nothing matches</div>
            {search ? `No records for "${search}". Clear the search or choose "All".` : "No patient records available."}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
              color: "#8a9096", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".04em",
              borderBottom: "1px solid #eef0f1", minWidth: "940px" }}>
              {["UHID","NAME","AGE \u00b7 SEX","LANGUAGE","DEPARTMENT","DOCTOR","INSURER","STATUS"].map(h => <span key={h}>{h}</span>)}
            </div>

            {rows.map((p, idx) => {
              const pill = getStatusPill(p._status);
              const uhid = p.mrn || (p.patient_id ? `MER-2026-${String(p.patient_id).padStart(6,"0")}` : `MER-2026-${String(idx+1).padStart(6,"0")}`);
              return (
                <div key={p.id || p.patient_id || idx}
                  onClick={() => onSelectPatient && onSelectPatient(p)}
                  onMouseEnter={e => e.currentTarget.style.background = "#f6f7f8"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
                    borderBottom: "1px solid #f2f3f4", alignItems: "center", cursor: "pointer",
                    fontSize: "12px", minWidth: "940px", transition: "background 0.1s" }}>
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

            <div style={{ padding: "6px 12px", color: "#8a9096", fontSize: "11px", borderTop: "1px solid #f2f3f4" }}>
              {rows.length} record{rows.length !== 1 ? "s" : ""} {"\u00b7"} click a row for Patient 360
            </div>
          </>
        )}
      </div>
    </div>
  );
}