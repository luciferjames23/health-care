import React, { useState } from 'react';

const INITIAL_PATIENTS = [
  {
    id: 1, name: "Ramesh Kumar", age: 58, sex: "M", mrn: "004471", ward: "Cardiology · Bed 4B-12",
    admitted: "03 Sep", diagnosisShort: "NSTEMI, s/p PCI", diagnosisSub: "Cardiology",
    billing: "cleared", due: 0, of: 84500, discharged: false,
    rawNote: `Pt: Kumar, R. · 58M · MRN 004471
Adm: 03-Sep · Disch: 09-Sep

Dx: NSTEMI, single vessel, s/p PCI to LAD 04-Sep. HTN, T2DM (known).

Meds on disch:
Aspirin 75mg OD, Clopidogrel 75mg OD, Atorvastatin 40mg ON,
Metoprolol 25mg BD, Ramipril 2.5mg OD, Metformin 500mg BD

Ix: Troponin peak 4.8, TLC 9800, Echo — EF 48%,
mild hypokinesia inf wall. {{FLAG}}Cr 1.3, up from 0.9 baseline{{/FLAG}} — monitor.

Plan: cardiac rehab OP, f/u cardiology 2/52,
repeat Cr + lipid panel 1/52, low salt/DM diet counselling given.`,
    summary: {
      why: "You came to the hospital with a heart attack (a blockage in one of the arteries feeding your heart). A small tube called a stent was placed on 4 September to reopen the artery.",
      dx: "Heart attack (NSTEMI), treated with a stent to one artery. You also have high blood pressure and type 2 diabetes, which we're continuing to manage.",
      meds: [
        ["Aspirin","75mg, once daily","Prevents clots"],
        ["Clopidogrel","75mg, once daily","Prevents clots"],
        ["Atorvastatin","40mg, at night","Lowers cholesterol"],
        ["Metoprolol","25mg, twice daily","Protects the heart"],
        ["Ramipril","2.5mg, once daily","Blood pressure"],
        ["Metformin","500mg, twice daily","Blood sugar"]
      ],
      followup: "Cardiology check-up in 2 weeks. Blood test (kidney function and cholesterol) in 1 week — your kidney reading was slightly elevated during your stay, so we're keeping an eye on it.",
      warnings: ["Chest pain or breathlessness that doesn't go away with rest","Swelling in your legs or sudden weight gain","Bleeding or bruising that doesn't stop"]
    }
  },
  {
    id: 2, name: "Priya Nair", age: 31, sex: "F", mrn: "004488", ward: "General Medicine · Bed 2A-05",
    admitted: "05 Sep", diagnosisShort: "Dengue fever", diagnosisSub: "General Medicine",
    billing: "pending", due: 18400, of: 18400, discharged: false,
    rawNote: `Pt: Nair, P. · 31F · MRN 004488
Adm: 05-Sep · Disch: 09-Sep

Dx: Dengue fever (NS1 +ve), no warning signs. Resolved fever day 4.

Meds on disch:
Paracetamol 650mg SOS (fever), ORS as needed,
avoid NSAIDs x2/52

Ix: Platelet nadir 92,000 (day 3), recovered to 168,000 at disch.
Hct stable. {{FLAG}}Advise repeat CBC if fever/bleeding recurs{{/FLAG}}.

Plan: rest, hydration, f/u OPD if symptoms recur.
No routine f/u needed unless symptomatic.`,
    summary: {
      why: "You were admitted with dengue fever, a viral infection spread by mosquitoes. Your platelet count dropped, which we monitored closely, and it has now recovered.",
      dx: "Dengue fever, without warning signs. Your blood counts have returned to a safe range.",
      meds: [
        ["Paracetamol","650mg, as needed for fever","Fever/pain relief"],
        ["ORS solution","As needed","Stay hydrated"]
      ],
      followup: "No routine follow-up needed unless symptoms return. Avoid pain relievers like ibuprofen or aspirin for 2 weeks — they can increase bleeding risk after dengue.",
      warnings: ["Fever returning after being fever-free for 24 hours","Any unusual bleeding or bruising","Severe abdominal pain or persistent vomiting"]
    }
  },
  {
    id: 3, name: "Arjun Reddy", age: 44, sex: "M", mrn: "004502", ward: "Orthopedics · Bed 3C-08",
    admitted: "01 Sep", diagnosisShort: "Fractured femur, s/p ORIF", diagnosisSub: "Orthopedics",
    billing: "partial", due: 32000, of: 95000, discharged: false,
    rawNote: `Pt: Reddy, A. · 44M · MRN 004502
Adm: 01-Sep · Disch: 09-Sep

Dx: Closed # shaft femur (L), s/p ORIF with IM nail 02-Sep. Post-op stable.

Meds on disch:
Tab Diclofenac 50mg BD x5d, Tab Pantoprazole 40mg OD,
Cap Doxycycline... {{FLAG}}[illegible - confirm abx choice with ortho team]{{/FLAG}}
Enoxaparin 40mg SC OD x2/52 (DVT ppx)

Ix: Hb 10.8 (post-op drop from 13.2), Xray — good alignment, nail in situ.

Plan: NWB (L) leg 6/52, physio started, f/u ortho OPD 2/52 with Xray,
staple removal 12-14 days at local clinic.`,
    summary: {
      why: "You broke the large bone in your left thigh (femur). Surgeons fixed it on 2 September using a metal rod inside the bone, and it's healing well.",
      dx: "Fracture of the left thigh bone, repaired with an internal rod. Your blood count dropped a little after surgery, which is expected and being watched.",
      meds: [
        ["Diclofenac","50mg, twice daily for 5 days","Pain relief"],
        ["Pantoprazole","40mg, once daily","Protects your stomach"],
        ["Enoxaparin (injection)","40mg, once daily for 2 weeks","Prevents blood clots"]
      ],
      followup: "Do not put weight on your left leg for 6 weeks. Physiotherapy has started. Follow-up with orthopedics in 2 weeks with a new X-ray. Stitches/staples removed at a local clinic around day 12–14.",
      warnings: ["Swelling, redness, or pain in your calf (possible clot)","Increasing pain, warmth, or discharge at the surgical site","Fever above 101°F"]
    }
  },
  {
    id: 4, name: "Fatima Sheikh", age: 27, sex: "F", mrn: "004515", ward: "Obstetrics · Bed 1B-02",
    admitted: "07 Sep", diagnosisShort: "Normal vaginal delivery", diagnosisSub: "Obstetrics",
    billing: "cleared", due: 0, of: 42000, discharged: false,
    rawNote: `Pt: Sheikh, F. · 27F · MRN 004515
Adm: 07-Sep · Disch: 09-Sep

Dx: Term NVD, live birth, baby well. Mother stable postpartum.

Meds on disch:
Tab Ferrous sulfate + folic acid OD x3/12, Tab Paracetamol SOS,
Tab Calcium OD

Ix: Hb 10.5 postpartum, BP stable, lochia normal.

Plan: postnatal f/u 1/52, baby ped f/u 1/52 for weight check + vaccination,
breastfeeding counselling given, contraception counselling deferred to f/u.`,
    summary: {
      why: "You had a healthy vaginal delivery. Both you and your baby are doing well.",
      dx: "Normal delivery, no complications. Your blood count is slightly low, which is common after delivery — the iron tablets will help.",
      meds: [
        ["Iron + folic acid","Once daily for 3 months","Rebuilds blood count"],
        ["Calcium","Once daily","Bone health"],
        ["Paracetamol","As needed","Pain relief"]
      ],
      followup: "Postnatal check-up in 1 week. Baby's check-up in 1 week for weight and first vaccinations. We covered breastfeeding basics — contraception options can be discussed at your follow-up.",
      warnings: ["Heavy bleeding (soaking a pad in under an hour)","Fever, chills, or foul-smelling discharge","Severe headache or vision changes"]
    }
  },
  {
    id: 5, name: "George Thomas", age: 66, sex: "M", mrn: "004529", ward: "Nephrology · Bed 4A-03",
    admitted: "04 Sep", diagnosisShort: "CKD exacerbation", diagnosisSub: "Nephrology",
    billing: "pending", due: 54200, of: 54200, discharged: false,
    rawNote: `Pt: Thomas, G. · 66M · MRN 004529
Adm: 04-Sep · Disch: 09-Sep

Dx: CKD stage 4 on top of baseline, acute-on-chronic worsening, likely
NSAID-related. No dialysis needed this admission.

Meds on disch:
Tab Nicardia Retard 20mg BD, Tab Torsemide 10mg OD,
Tab Sodibic 650mg BD, Avoid all NSAIDs — {{FLAG}}counsel pt re: OTC painkillers{{/FLAG}}

Ix: Cr 3.8 on admission, down to 2.9 at disch (baseline ~2.4).
K+ 5.1, stable. eGFR ~22.

Plan: nephro OPD f/u 1/52 with repeat RFT + electrolytes,
dietary counselling (low K, low phosphate) given, weigh daily at home.`,
    summary: {
      why: "Your kidneys, which were already working at reduced capacity, became more strained — most likely from a pain-relief medication. You did not need dialysis this time.",
      dx: "Worsening of chronic kidney disease (stage 4). Your kidney function improved with treatment but has not returned fully to your usual baseline.",
      meds: [
        ["Nicardia Retard","20mg, twice daily","Blood pressure"],
        ["Torsemide","10mg, once daily","Reduces fluid buildup"],
        ["Sodibic","650mg, twice daily","Corrects blood acidity"]
      ],
      followup: "Nephrology follow-up in 1 week with repeat blood tests. Please avoid all over-the-counter pain relievers like ibuprofen — they can worsen kidney function. Weigh yourself daily and follow the low-potassium, low-phosphate diet discussed with you.",
      warnings: ["Weight gain of more than 1kg in a day, or swelling","Reduced urine output","Confusion, severe weakness, or irregular heartbeat"]
    }
  },
  {
    id: 6, name: "Jeevalgin MR", age: 24, sex: "M", mrn: "2603449", ward: "General Medicine · Visit 202609090005",
    admitted: "09 Sep", diagnosisShort: "Acute Febrile Illness (Fever)", diagnosisSub: "General Medicine",
    billing: "cleared", due: 0, of: 15000, discharged: true, signedBy: "Dr. KUAR", signedDate: "09 Sep 2026",
    rawNote: `Pt: Jeevalgin MR · 24M · Reg 2603449 · Visit 202609090005
Addr: 103, GOUNDAR KOTTAYI, Maiyanur, Sankarapuram, Viluppuram, TN · Ph: 9360345065
Adm: 09/09/2026 12:25 PM · Disch: 09/09/2026 12:27 PM · Cert: DS26000023

Dx: Acute Febrile Illness (Fever)

History: Fever x3 days associated with chills, body pain & generalized weakness. No seizures or altered sensorium.

Ix: Chest X-Ray — No significant abnormality. ECG — Normal sinus rhythm.
Lab: CBC, Dengue NS1/IgM, Malaria Parasite/RDT, Widal/Blood Culture. {{FLAG}}Advise repeat blood counts if fever recurs{{/FLAG}}.

Rx Given: IV fluids, antipyretics & supportive care.

Surgery Details: Surgeon Dr. KUAR / Anaesthetist Dr. KUAR.

Health Ed & Follow-up: Adequate oral fluids, proper nutrition, rest, daily temp monitoring. Return immediately if fever recurs.`,
    summary: {
      why: "You were admitted with a high fever lasting 3 days, accompanied by chills, body pain, and general weakness.",
      dx: "Acute Febrile Illness (Fever). Chest X-ray and ECG were normal. Infection screenings were performed and supportive treatments were provided.",
      meds: [
        ["Paracetamol","650mg, as needed","Fever and body pain relief"],
        ["ORS solution","As needed","Hydration & fluid balance"],
        ["Multivitamin","Once daily","Supportive recovery"]
      ],
      followup: "Rest adequately, maintain high fluid intake and proper nutrition at home. Monitor body temperature daily. Follow-up at the outpatient clinic in 5–7 days or immediately if symptoms worsen.",
      warnings: ["Fever returning or not responding to medication","Severe body pain, headache, or neck stiffness","Persistent vomiting, abdominal pain, or unusual rash/bleeding"]
    }
  }
];

function billLabel(status) {
  if (status === "cleared") return "Cleared";
  if (status === "pending") return "Pending";
  return "Partial";
}

function fmtINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function SummaryContent({ s }) {
  if (!s) return null;
  return (
    <>
      <div className="osec">
        <h3>Why you were admitted</h3>
        <p>{s.why}</p>
      </div>
      <div className="osec">
        <h3>Your diagnosis</h3>
        <p>{s.dx}</p>
      </div>
      <div className="osec">
        <h3>Your medications</h3>
        <table className="med-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Dose</th>
              <th>What it's for</th>
            </tr>
          </thead>
          <tbody>
            {s.meds.map((m, i) => (
              <tr key={i}>
                <td className="med-name">{m[0]}</td>
                <td>{m[1]}</td>
                <td className="med-note">{m[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="osec">
        <h3>Follow-up</h3>
        <p>{s.followup}</p>
      </div>
      <div className="osec">
        <h3>Call your doctor right away if you notice</h3>
        <div className="warn-box">
          <ul>
            {s.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalPatientId, setModalPatientId] = useState(null);
  const [generatedMap, setGeneratedMap] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [signPanelOpen, setSignPanelOpen] = useState(false);
  const [signName, setSignName] = useState('');
  const [signDate, setSignDate] = useState('09 Sep 2026');

  // Calculated Ward Stats
  const totalCount = patients.length;
  const clearedCount = patients.filter(p => p.billing === 'cleared').length;
  const outstandingCount = patients.filter(p => p.billing !== 'cleared').length;
  const dischargedCount = patients.filter(p => p.discharged).length;

  const currentPatient = patients.find(p => p.id === modalPatientId);

  const openModal = (id) => {
    setModalPatientId(id);
    setSignPanelOpen(false);
    setSignName('');
    setSignDate('09 Sep 2026');
  };

  const closeModal = () => {
    setModalPatientId(null);
    setIsGenerating(false);
  };

  const handleGenerate = () => {
    if (!currentPatient) return;
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedMap(prev => ({ ...prev, [currentPatient.id]: true }));
      setIsGenerating(false);
    }, 850);
  };

  const handleConfirmSign = () => {
    if (!currentPatient) return;
    const finalName = signName.trim() || "Dr. (unspecified)";
    const finalDate = signDate.trim() || "09 Sep 2026";

    setPatients(prev => prev.map(p => {
      if (p.id === currentPatient.id) {
        return {
          ...p,
          discharged: true,
          signedBy: finalName,
          signedDate: finalDate
        };
      }
      return p;
    }));

    setSignPanelOpen(false);
  };

  const handlePrint = () => {
    if (!currentPatient) return;
    window.print();
  };

  const filterChips = [
    { key: "all", label: "All patients" },
    { key: "cleared", label: "Billing cleared" },
    { key: "pending", label: "Billing pending" },
    { key: "partial", label: "Billing partial" }
  ];

  const filteredPatients = patients.filter(p => {
    if (activeFilter !== 'all' && p.billing !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.ward.toLowerCase().includes(q) ||
        p.diagnosisShort.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const isCurrentGenerated = currentPatient ? (currentPatient.discharged || !!generatedMap[currentPatient.id]) : false;

  const renderRawNoteContent = (rawText) => {
    const parts = rawText.split(/(\{\{FLAG\}\}.*?\{\{\/FLAG\}\})/g);
    return parts.map((part, idx) => {
      if (part.startsWith('{{FLAG}}') && part.endsWith('{{/FLAG}}')) {
        const flagText = part.replace('{{FLAG}}', '').replace('{{/FLAG}}', '');
        return <span key={idx} className="flag">{flagText}</span>;
      }
      return part;
    });
  };

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-mark"></div>
            <div className="brand-name">DischargeNote</div>
          </div>
          <div className="masthead-meta">
            INTERNAL DEMO<br />Ward view · v0.3
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="hero-eyebrow">Automated Clinical Discharge Summary Generator</div>
          <h1>Every admitted patient, their billing status, and a discharge summary — one screen.</h1>
          <p className="hero-sub">
            Search or filter the ward list, generate a plain-language summary per patient, and route it through clinician sign-off before it's finalized or printed.
          </p>
        </section>

        <div className="ward-strip" id="wardStrip">
          <div className="ward-stat">
            <div className="ward-stat-num">{totalCount}</div>
            <div className="ward-stat-label">Currently admitted, this ward</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num">{clearedCount}</div>
            <div className="ward-stat-label">Billing fully cleared</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num">{outstandingCount}</div>
            <div className="ward-stat-label">Billing pending or partial</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num">{dischargedCount} / {totalCount}</div>
            <div className="ward-stat-label">Summaries signed &amp; finalized</div>
          </div>
        </div>

        <section className="list-section">
          <div className="list-head-row">
            <div>
              <h2 className="section-heading">Admitted patients</h2>
              <p className="section-sub">
                Generating a summary is independent of billing — but discharge paperwork can be flagged until the bill clears.
              </p>
            </div>
            <div className="list-controls">
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  id="searchInput"
                  placeholder="Search by name, MRN, or ward…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="filter-chips" id="filterChips" style={{ marginBottom: '16px' }}>
            {filterChips.map(c => (
              <button
                key={c.key}
                className={`chip ${activeFilter === c.key ? 'active' : ''}`}
                onClick={() => setActiveFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="patient-table-frame">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Diagnosis</th>
                  <th>Admitted</th>
                  <th>Billing status</th>
                  <th>Amount due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="patientRows">
                {filteredPatients.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan="6">No patients match this search or filter.</td>
                  </tr>
                ) : (
                  filteredPatients.map(p => (
                    <tr key={p.id} className={p.discharged ? 'discharged' : ''}>
                      <td>
                        <div className="p-name">
                          {p.name} {p.discharged && <span className="discharged-badge">Signed</span>}
                        </div>
                        <div className="p-meta">
                          MRN {p.mrn} · {p.age}{p.sex} · {p.ward}
                        </div>
                      </td>
                      <td className="p-diagnosis">
                        {p.diagnosisShort}
                        <span className="dx-sub">{p.diagnosisSub}</span>
                      </td>
                      <td>{p.admitted}</td>
                      <td>
                        <span className={`bill-pill ${p.billing}`}>
                          <span className="dot"></span>
                          {billLabel(p.billing)}
                        </span>
                      </td>
                      <td>
                        {p.due === 0 ? (
                          <span className="amount-due zero">₹0</span>
                        ) : (
                          <span className="amount-due">
                            {fmtINR(p.due)} <span className="of">of {fmtINR(p.of)}</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn-gen ${p.discharged ? 'done' : ''}`}
                          onClick={() => openModal(p.id)}
                        >
                          {p.discharged ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              View summary
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                              </svg>
                              Generate discharge summary
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal */}
      {currentPatient && (
        <div
          className="modal-overlay open"
          id="modalOverlay"
          onClick={(e) => {
            if (e.target.id === 'modalOverlay') closeModal();
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <div>
                <div className="modal-title" id="modalPatientName">
                  {currentPatient.name}
                </div>
                <div className="modal-sub" id="modalPatientMeta">
                  MRN {currentPatient.mrn} · {currentPatient.age}{currentPatient.sex} · {currentPatient.ward} · Admitted {currentPatient.admitted}
                </div>
              </div>
              <div className="modal-head-actions">
                {isCurrentGenerated && (
                  <button className="icon-btn" id="printBtn" onClick={handlePrint}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                    </svg>
                    Print
                  </button>
                )}
                <button className="modal-close" onClick={closeModal}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={`billing-banner ${currentPatient.billing}`} id="billingBanner">
              {currentPatient.billing === 'cleared' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Billing cleared — this patient can be discharged as soon as the summary is signed.</span>
                </>
              )}
              {currentPatient.billing === 'pending' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    Billing pending — {fmtINR(currentPatient.due)} due in full. The clinical summary can still be drafted, but discharge paperwork will be held until billing clears.
                  </span>
                </>
              )}
              {currentPatient.billing === 'partial' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    Billing partially cleared — {fmtINR(currentPatient.due)} of {fmtINR(currentPatient.of)} still due. Summary can be drafted; discharge paperwork held until the balance clears.
                  </span>
                </>
              )}
            </div>

            <div className="modal-body">
              <div>
                <div className="pane-label">Clinical record (raw)</div>
                <div className="raw-note" id="modalRawNote">
                  {renderRawNoteContent(currentPatient.rawNote)}
                </div>
                {!currentPatient.discharged && (
                  <div className="generate-row">
                    <button
                      className="btn-generate"
                      id="modalGenBtn"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      style={{ opacity: isGenerating ? 0.7 : 1 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                      </svg>
                      <span id="modalGenLabel">
                        {isGenerating
                          ? "Generating…"
                          : generatedMap[currentPatient.id]
                          ? "Summary generated"
                          : "Generate discharge summary"}
                      </span>
                    </button>
                    <span className="generate-hint">~40 min saved</span>
                  </div>
                )}
              </div>

              <div>
                <div className="pane-label">Patient discharge summary</div>
                {!isCurrentGenerated ? (
                  <div className="output-empty" id="modalOutputEmpty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12h6M9 16h6M9 8h6M5 4h10l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                    </svg>
                    Click "Generate discharge summary" to draft the plain-language version for this patient.
                  </div>
                ) : (
                  <div className="output-doc show" id="modalOutputDoc">
                    <SummaryContent s={currentPatient.summary} />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-foot">
              <div className="modal-foot-row">
                <div className="modal-foot-note" id="modalFootNote">
                  {currentPatient.billing === 'cleared'
                    ? "A clinician must review and sign before this summary is finalized."
                    : currentPatient.billing === 'pending'
                    ? "Billing must clear before final discharge paperwork can be issued."
                    : "Remaining balance must clear before final discharge paperwork can be issued."}
                </div>
                <button
                  className="btn-sign"
                  id="modalSignBtn"
                  disabled={!isCurrentGenerated || currentPatient.discharged}
                  onClick={() => setSignPanelOpen(prev => !prev)}
                >
                  {currentPatient.discharged ? "Already signed" : "Review & sign"}
                </button>
              </div>

              <div className={`sign-panel ${signPanelOpen ? 'open' : ''}`} id="signPanel">
                <div className="sign-field">
                  <label>Signing clinician</label>
                  <input
                    type="text"
                    id="signName"
                    placeholder="Dr. …"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                </div>
                <div className="sign-field">
                  <label>Date</label>
                  <input
                    type="text"
                    id="signDate"
                    value={signDate}
                    onChange={(e) => setSignDate(e.target.value)}
                  />
                </div>
                <button className="btn-confirm" onClick={handleConfirmSign}>
                  Confirm &amp; finalize
                </button>
              </div>

              {currentPatient.discharged && (
                <div className="signed-note show" id="signedNote">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span id="signedText">
                    Signed by {currentPatient.signedBy || 'clinician'} on {currentPatient.signedDate || '—'}.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print-only container */}
      {currentPatient && (
        <div id="printArea">
          <div className="print-page">
            <div className="print-header">
              <div>
                <div className="print-title">Discharge Summary</div>
                <div style={{ fontSize: '13px', color: '#4B564F', marginTop: '2px' }}>
                  {currentPatient.ward}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#4B564F' }}>
                DischargeNote Clinical Summary<br />
                Date: {currentPatient.signedDate || '09 Sep 2026'}
              </div>
            </div>

            <div className="print-meta-grid">
              <div><strong>Patient Name:</strong> {currentPatient.name}</div>
              <div><strong>MRN / Reg No:</strong> {currentPatient.mrn}</div>
              <div><strong>Age / Sex:</strong> {currentPatient.age} / {currentPatient.sex}</div>
              <div><strong>Admitted Date:</strong> {currentPatient.admitted}</div>
              <div><strong>Diagnosis:</strong> {currentPatient.diagnosisShort}</div>
              <div><strong>Billing Status:</strong> {currentPatient.billing.toUpperCase()}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">1. Why You Were Admitted</div>
              <div className="print-sec-body">{currentPatient.summary.why}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">2. Diagnosis &amp; Clinical Details</div>
              <div className="print-sec-body">{currentPatient.summary.dx}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">3. Discharge Medications</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage &amp; Frequency</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPatient.summary.meds.map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m[0]}</strong></td>
                      <td>{m[1]}</td>
                      <td>{m[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">4. Follow-up &amp; Care Instructions</div>
              <div className="print-sec-body">{currentPatient.summary.followup}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">5. Emergency Warning Signs</div>
              <div className="print-warn-box">
                <ul>
                  {currentPatient.summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="print-sig-box">
              <div className="print-sig-line">
                Prepared / Verified By
              </div>
              <div className="print-sig-line">
                Clinician Signature: {currentPatient.discharged ? (currentPatient.signedBy || 'Dr. KUAR') : '___________________'}
                <br />
                Date: {currentPatient.discharged ? (currentPatient.signedDate || '09 Sep 2026') : '____/____/________'}
              </div>
            </div>

            <div className="print-footer">
              <div>DischargeNote — Confidential Medical Record</div>
              <div>
                {currentPatient.discharged
                  ? `Signed & Finalized by ${currentPatient.signedBy} on ${currentPatient.signedDate}`
                  : 'DRAFT — Pending Clinician Sign-off'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
