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

const GRID = "140px minmax(130px,1fr) 80px 90px 110px 140px 120px 120px 90px";

export default function PatientsView({ onSelectPatient, onOpenSoap, onNavigate, userRole, doctorId, doctorName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [admitted, setAdmitted] = useState([]);
  const [discharged, setDischarged] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // WhatsApp Register Patient Modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('+91 ');
  const [waLoading, setWaLoading] = useState(false);

  // Edit Patient Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    city: '',
    blood_group: '',
    status: 'ACTIVE'
  });
  const [editLoading, setEditLoading] = useState(false);

  const loadPatients = async (isSilent = false) => {
    if (!isSilent && admitted.length === 0 && discharged.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const patientParams = { per_page: 100 };
      if (userRole === 'Doctor' && doctorId) {
        patientParams.doctor_id = doctorId;
      }

      const [dashRes, ar, dr] = await Promise.all([
        apiService.getDashboardPatients(patientParams, { forceRefresh: true }).catch(() => null),
        apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
      ]);

      let dbPatients = [];
      if (dashRes?.patients?.length > 0) {
        dbPatients = dashRes.patients.map(p => ({
          id: p.id,
          patient_id: p.id,
          mrn: p.patient_code || `MER-${p.id}`,
          first_name: p.first_name,
          last_name: p.last_name,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient',
          age: p.date_of_birth ? (new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()) : '—',
          sex: p.gender === 'FEMALE' ? 'F' : p.gender === 'MALE' ? 'M' : (p.gender || 'F'),
          phone: p.phone || '',
          whatsapp_number: p.whatsapp_number || '',
          email: p.email || '',
          city: p.city || '',
          blood_group: p.blood_group || '',
          language: 'English',
          department: p.city ? `${p.city}` : 'General OPD',
          doctor: 'Consultant Specialist',
          insurer: p.blood_group ? `Blood Group: ${p.blood_group}` : 'Registered Patient',
          _type: p.status === 'ACTIVE' ? 'IP' : 'Discharged',
          _status: p.status === 'ACTIVE' ? 'Admitted' : (p.status || 'Active')
        }));
      }

      const dischargedTracker = extractDischargedPatientIds(dr?.data || []);
      const rawAdmissions = ar?.data || [];
      const actualAdmitted = rawAdmissions
        .filter(r => !dischargedTracker.has(r))
        .map(r => ({ ...parseAdmissionLlmRecord(r), _type: "IP", _status: parseAdmissionLlmRecord(r).status || "Admitted" }));

      const parsedDischarged = (dr?.data || []).map(r => {
        const d = parseDischargeSummaryRecord(r);
        return { ...d, name: d.patient || d.name, _type: "Discharged", _status: d.discharge_time ? "Discharged " + d.discharge_time : "Discharged" };
      });

      const existingMrns = new Set([...actualAdmitted, ...parsedDischarged].map(x => x.mrn || x.patient_id));
      const uniqueDbPatients = dbPatients.filter(p => !existingMrns.has(p.mrn) && !existingMrns.has(p.id));

      setAdmitted([...uniqueDbPatients, ...actualAdmitted]);
      setDischarged(parsedDischarged);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    loadPatients();

    const timer = setInterval(() => {
      if (alive) loadPatients(true);
    }, 6000);

    const handleUpdate = () => {
      if (alive) loadPatients(true);
    };
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
    const s = search.toLowerCase();
    return list.filter(p =>
      [p.name, p.mrn, p.doctor, p.phone, p.whatsapp_number, p.city].some(v => v && String(v).toLowerCase().includes(s))
    );
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

  // WhatsApp Register Patient submit
  const handleRegisterWhatsApp = async (e) => {
    e.preventDefault();
    const raw = whatsappNumber.trim();
    if (!raw || raw.length < 10) {
      setError('Please enter a valid WhatsApp number.');
      return;
    }
    setWaLoading(true);
    setError(null);
    try {
      const res = await apiService.addPatientWhatsApp(raw);
      if (res.success) {
        setActionSuccess(res.message || 'Welcome message sent to patient WhatsApp!');
        setTimeout(() => setActionSuccess(''), 4000);
        setShowWhatsAppModal(false);
        setWhatsappNumber('+91 ');
        loadPatients();
      } else {
        setError(res.error || res.message || 'Failed to send WhatsApp message.');
      }
    } catch (err) {
      setError(err.message || 'Failed to register patient via WhatsApp.');
    } finally {
      setWaLoading(false);
    }
  };

  // Open Edit Patient modal
  const openEditPatient = (p, e) => {
    if (e) e.stopPropagation();
    setEditingPatient(p);
    const nameParts = (p.name || '').split(' ');
    setEditForm({
      first_name: p.first_name || nameParts[0] || '',
      last_name: p.last_name || nameParts.slice(1).join(' ') || '',
      phone: p.phone || '',
      whatsapp_number: p.whatsapp_number || p.phone || '',
      email: p.email || '',
      city: p.city || '',
      blood_group: p.blood_group || '',
      status: p.status || 'ACTIVE'
    });
    setShowEditModal(true);
  };

  // Edit Patient Submit
  const handleEditPatientSubmit = async (e) => {
    e.preventDefault();
    if (!editingPatient || (!editingPatient.id && !editingPatient.patient_id)) {
      setError('Cannot edit virtual record without DB ID.');
      return;
    }
    const pid = editingPatient.patient_id || editingPatient.id;
    setEditLoading(true);
    setError(null);
    try {
      await apiService.updateDashboardPatient(pid, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim(),
        whatsapp_number: editForm.whatsapp_number.trim(),
        email: editForm.email.trim(),
        city: editForm.city.trim(),
        blood_group: editForm.blood_group.trim(),
        status: editForm.status
      });
      setActionSuccess(`Patient ${editForm.first_name} ${editForm.last_name} updated successfully!`);
      setTimeout(() => setActionSuccess(''), 3000);
      setShowEditModal(false);
      setEditingPatient(null);
      loadPatients();
    } catch (err) {
      setError(err.message || 'Failed to update patient details.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header */}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search\u2026"
            style={{ height: "30px", width: "200px", border: "1px solid #e3e6e8", borderRadius: "6px", padding: "0 10px", fontSize: "12px", outline: "none" }} />
          <button type="button" onClick={exportCsv}
            style={{ height: "30px", padding: "0 12px", borderRadius: "6px", border: "1px solid #e3e6e8", background: "#fff", cursor: "pointer", fontSize: "12px" }}>
            Export CSV
          </button>
          <button type="button" onClick={() => setShowWhatsAppModal(true)}
            style={{ height: "30px", padding: "0 12px", borderRadius: "6px", border: 0, background: "oklch(0.5 0.1 200)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "12px" }}>
            + Register patient
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ background: "oklch(0.95 0.04 150)", border: "1px solid oklch(0.85 0.08 150)", borderRadius: "6px", padding: "8px 12px", color: "oklch(0.35 0.12 150)", fontSize: "12px" }}>
          ✓ {actionSuccess}
        </div>
      )}

      {error && <div style={{ background: "oklch(0.96 0.03 25)", border: "1px solid oklch(0.88 0.06 25)", borderRadius: "6px", padding: "9px 12px", color: "oklch(0.45 0.17 25)", fontSize: "12px" }}>Unable to load: {error}</div>}

      {/* Filter pills */}
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

      {/* Table */}
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
              borderBottom: "1px solid #eef0f1", minWidth: "980px" }}>
              {["UHID","NAME","AGE \u00b7 SEX","LANGUAGE","DEPARTMENT","DOCTOR","INSURER","STATUS","ACTION"].map(h => <span key={h}>{h}</span>)}
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
                    fontSize: "12px", minWidth: "980px", transition: "background 0.1s" }}>
                  <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "11px", color: "#8a9096" }}>{uhid}</span>
                  <span style={{ fontWeight: 600, color: "#15181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "\u2014"}</span>
                  <span style={{ color: "#52585e" }}>{p.age ? `${p.age} \u00b7 ${p.sex || "F"}` : "\u2014"}</span>
                  <span style={{ color: "#52585e" }}>{lang(p)}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dept(p)}</span>
                  <span style={{ color: "oklch(0.45 0.1 200)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.doctor || "\u2014"}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insurer(p)}</span>
                  <span><span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: pill.bg, color: pill.fg, whiteSpace: "nowrap" }}>{pill.label}</span></span>
                  <span>
                    <button
                      type="button"
                      onClick={(e) => openEditPatient(p, e)}
                      style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </span>
                </div>
              );
            })}

            <div style={{ padding: "6px 12px", color: "#8a9096", fontSize: "11px", borderTop: "1px solid #f2f3f4" }}>
              {rows.length} record{rows.length !== 1 ? "s" : ""} {"\u00b7"} click a row for Patient 360
            </div>
          </>
        )}
      </div>

      {/* Register Patient (WhatsApp) Modal */}
      {showWhatsAppModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.5 0.1 200)' }}>💬 Register Patient via WhatsApp</div>
              <button type="button" onClick={() => setShowWhatsAppModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8a9096' }}>✕</button>
            </div>
            <form onSubmit={handleRegisterWhatsApp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Patient WhatsApp Number</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  style={{ width: '100%', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '14px' }}
                  required
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Sends instant automated WhatsApp welcome message & creates live patient record.</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowWhatsAppModal(false)} style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={waLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>{waLoading ? 'Sending…' : 'Send Welcome Message'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && editingPatient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Edit Patient Details</div>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8a9096' }}>✕</button>
            </div>
            <form onSubmit={handleEditPatientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>First Name</label>
                  <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Last Name</label>
                  <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Phone Number</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>WhatsApp Number</label>
                  <input value={editForm.whatsapp_number} onChange={e => setEditForm({ ...editForm, whatsapp_number: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Email Address</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>City</label>
                  <input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Blood Group</label>
                  <input value={editForm.blood_group} onChange={e => setEditForm({ ...editForm, blood_group: e.target.value })} placeholder="O+" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={editLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>{editLoading ? 'Saving…' : 'Save Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}