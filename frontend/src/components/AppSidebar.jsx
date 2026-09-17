import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { ROLE_PAGE_ACCESS } from '../services/meridianData';

export const NAV_GROUPS = [
  {
    title: 'FRONT OFFICE & PATIENTS',
    items: [
      { id: 'command', label: 'Command Centre' },
      { id: 'patients', label: 'Patients' },
      { id: 'appointments', label: 'Appointments', badge: 'Live DB' },
      { id: 'pre-admission', label: 'Pre-Admission Desk', badge: 'Live' },
      { id: 'doctor-management', label: 'Doctor Directory' },
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
      { id: 'doctor-portal', label: 'Doctor Clinical Desk', badge: 'Portal' },
      { id: 'nursing', label: 'Nursing Workspace' },
      { id: 'medications', label: 'Medication Administration' },
      { id: 'surgery', label: 'OT & Surgery' },
      { id: 'bloodbank', label: 'Blood Bank' },
      { id: 'discharge', label: 'Discharge', badge: '4', badgeColor: 'oklch(0.5 0.18 25)' },
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
    title: 'PHARMACY & SUPPLY CHAIN',
    items: [
      { id: 'prescriptions', label: 'Prescriptions' },
      { id: 'drugs', label: 'Drug Master' },
      { id: 'pharmacy', label: 'Pharmacy' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'stores', label: 'Stores' },
      { id: 'procurement', label: 'Procurement' },
      { id: 'vendors', label: 'Vendors' },
      { id: 'cssd', label: 'CSSD' },
    ]
  },
  {
    title: 'FINANCIAL & REVENUE',
    items: [
      { id: 'billing', label: 'Billing & Clearance' },
      { id: 'insurance', label: 'Insurance & Claims' },
      { id: 'claims', label: 'Claims Tracking' },
      { id: 'finance', label: 'Finance Dashboard' },
      { id: 'tax', label: 'Tax Configuration' },
    ]
  },
  {
    title: 'PEOPLE',
    items: [
      { id: 'hr-dashboard', label: 'HR & Employee Service' },
      { id: 'employees', label: 'Employees' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'credentials', label: 'Staff Credentials' },
      { id: 'staff', label: 'Staff Roster' },
      { id: 'canteen', label: 'Canteen' },
    ]
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { id: 'integration-arch', label: 'Integration Architecture' },
      { id: 'escalations', label: 'Human Escalations', badge: 'Live' },
      { id: 'notifications', label: 'Notifications', badge: '26', badgeColor: 'oklch(0.45 0.17 25)' },
      { id: 'config', label: 'Configuration' },
      { id: 'reports', label: 'Reports' },
      { id: 'users', label: 'Users' },
      { id: 'roles', label: 'Roles' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'identity', label: 'Identity' },
      { id: 'departments', label: 'Departments' },
      { id: 'services', label: 'Services' },
      { id: 'insurers', label: 'Insurers' },
      { id: 'payment-methods', label: 'Payment Methods' },
      { id: 'facilities', label: 'Facilities & Housekeeping' },
      { id: 'integrations', label: 'Integrations' },
    ]
  },
  {
    title: 'AI PLATFORM',
    items: [
      { id: 'assistant', label: 'Hospital Assistant' },
      { id: 'ai-desk', label: 'AI Patient Desk', badge: 'Live AI', badgeColor: 'oklch(0.5 0.18 150)' },
      { id: 'patient-chat', label: 'Patient Portal Chat', badge: 'Interactive' },
      { id: 'ai-command', label: 'AI Command Centre' },
      { id: 'agents', label: 'Agents' },
      { id: 'orchestrator', label: 'Orchestrator' },
      { id: 'runs', label: 'Agent Runs' },
      { id: 'approvals', label: 'Approval Centre', badge: '8', badgeColor: 'oklch(0.45 0.17 25)' },
      { id: 'exceptions', label: 'Exceptions', badge: '32', badgeColor: 'oklch(0.45 0.17 25)' },
      { id: 'knowledge', label: 'Knowledge Base' },
      { id: 'ai-analytics', label: 'Assistant Analytics' },
      { id: 'evals', label: 'AI Evaluations' },
      { id: 'observability', label: 'AI Observability' },
      { id: 'cost', label: 'AI Cost & Usage' },
      { id: 'incidents', label: 'AI Incidents', badge: '6', badgeColor: 'oklch(0.45 0.17 25)' },
      { id: 'risk', label: 'AI Risk Register' },
      { id: 'governance', label: 'Governance' },
      { id: 'audit', label: 'Audit Trail' },
      { id: 'trainer', label: 'AI Trainer' },
    ]
  },
  {
    title: 'DATA',
    items: [
      { id: 'data-patient', label: 'Patient Data' },
      { id: 'data-ops', label: 'Operational Data' },
      { id: 'data-clinical', label: 'Clinical Data' },
      { id: 'data-financial', label: 'Financial Data' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'forecasting', label: 'Forecasting' },
      { id: 'scenario', label: 'Scenario Simulator' },
      { id: 'beforeafter', label: 'Before vs After' },
      { id: 'data-quality', label: 'Data Quality' },
      { id: 'tables', label: 'Schema Explorer' },
      { id: 'explorer', label: 'Data Grid Viewer' },
      { id: 'sql', label: 'SQL Sandbox' },
      { id: 'settings', label: 'System Settings' },
    ]
  }
];

export default function AppSidebar({ activePage, setActivePage, userRole = 'Doctor' }) {
  const [dischargeCount, setDischargeCount] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDischargeCount() {
      try {
        const res = await apiService.getDischargedPatients({}, { forceRefresh: true });
        if (!isMounted) return;
        const total = res?.data?.length;
        if (total !== undefined) {
          setDischargeCount(total);
        }
      } catch (err) {
        // Silently keep current badge on failure
      }
    }

    fetchDischargeCount();

    const timer = setInterval(fetchDischargeCount, 6000);
    const handleUpdate = () => fetchDischargeCount();
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  const allowedPages = ROLE_PAGE_ACCESS[userRole];

  const visibleGroups = NAV_GROUPS.map(group => {
    const visibleItems = group.items.filter(item => {
      if (allowedPages === null || allowedPages === undefined) return true;
      return allowedPages.includes(item.id);
    });
    return { ...group, items: visibleItems };
  }).filter(group => group.items.length > 0);

  return (
    <nav style={{
      width: '195px', borderRight: '1px solid #e3e6e8', background: '#f9fafa',
      padding: '10px 8px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)',
      position: 'sticky', top: '80px', alignSelf: 'start', flexShrink: 0
    }}>
      {visibleGroups.map((group) => (
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
            const badgeText = item.id === 'discharge' 
              ? (dischargeCount !== null ? String(dischargeCount) : item.badge)
              : item.badge;

            return (
              <div
                key={item.id}
                onClick={() => setActivePage(item.id)}
                style={{
                  margin: '1px 4px 1px 6px', padding: '5px 10px', borderRadius: '6px',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis', fontSize: '12px',
                  background: isActive ? 'oklch(0.95 0.04 185)' : 'transparent',
                  color: isActive ? 'oklch(0.35 0.1 185)' : '#15181b',
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? '1px solid oklch(0.82 0.08 185)' : '1px solid transparent',
                  transition: 'background 0.12s'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                {badgeText && (
                  <span style={{
                    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px',
                    fontWeight: 700, color: item.badgeColor || 'oklch(0.5 0.1 200)',
                    padding: '0 4px', borderRadius: '4px',
                    background: item.badgeColor ? 'oklch(0.96 0.03 25)' : 'oklch(0.95 0.03 200)'
                  }}>
                    {badgeText}
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
