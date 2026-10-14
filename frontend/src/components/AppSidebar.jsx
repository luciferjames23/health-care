import React, { useState, useEffect, useRef } from 'react';
import { apiService, computeDischargeCasesCount } from '../services/api';
import { isPageAllowed } from '../services/meridianData';
import { isNavigationItemActive } from '../services/navigation';

export const NAV_GROUPS = [
  {
    title: 'FRONT OFFICE & PATIENTS',
    items: [
      { id: 'command', label: 'Executive Dashboard' },
      { id: 'patients', label: 'Patients' },
      { id: 'feedback', label: 'Feedback & Grievances' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'pre-admission', label: 'Pre-Admission Desk' },
      { id: 'doctor-management', label: 'Doctor Directory' },
      { id: 'admissions', label: 'Admissions' },
      { id: 'bedboard', label: 'Bed Board' },
      { id: 'emergency', label: 'Emergency' },
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
      { id: 'discharge', label: 'Discharge Desk', badge: '4', badgeColor: 'oklch(0.5 0.18 25)' },
      { id: 'deathmlc', label: 'Death & MLC Register' },
      { id: 'sbar', label: 'Ward Handover (SBAR)' },
    ]
  },
  {
    title: 'DIAGNOSTICS · LIS & IMAGING',
    items: [
      { id: 'lab', label: 'Lab Dashboard' },
      { id: 'lab-workqueue', label: 'Lab Work Queue' },
      { id: 'criticalvalues', label: 'Results & Critical Values' },
      { id: 'diagnostics', label: 'Diagnostics' },
      { id: 'diagnostic-coordination', label: 'AG-10 Diagnostic Tracker' },
      { id: 'radiology', label: 'Radiology' },
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
    title: 'REVENUE CYCLE',
    items: [
      { id: 'billing', label: 'Billing' },
      { id: 'insurance', label: 'Insurance' },
      { id: 'claims', label: 'Claims' },
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
      { id: 'escalations', label: 'Human Escalations' },
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
      { id: 'ai-desk', label: 'AI Patient Desk' },
      { id: 'patient-chat', label: 'Patient Portal Chat', badge: 'Interactive' },
      { id: 'ai-command', label: 'AI Command Centre' },
      { id: 'followup-agent', label: 'Follow-up Agent', badge: 'Live', badgeColor: '#0d9488' },
      { id: 'preauth-desk', label: 'Insurance Preauth Desk', badge: 'Live', badgeColor: '#059669' },
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
      { id: 'analytics', label: 'Analytics' },
      { id: 'forecasting', label: 'Forecasting' },
      { id: 'beforeafter', label: 'Before vs After' },
      { id: 'data-quality', label: 'Data Quality' },
    ]
  }
];

export default function AppSidebar({
  activePage,
  setActivePage,
  userRole = 'Doctor',
  doctorName = null,
  dischargeCount: externalDischargeCount = null,
  mobileOpen = false,
  onCloseMobile = () => {}
}) {
  const effectiveRole = userRole || 'Doctor';
  const [dischargeCount, setDischargeCount] = useState(externalDischargeCount);
  const desktopNavRef = useRef(null);
  const desktopActiveItemRef = useRef(null);
  const mobileNavRef = useRef(null);
  const mobileActiveItemRef = useRef(null);

  // Synchronize when external dischargeCount is passed down
  useEffect(() => {
    if (externalDischargeCount !== null && externalDischargeCount !== undefined) {
      setDischargeCount(externalDischargeCount);
    }
  }, [externalDischargeCount]);

  useEffect(() => {
    const scrollActiveItemIntoView = (container, activeItem) => {
      if (!container || !activeItem) return;

      const containerRect = container.getBoundingClientRect();
      const activeItemRect = activeItem.getBoundingClientRect();
      let scrollDelta = 0;

      if (activeItemRect.top < containerRect.top) {
        scrollDelta = activeItemRect.top - containerRect.top;
      } else if (activeItemRect.bottom > containerRect.bottom) {
        scrollDelta = activeItemRect.bottom - containerRect.bottom;
      }

      if (scrollDelta !== 0) {
        container.scrollBy({ top: scrollDelta, behavior: 'smooth' });
      }
    };

    scrollActiveItemIntoView(desktopNavRef.current, desktopActiveItemRef.current);
    if (mobileOpen) {
      scrollActiveItemIntoView(mobileNavRef.current, mobileActiveItemRef.current);
    }
  }, [activePage, mobileOpen, effectiveRole]);

  // Listen to live discharge count updates emitted from DischargeCommandCentre
  useEffect(() => {
    const handleCountUpdate = (e) => {
      const count = e.detail?.count;
      if (count !== undefined && count !== null) {
        setDischargeCount(count);
      }
    };
    window.addEventListener('hc_discharge_count_updated', handleCountUpdate);
    return () => window.removeEventListener('hc_discharge_count_updated', handleCountUpdate);
  }, []);

  const [notifCount, setNotifCount] = React.useState(null);

  // Fetch live notifications unread count
  useEffect(() => {
    let isMounted = true;
    async function fetchNotifCount() {
      try {
        const res = await apiService.getNotificationCounts().catch(() => null);
        if (isMounted && res && res.unread_count !== undefined) {
          setNotifCount(res.unread_count);
        }
      } catch (e) {}
    }
    fetchNotifCount();
    const timer = setInterval(fetchNotifCount, 20000);
    const handleUpdate = () => fetchNotifCount();
    window.addEventListener('hc_api_updated', handleUpdate);
    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  // Fetch discharge count dynamically combining summaries and admissions matching doctor/role
  useEffect(() => {
    let isMounted = true;
    async function fetchDischargeCount() {
      try {
        const [resSummaries, resAdmissions] = await Promise.all([
          apiService.getDischargedPatients().catch(() => ({ data: [] })),
          apiService.getCurrentAdmissions({ discharge_status: 'all' }).catch(() => ({ data: [] }))
        ]);
        if (!isMounted) return;
        const targetDoctor = userRole === 'Doctor' ? doctorName : null;
        const total = computeDischargeCasesCount(
          resSummaries?.data || [],
          resAdmissions?.data || [],
          targetDoctor
        );
        if (total !== undefined && total !== null) {
          setDischargeCount(total);
        }
      } catch (err) {
        // Silently keep current badge on failure
      }
    }

    fetchDischargeCount();

    const handleDischargeCountUpdated = (e) => {
      if (e?.detail?.count !== undefined) {
        setDischargeCount(e.detail.count);
      } else {
        fetchDischargeCount();
      }
    };

    const handleUpdate = () => fetchDischargeCount();

    const timer = setInterval(fetchDischargeCount, 30000);
    window.addEventListener('hc_discharge_count_updated', handleDischargeCountUpdated);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_discharge_count_updated', handleDischargeCountUpdated);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, [doctorName, userRole]);

  // Sidepanel modules: Filter items and groups based on role permissions (Admins see all; specific roles see only their authorized modules)
  const visibleGroups = React.useMemo(() => {
    if (effectiveRole === 'Patient') return [];
    const isAdmin = effectiveRole === 'Hospital Management' || effectiveRole === 'Admin' || effectiveRole === 'System Admin' || effectiveRole === 'Quality';
    return NAV_GROUPS.map(group => {
      const filteredItems = group.items.filter(item => {
        if (item.id === 'doctor-management' && !isAdmin) {
          return false;
        }
        if (item.id === 'feedback' && !isAdmin) {
          return false;
        }
        if (item.id === 'todays-queue') {
          return false;
        }
        if (item.id === 'schedules' && (effectiveRole === 'Doctor' || String(effectiveRole).toLowerCase() === 'doctor')) {
          return false;
        }
        return isPageAllowed(effectiveRole, item.id);
      });
      return {
        ...group,
        items: filteredItems
      };
    }).filter(group => group.items.length > 0);
  }, [effectiveRole]);

  if (effectiveRole === 'Patient' || visibleGroups.length === 0) {
    return null;
  }

  const renderGroupList = (isMobile = false) => (
    <>
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
            const isActive = isNavigationItemActive(activePage, item.id);
            const badgeText = item.id === 'discharge' 
              ? (dischargeCount !== null ? String(dischargeCount) : item.badge)
              : item.id === 'notifications'
                ? (notifCount !== null ? String(notifCount) : item.badge)
                : item.badge;

            return (
              <div
                key={item.id}
                ref={isActive ? (isMobile ? mobileActiveItemRef : desktopActiveItemRef) : null}
                onClick={() => {
                  setActivePage(item.id);
                  if (isMobile && onCloseMobile) onCloseMobile();
                }}
                style={{
                  margin: '1px 4px 1px 6px', padding: '6px 10px', borderRadius: '6px',
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
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <nav
        ref={desktopNavRef}
        className="app-sidebar-desktop"
        style={{
          width: '200px', borderRight: '1px solid #e3e6e8', background: '#f9fafa',
          padding: '10px 8px 28px', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)',
          position: 'sticky', top: '80px', alignSelf: 'start', flexShrink: 0
        }}
      >
        {renderGroupList(false)}
      </nav>

      {/* Mobile / Tablet Responsive Drawer & Backdrop */}
      {mobileOpen && (
        <>
          <div
            onClick={onCloseMobile}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
              zIndex: 998, backdropFilter: 'blur(2px)'
            }}
          />
          <nav
            ref={mobileNavRef}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: '270px',
              maxWidth: '85vw', background: '#f9fafa', borderRight: '1px solid #e2e8f0',
              zIndex: 999, display: 'flex', flexDirection: 'column',
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)', overflowY: 'auto',
              padding: '16px 10px 32px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>Meridian Hospital</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{effectiveRole} Navigation</div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                style={{
                  border: 'none', background: '#e2e8f0', borderRadius: '6px',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#334155'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: '8px' }}>
              {renderGroupList(true)}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
