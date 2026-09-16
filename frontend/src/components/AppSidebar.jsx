import React from 'react';

export const NAV_GROUPS = [
  {
    title: 'FRONT OFFICE & PATIENTS',
    items: [
      { id: 'command', label: 'Command Centre' },
      { id: 'patients', label: 'Patients' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'admissions', label: 'Admissions' },
      { id: 'bedboard', label: 'Bed Board' },
      { id: 'emergency', label: 'Emergency' },
      { id: 'schedules', label: 'Consultant Schedules' },
    ]
  },
  {
    title: 'CLINICAL',
    items: [
      { id: 'clinical', label: 'Clinical Workspace' },
      { id: 'nursing', label: 'Nursing Workspace' },
      { id: 'medications', label: 'Medication Administration' },
      { id: 'surgery', label: 'OT & Surgery' },
      { id: 'bloodbank', label: 'Blood Bank' },
      { id: 'discharge', label: 'Discharge', badge: '8', badgeColor: 'oklch(0.5 0.18 25)' },
      { id: 'deathmlc', label: 'Death & MLC Register' },
      { id: 'otschedule', label: 'OT Schedule' },
      { id: 'sbar', label: 'Ward Handover (SBAR)' },
    ]
  },
  {
    title: 'DIAGNOSTICS · LIS & IMAGING',
    items: [
      { id: 'lab', label: 'Lab Dashboard' },
      { id: 'criticalvalues', label: 'Results & Critical Values' },
      { id: 'diagnostics', label: 'Diagnostics' },
      { id: 'radiology', label: 'Radiology', badge: 'Live PoC' },
    ]
  },
  {
    title: 'FINANCIAL & REVENUE',
    items: [
      { id: 'billing', label: 'Billing & Clearance' },
      { id: 'insurance', label: 'Insurance & Claims' },
      { id: 'revenue', label: 'Revenue Predictions', badge: 'Gold' },
      { id: 'beds', label: '7-Day Bed Forecast', badge: 'Databricks' },
    ]
  },
  {
    title: 'AI & AGENTS',
    items: [
      { id: 'assistant', label: 'Hospital Assistant', badge: 'AI' },
      { id: 'analytics', label: 'AI Analytics & Evals' },
      { id: 'exceptions', label: 'Operational Exceptions', badge: '32', badgeColor: 'oklch(0.5 0.18 25)' },
      { id: 'knowledge', label: 'Governed Knowledge Base' },
      { id: 'audit', label: 'Audit Trail & Compliance' },
    ]
  },
  {
    title: 'PLATFORM & DATA',
    items: [
      { id: 'tables', label: 'Schema Explorer' },
      { id: 'explorer', label: 'Data Grid Viewer' },
      { id: 'sql', label: 'SQL Sandbox' },
      { id: 'settings', label: 'Databricks Settings' },
    ]
  }
];

export default function AppSidebar({ activePage, setActivePage }) {
  return (
    <nav style={{
      width: '235px', borderRight: '1px solid #e3e6e8', background: '#f9fafa',
      padding: '10px 8px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 48px)',
      position: 'sticky', top: '48px', alignSelf: 'start', flexShrink: 0
    }}>
      {NAV_GROUPS.map((group, gIdx) => (
        <div key={group.title} style={{ marginBottom: '14px' }}>
          <div style={{
            margin: '12px 4px 5px', padding: '5px 8px', borderRadius: '5px',
            background: '#eef0f1', fontSize: '10px', textTransform: 'uppercase',
            letterSpacing: '.07em', color: '#15181b', fontWeight: 700
          }}>
            {group.title}
          </div>

          {group.items.map((item) => {
            const isActive = activePage === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActivePage(item.id)}
                style={{
                  margin: '1px 4px 1px 6px', padding: '5px 10px', borderRadius: '6px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis', fontSize: '12px',
                  background: isActive ? 'oklch(0.95 0.03 200)' : 'transparent',
                  color: isActive ? 'oklch(0.4 0.1 200)' : '#15181b',
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? '2.5px solid oklch(0.5 0.1 200)' : '2.5px solid transparent',
                  transition: 'background 0.12s'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px',
                    fontWeight: 700, color: item.badgeColor || 'oklch(0.5 0.1 200)',
                    padding: '0 4px', borderRadius: '4px',
                    background: item.badgeColor ? 'oklch(0.96 0.03 25)' : 'oklch(0.95 0.03 200)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
