import React, { useState, useEffect } from 'react';
import XrayOrders from './XrayOrders';
import { apiService } from '../services/api';

/**
 * XrayOrdersView — Standalone "Request an X-Ray" page accessible from the sidebar.
 * Lets a doctor search for a patient and submit an X-ray order, or a radiologist
 * manage all pending orders.
 */
export default function XrayOrdersView({ userRole, doctorName, onSelectPatient }) {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const isRadiologist = userRole?.toLowerCase() === 'radiologist';
  const isDoctor = userRole?.toLowerCase() === 'doctor';

  // Search for patients when query changes
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiService.getCurrentAdmissions({ search: search.trim() });
        setPatients((res?.data || []).slice(0, 12));
      } catch {
        setPatients([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const selectPatient = (p) => {
    const pid = p.patient_id || p.id;
    const uhid = p.patient_code || p.mrn || (pid ? `MER-PAT-${String(pid).padStart(7, '0')}` : '');
    const name = p.name || p.patient_name || p.patient || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Patient #${pid}`;
    setSelectedPatient({ ...p, patient_id: pid, uhid, name });
    setSearch('');
    setPatients([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      {/* Page header */}
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          Diagnostics · LIS &amp; Imaging › <strong>Request an X-Ray</strong>
        </div>
        <div style={{ fontSize: '21px', fontWeight: 700, color: '#15181b' }}>
          {isRadiologist ? 'X-Ray Orders — Radiologist Queue' : 'Request an X-Ray'}
        </div>
        <div style={{ fontSize: '12px', color: '#687076', marginTop: '2px' }}>
          {isRadiologist
            ? 'Manage pending X-ray orders, confirm patient identity and upload DICOM images to Orthanc PACS.'
            : 'Search for an admitted patient, then complete the X-ray request form below.'}
        </div>
      </div>

      {/* Patient search — only for doctors */}
      {!isRadiologist && (
        <div style={{
          background: '#fff', border: '1px solid #e3e6e8', borderRadius: '10px', padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#15181b' }}>
            🔍 Select Patient
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, MRN, or encounter…"
              style={{
                width: '100%', boxSizing: 'border-box',
                height: '36px', padding: '0 12px', fontSize: '13px',
                border: '1px solid #d0d4d8', borderRadius: '7px', outline: 'none',
              }}
            />
            {searching && (
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8' }}>
                Searching…
              </span>
            )}
            {patients.length > 0 && (
              <div style={{
                position: 'absolute', top: '40px', left: 0, right: 0, zIndex: 20,
                background: '#fff', border: '1px solid #d0d4d8', borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden'
              }}>
                {patients.map((p, i) => {
                  const pid = p.patient_id || p.id;
                  const name = p.name || p.patient_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Patient #${pid}`;
                  const code = p.patient_code || p.mrn || (pid ? `MER-PAT-${String(pid).padStart(7, '0')}` : '');
                  return (
                    <div
                      key={pid || i}
                      onClick={() => selectPatient(p)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                        borderBottom: i < patients.length - 1 ? '1px solid #f1f3f4' : 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ fontSize: '11px', color: '#687076', fontFamily: 'monospace' }}>{code}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', background: 'oklch(0.96 0.04 185)',
              borderRadius: '8px', border: '1px solid oklch(0.85 0.07 185)'
            }}>
              <span style={{ fontSize: '20px' }}>🧑‍⚕️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'oklch(0.35 0.1 185)' }}>
                  {selectedPatient.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'oklch(0.5 0.08 185)' }}>
                  {selectedPatient.uhid} · {selectedPatient.department || selectedPatient.dept || 'Admitted'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                style={{
                  marginLeft: 'auto', padding: '3px 10px', fontSize: '11px', fontWeight: 600,
                  borderRadius: '5px', border: '1px solid oklch(0.75 0.09 185)', background: '#fff',
                  color: 'oklch(0.4 0.1 185)', cursor: 'pointer'
                }}
              >
                Change
              </button>
            </div>
          )}
        </div>
      )}

      {/* The actual XrayOrders form — shown when a patient is selected (doctor) or always (radiologist) */}
      {(isRadiologist || selectedPatient) ? (
        <XrayOrders patient={selectedPatient} radiologist={isRadiologist} />
      ) : (
        !isRadiologist && (
          <div style={{
            background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px',
            padding: '40px 32px', textAlign: 'center', color: '#94a3b8'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🩻</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#475569', marginBottom: '4px' }}>
              No patient selected
            </div>
            <div style={{ fontSize: '12px' }}>
              Search for an admitted patient above to begin the X-ray request.
            </div>
          </div>
        )
      )}
    </div>
  );
}
