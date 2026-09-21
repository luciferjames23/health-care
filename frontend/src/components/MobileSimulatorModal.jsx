import React, { useState, useEffect } from 'react';
import { IOSDevice, IOSList, IOSListRow } from './IOSFrame';
import { apiService } from '../services/api';

export default function MobileSimulatorModal({ onClose, onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchLivePatients = async () => {
      setLoading(true);
      try {
        const res = await apiService.getClinicalPatients({ limit: 15 });
        const list = res?.patients || res?.data || [];
        if (mounted && list.length > 0) {
          const mapped = list.slice(0, 10).map(p => ({
            ...p,
            patient_id: p.patient_id,
            id: String(p.patient_id),
            name: p.patient_name || p.patient_number,
            bed: p.bed_number || 'OP',
            ward: p.ward_name || 'Inpatient Care',
            diagnosis: p.primary_diagnosis,
            status: p.discharge_status || 'Inpatient Care',
            alert: Number(p.temperature) > 100.4 || Number(p.oxygen_saturation) < 95
          }));
          setPatients(mapped);
        }
      } catch (e) {
        console.warn('Failed to fetch mobile clinical patients:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchLivePatients();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ position: 'relative' }}>
        {/* Close button floating top right */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: '-14px', right: '-14px', zIndex: 70,
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#15181b', border: '2px solid #fff', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          ✕
        </button>

        {/* Liquid Glass iPhone frame */}
        <IOSDevice title="Ward Rounds" width={380} height={780} onBack={onClose}>
          <div style={{ padding: '8px 0 30px' }}>
            <IOSList header={`Active Inpatients (${patients.length})`}>
              {patients.map((p, i) => (
                <IOSListRow
                  key={p.patient_id || p.name || i}
                  title={p.name}
                  detail={`${p.bed} · ${p.diagnosis || p.ward}`}
                  isLast={i === patients.length - 1}
                  icon={p.alert ? 'oklch(0.5 0.18 25)' : 'oklch(0.5 0.1 200)'}
                  onClick={() => {
                    if (onSelectPatient) onSelectPatient(p);
                    onClose();
                  }}
                />
              ))}
            </IOSList>

            <IOSList header="Ward Operations">
              <IOSListRow title="Review Discharge Summaries" detail="Active cases" />
              <IOSListRow title="Bed Demand" detail="Occupancy tracking" />
              <IOSListRow title="Voice Clinical Notes" detail="AI SOAP Drafts" isLast={true} />
            </IOSList>


            <div style={{
              margin: '16px 20px', padding: '12px', borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)',
              fontSize: '12px', color: '#52585e', lineHeight: 1.45,
              border: '0.5px solid rgba(0,0,0,0.08)'
            }}>
              <strong style={{ color: '#15181b' }}>Mobile Doctor Scope:</strong> Bedside quick-sign, voice dictation, and vital verification optimized for iOS device interaction.
            </div>
          </div>
        </IOSDevice>
      </div>
    </div>
  );
}
