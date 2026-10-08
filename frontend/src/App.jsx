import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
import { selectAccount } from './services/accountSession';
import { ROLE_PAGE_ACCESS, isPageAllowed } from './services/meridianData';
import AuthScreen from './components/AuthScreen';
import TopHeader from './components/TopHeader';
import AppSidebar from './components/AppSidebar';
import CommandCentreView from './components/CommandCentreView';
import ClinicalWorkspaceView from './components/ClinicalWorkspaceView';
import DischargeCommandCentre from './components/DischargeCommandCentre';
import SoapNoteView from './components/SoapNoteView';
import Patient360View from './components/Patient360View';
import PatientsView from './components/PatientsView';
import AdmissionsView from './components/AdmissionsView';
import HospitalAssistantView from './components/HospitalAssistantView';
import MobileSimulatorModal from './components/MobileSimulatorModal';
import ResultsCriticalValuesView from './components/ResultsCriticalValuesView';
import DiagnosticsView from './components/DiagnosticsView';
import RadiologyView from './components/RadiologyView';
import { FinancialRevenueView } from './components/FinancialRevenueView';
import DetailDrawer from './components/DetailDrawer';
import AlertsDrawer from './components/AlertsDrawer';
import MasterModal from './components/MasterModal';
import XrayOrdersView from './components/XrayOrdersView';
import PatientPortalView from './components/PatientPortalView';

// Databricks Gold Layer Views
import BedDemandView from './components/BedDemandView';
import SchemaExplorerView from './components/SchemaExplorerView';
import DataExplorerView from './components/DataExplorerView';
import SqlSandboxView from './components/SqlSandboxView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import LiveForecastingView from './components/LiveForecastingView';
import LiveScenarioSimulatorView from './components/LiveScenarioSimulatorView';
import LiveBeforeAfterView from './components/LiveBeforeAfterView';
import LiveDataQualityView from './components/LiveDataQualityView';

// Enterprise AI & Agents Views
import AgentStudioView from './components/AgentStudioView';
import ApprovalsView from './components/ApprovalsView';
import AiCommandCentreView from './components/AiCommandCentreView';
import OrchestratorView from './components/OrchestratorView';
import AgentRunsView from './components/AgentRunsView';
import GovernedKnowledgeView from './components/GovernedKnowledgeView';
import AiGovernanceView from './components/AiGovernanceView';
import DischargeAgentView from './components/DischargeAgentView';
import { DischargeAgentPipeline } from './agent';
import EmployeeServiceChatbot from './components/EmployeeServiceChatbot';
import ProtocolCopilot from './components/ProtocolCopilot';
import InsurancePreauthKanbanView from './components/InsurancePreauthKanbanView';

// Integrated Prototype Views (AI Patient Desk, Appointments, Pre-Admission, Doctor Desk, Patient Chat)
import AIPatientDesk from './pages/admin/AIPatientDesk';
import AppointmentManagement from './pages/admin/AppointmentManagement';
import PreAdmissionPage from './pages/admin/PreAdmissionPage';
import DoctorManagement from './pages/admin/DoctorManagement';
import DoctorsView from './components/DoctorsView';
import EscalationPage from './pages/admin/EscalationPage';
import FeedbackPage from './pages/admin/FeedbackPage';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import TodaysQueueView from './pages/doctor/TodaysQueueView';
import DoctorSchedules from './pages/admin/DoctorSchedules';
import PatientChat from './pages/PatientChat';
import PatientCreateAndManageView from './components/PatientCreateAndManageView';

import {
  AppointmentsView,
  EmergencyView,
  SchedulesView,
  NursingWorkspaceView,
  MedicationAdminView,
  SurgeryOTView,
  BloodBankView,
  LabDashboardView,
  BillingView,
  InsuranceView,
  ClaimsView,
  FinanceDashboardView,
  TaxConfigView,
  SbarView,
  DeathMlcView,
  AuditTrailView,
  DataDomainView,
  ExceptionsView,
  PrescriptionsView,
  DrugMasterView,
  PharmacyView,
  InventoryView,
  StoresView,
  ProcurementView,
  VendorsView,
  CssdView,
  HrEmployeeView,
  NotificationsView,
  ConfigurationView,
  ReportsView,
  AdminSystemView
} from './components/DummyDomainViews';

export default function App() {
  useEffect(() => {
    // Proactively pre-fetch and warm cache in background so all tabs load instantly without loading spinners
    apiService.preloadAllGoldData();
  }, []);
  // ── Session persistence: hydrate from sessionStorage on first load ──────────
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hx_auth') || 'null'); } catch { return null; }
  });
  const [role, setRoleState] = useState(() => {
    try { return sessionStorage.getItem('hx_role') || null; } catch { return null; }
  });
  const [activePage, setActivePage] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.includes('/create-full/details') || path.includes('/create-full-details') || path.includes('/create-full')) {
          return 'create-full-details';
        }
      }
      return sessionStorage.getItem('hx_page') || 'command';
    } catch { return 'command'; }
  });

  const [selectedPatient, setSelectedPatient] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hx_selected_patient') || 'null'); } catch { return null; }
  });

  // Keep sessionStorage in sync whenever auth / role / activePage / selectedPatient change
  useEffect(() => {
    try { sessionStorage.setItem('hx_auth', JSON.stringify(auth)); } catch { }
  }, [auth]);
  useEffect(() => {
    try { if (role) sessionStorage.setItem('hx_role', role); else sessionStorage.removeItem('hx_role'); } catch { }
  }, [role]);
  useEffect(() => {
    try { sessionStorage.setItem('hx_page', activePage); } catch { }
  }, [activePage]);

  // Sync URL changes for direct testing route http://localhost:5173/create-full/details
  useEffect(() => {
    const handleUrlSync = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.includes('/create-full/details') || path.includes('/create-full-details') || path.includes('/create-full')) {
          setActivePage('create-full-details');
        }
      }
    };
    window.addEventListener('popstate', handleUrlSync);
    window.addEventListener('hashchange', handleUrlSync);
    return () => {
      window.removeEventListener('popstate', handleUrlSync);
      window.removeEventListener('hashchange', handleUrlSync);
    };
  }, []);
  useEffect(() => {
    try {
      if (selectedPatient) {
        sessionStorage.setItem('hx_selected_patient', JSON.stringify(selectedPatient));
      } else {
        sessionStorage.removeItem('hx_selected_patient');
      }
    } catch { }
  }, [selectedPatient]);
  // ─────────────────────────────────────────────────────────────────────────────
  const [showMobile, setShowMobile] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [requestedRadiologyStudy, setRequestedRadiologyStudy] = useState(null);
  const isRadiologist = Boolean(
    auth?.canAccessRadiology ||
    (role && String(role).trim().toLowerCase() === 'radiologist') ||
    (auth?.role && String(auth.role).trim().toLowerCase() === 'radiologist')
  );
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);
  const [soapReturnPage, setSoapReturnPage] = useState('patient360');
  const [dischargeCount, setDischargeCount] = useState(null);
  useEffect(() => {
    // Reset dischargeCount when doctor scope or user role switches
    setDischargeCount(null);
  }, [auth?.name, role]);

  useEffect(() => {
    let isMounted = true;
    async function loadAlerts() {
      try {
        // Pass role and user identity for scoped notification count
        const countData = await apiService.getNotificationCounts({
          role: role || null,
          username: auth?.username || null,
          user_name: auth?.name || null
        }).catch(() => null);
        if (countData && typeof countData.unread_count === 'number') {
          if (isMounted) setAlertsCount(countData.unread_count);
        } else {
          const res = await apiService.getNotifications({
            limit: 100,
            role: role || undefined,
            username: auth?.username || undefined,
            user_name: auth?.name || undefined
          }, { revalidateMs: 15000 });
          if (!isMounted) return;
          const unread = (res?.data || []).filter(n => n.status === 'UNREAD' || n.unread === true || (n.state || '').toUpperCase() === 'UNREAD');
          setAlertsCount(unread.length || 0);
        }
      } catch (e) {
        if (isMounted) setAlertsCount(0);
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 15000);
    const handleUpdate = () => loadAlerts();
    window.addEventListener('hc_api_updated', handleUpdate);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, [role, auth?.username, auth?.name]);

  const setRole = (newRole) => {
    setRoleState(newRole);
    if (newRole === 'Patient' || String(newRole).toLowerCase() === 'patient') {
      setActivePage('portal');
    }
  };

  const [authScreenUsername, setAuthScreenUsername] = useState(null);
  const [authScreenInfo, setAuthScreenInfo] = useState('');

  const handleSignOut = () => {
    sessionStorage.removeItem('hc_auth_token');
    setAuth(null);
    setRoleState(null);
    setSelectedPatient(null);
    setNavHistory([]);
    setAuthScreenUsername(null);
    setAuthScreenInfo('');
    // Clear persisted session so the next visit shows login
    try {
      sessionStorage.removeItem('hx_auth');
      sessionStorage.removeItem('hx_role');
      sessionStorage.removeItem('hx_page');
      sessionStorage.removeItem('hx_selected_patient');
      sessionStorage.removeItem('hx_nav_history');
    } catch { }
  };

  const handleSwitchUserPromptPassword = (targetUser) => {
    sessionStorage.removeItem('hc_auth_token');
    try {
      sessionStorage.removeItem('hx_auth');
      sessionStorage.removeItem('hx_role');
      sessionStorage.removeItem('hx_page');
      sessionStorage.removeItem('hx_selected_patient');
      sessionStorage.removeItem('hx_nav_history');
    } catch { }
    setAuth(null);
    setRoleState(null);
    setSelectedPatient(null);
    setNavHistory([]);
    setDrawer(null);
    setModal(null);
    setAuthScreenUsername(targetUser?.username || null);
    setAuthScreenInfo(targetUser?.name ? `Signed out. Please sign in as ${targetUser.name}.` : 'Signed out. Please sign in to continue.');
  };

  const [navHistory, setNavHistory] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hx_nav_history') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    try {
      if (navHistory && navHistory.length > 0) {
        sessionStorage.setItem('hx_nav_history', JSON.stringify(navHistory));
      } else {
        sessionStorage.removeItem('hx_nav_history');
      }
    } catch { }
  }, [navHistory]);

  const handleNavigate = (newPage, newPatient = undefined) => {
    if (role && !isPageAllowed(role, newPage)) {
      console.warn(`[RBAC] Access denied to page '${newPage}' for role '${role}'.`);
      return;
    }
    if (newPage === activePage && (newPatient === undefined || newPatient === selectedPatient)) {
      return;
    }
    setNavHistory(prev => {
      // Don't push duplicate identical states
      if (prev.length > 0 && prev[prev.length - 1].page === activePage) {
        return prev;
      }
      return [...prev, { page: activePage, patient: selectedPatient }];
    });
    setActivePage(newPage);
    if (newPatient !== undefined) {
      setSelectedPatient(newPatient);
    } else if (newPage !== 'patient360' && newPage !== 'soap') {
      setSelectedPatient(null);
    }
  };

  const handleStepBack = () => {
    if (selectedPatient && activePage === 'discharge') {
      setSelectedPatient(null);
      return;
    }
    if (navHistory.length > 0) {
      const prevEntry = navHistory[navHistory.length - 1];
      setNavHistory(prev => prev.slice(0, -1));
      setActivePage(prevEntry.page);
      setSelectedPatient(prevEntry.patient);
    } else {
      setActivePage(role === 'Doctor' ? 'clinical' : 'command');
      setSelectedPatient(null);
    }
  };

  const handleAskAi = (query) => {
    setAiPrompt(query);
    handleNavigate('assistant');
  };

  const handleSelectPatient = (patient) => {
    handleNavigate('patient360', patient);
  };

  const handleOpenSoap = (patient) => {
    setSoapReturnPage(activePage === 'soap' ? soapReturnPage : activePage);
    handleNavigate('soap', patient);
  };

  const handleOpenDischargeSummary = (patientOrSummary) => {
    handleNavigate('discharge', patientOrSummary);
  };

  // If not authenticated, display login screen
  if (!auth) {
    return (
      <AuthScreen
        initialUsername={authScreenUsername}
        initialInfo={authScreenInfo}
        onLoginSuccess={(userObj) => {
          setAuth(userObj);
          setRole(userObj.role);
          if (userObj.role === 'Patient' || String(userObj.role).toLowerCase() === 'patient') {
            setActivePage('portal');
          } else {
            setActivePage('command');
          }
          setAuthScreenUsername(null);
          setAuthScreenInfo('');
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fbfbfc', color: '#15181b' }}>
      {/* Omni Top Header */}
      <TopHeader
        role={role}
        setRole={setRole}
        user={auth}
        setUser={setAuth}
        alertsCount={alertsCount}
        onSignOut={handleSignOut}
        onOpenMobile={() => setShowMobile(true)}
        onOpenAlerts={() => setShowAlertsDrawer(true)}
        onAskAi={handleAskAi}
        onOpenModal={setModal}
        onSwitchUserPromptPassword={handleSwitchUserPromptPassword}
      />

      {/* Main App Layout: Sidebar + Workspace View */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {role !== 'Patient' && activePage !== 'portal' && activePage !== 'patient-portal' && activePage !== 'create-full-details' && activePage !== 'create-full' && activePage !== '/create-full/details' && (
          <AppSidebar
            activePage={activePage}
            setActivePage={(page) => handleNavigate(page)}
            userRole={role}
            doctorName={role === 'Doctor' ? auth?.name : null}
            dischargeCount={dischargeCount}
          />
        )}

        <main style={{ flex: 1, minWidth: 0, padding: (activePage === 'create-full-details' || activePage === 'create-full' || activePage === '/create-full/details') ? '0' : '16px 24px 48px', overflowY: 'auto' }}>
          {/* Unified Module Step-Back Navigation Header for all non-root modules (hidden in patient portal & create full page) */}
          {activePage !== 'command' && role !== 'Patient' && activePage !== 'portal' && activePage !== 'patient-portal' && activePage !== 'create-full-details' && activePage !== 'create-full' && activePage !== '/create-full/details' && (
            <div
              id="module-stepback-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid #eef0f2'
              }}
            >
              <button
                type="button"
                id="btn-step-back"
                onClick={handleStepBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0284c7',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f0f9ff';
                  e.currentTarget.style.borderColor = '#7dd3fc';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                title="Step back to previous screen"
              >
                <span>←</span>
                <span>Back</span>
              </button>
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>·</span>
              <span style={{ color: '#334155', fontSize: '12.5px', fontWeight: 600, textTransform: 'capitalize' }}>
                {activePage === 'patient360' ? 'Patient 360' : activePage === 'soap' ? 'SOAP Clinical Note' : activePage.replace(/-/g, ' ')}
              </span>
              {['patient360', 'soap'].includes(activePage) && selectedPatient && (selectedPatient.name || selectedPatient.patient_name || selectedPatient.patient) && (
                <>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>›</span>
                  <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>
                    {selectedPatient.name || selectedPatient.patient_name || selectedPatient.patient}
                  </span>
                </>
              )}
            </div>
          )}

          {['radiology', 'diagnostics'].includes(activePage) && !isRadiologist ? (
            <section
              role="alert"
              style={{
                maxWidth: '620px',
                margin: '40px auto',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '36px 28px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'oklch(0.96 0.03 25)',
                  color: 'oklch(0.45 0.17 25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px'
                }}
              >
                🔒
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#15181b', margin: 0 }}>
                No access
              </h2>
              <p style={{ fontSize: '13px', color: '#52585e', lineHeight: 1.55, margin: 0, maxWidth: '480px' }}>
                This {activePage === 'diagnostics' ? 'diagnostics' : 'radiology'} workspace and diagnostic radiology data are restricted. A verified <strong>Radiologist</strong> account is required to inspect radiographs, localization overlays, and PACS studies.
              </p>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '11.5px',
                  color: '#64748b',
                  marginTop: '2px'
                }}
              >
                Current account: <strong style={{ color: '#0f172a' }}>{auth?.name || 'Staff User'}</strong> · Role: <span style={{ color: '#0284c7', fontWeight: 600 }}>{role || 'Staff'}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleStepBack}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ← Return Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSwitchUserPromptPassword({ username: 'jancy.selvam', name: 'Jancy Selvam', role: 'Radiologist' });
                  }}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'oklch(0.5 0.1 200)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Sign in as Radiologist →
                </button>
              </div>
            </section>
          ) : (role === 'Patient' || activePage === 'portal' || activePage === 'patient-portal') ? (
            <PatientPortalView currentUser={auth} onSignOut={handleSignOut} />
          ) : <>
            {activePage === 'command' && (
              <CommandCentreView onNavigate={(p) => handleNavigate(p)} onAskAi={handleAskAi} />
            )}

            {activePage === 'clinical' && (
              <ClinicalWorkspaceView
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
                onSelectPatient={handleSelectPatient}
                onOpenSoap={handleOpenSoap}
              />
            )}

            {activePage === 'discharge' && (
              <DischargeCommandCentre
                selectedPatient={selectedPatient}
                onClearSelectedPatient={() => setSelectedPatient(null)}
                onSelectPatient={handleSelectPatient}
                onOpenSoap={handleOpenSoap}
                onNavigate={(p) => handleNavigate(p)}
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
                onUpdateCaseCount={setDischargeCount}
              />
            )}

            {activePage === 'soap' && (
              <SoapNoteView
                patient={selectedPatient}
                doctorName={auth?.name}
                onBack={handleStepBack}
                onOpenPatient={handleSelectPatient}
              />
            )}

            {activePage === 'patient360' && (
              <Patient360View
                patient={selectedPatient}
                currentUser={auth}
                onOpenDischarge={() => {
                  handleNavigate('discharge', selectedPatient);
                }}
                onOpenSoap={handleOpenSoap}
                onBack={handleStepBack}
                onNavigate={(page) => {
                  if (page === 'discharge') {
                    handleNavigate('discharge', selectedPatient);
                  } else {
                    handleNavigate(page);
                  }
                }}
                onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); handleNavigate('radiology'); }}
                onOpenDrawer={setDrawer}
                onOpenModal={setModal}
              />
            )}

            {(activePage === 'create-full-details' || activePage === 'create-full' || activePage === '/create-full/details') && (
              <PatientCreateAndManageView
                currentUser={auth}
                onNavigate={(p) => handleNavigate(p)}
              />
            )}

            {activePage === 'patients' && (
              <PatientsView
                onSelectPatient={handleSelectPatient}
                onOpenSoap={handleOpenSoap}
                onNavigate={(p) => handleNavigate(p)}
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
                currentUser={auth}
              />
            )}

            {activePage === 'admissions' && (
              <AdmissionsView
                onSelectPatient={handleSelectPatient}
                onOpenSoap={handleOpenSoap}
                onNavigate={(p) => handleNavigate(p)}
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
              />
            )}

            {activePage === 'bedboard' && <BedDemandView onSelectPatient={handleSelectPatient} />}

            {activePage === 'assistant' && (
              <HospitalAssistantView onNavigate={(p) => handleNavigate(p)} defaultQuery={aiPrompt} />
            )}

            {activePage === 'beds' && <BedDemandView onSelectPatient={handleSelectPatient} />}
            {activePage === 'tables' && <SchemaExplorerView onViewData={() => setActivePage('explorer')} />}
            {activePage === 'explorer' && <DataExplorerView />}
            {activePage === 'sql' && <SqlSandboxView />}
            {activePage === 'analytics' && <AnalyticsView />}
            {activePage === 'settings' && <SettingsView />}

            {/* AI & Agents Platform Views */}
            {activePage === 'ai-command' && <AiCommandCentreView onNavigate={setActivePage} />}
            {activePage === 'agents' && (
              <AgentStudioView
                onNavigate={setActivePage}
                onOpenModal={setModal}
                onSelectPatient={handleSelectPatient}
                onOpenDischargeSummary={handleOpenDischargeSummary}
              />
            )}
            {activePage === 'discharge-agent' && (
              <DischargeAgentPipeline
                onNavigate={setActivePage}
                onSelectPatient={handleSelectPatient}
                onOpenDischargeSummary={handleOpenDischargeSummary}
                doctorName={auth?.name}
              />
            )}
            {activePage === 'approvals' && <ApprovalsView onNavigate={setActivePage} userRole={role} onOpenModal={setModal} />}
            {activePage === 'preauth-desk' && (
              <InsurancePreauthKanbanView
                onOpenPatient={handleSelectPatient}
                onNavigate={handleNavigate}
              />
            )}
            {activePage === 'orchestrator' && <OrchestratorView onNavigate={setActivePage} />}
            {activePage === 'runs' && <AgentRunsView onNavigate={setActivePage} />}
            {activePage === 'knowledge' && <GovernedKnowledgeView onOpenModal={setModal} />}
            {activePage === 'ai-analytics' && <AnalyticsView />}
            {activePage === 'trainer' && <ProtocolCopilot currentUser={auth} userRole={role} />}
            {[
              'governance', 'risk', 'evals', 'observability', 'cost', 'incidents'
            ].includes(activePage) && (
                <AiGovernanceView initialTab={activePage} />
              )}

            {activePage === 'criticalvalues' && (
              <ResultsCriticalValuesView
                currentUser={auth}
                userRole={role}
                doctorName={role === 'Doctor' ? auth?.name : null}
                doctorId={auth?.doctorId}
                onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); setActivePage('radiology'); }}
                onSelectPatient={handleSelectPatient}
              />
            )}
            {activePage === 'diagnostics' && (
              <DiagnosticsView
                onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); setActivePage('radiology'); }}
                onSelectPatient={handleSelectPatient}
              />
            )}
            {activePage === 'radiology' && (
              <RadiologyView
                requestedStudyId={requestedRadiologyStudy}
                onRequestedStudyHandled={() => setRequestedRadiologyStudy(null)}
                currentUser={auth}
                onSelectPatient={handleSelectPatient}
              />
            )}
            {activePage === 'xray-orders' && (
              <XrayOrdersView
                userRole={role}
                doctorName={role === 'Doctor' ? auth?.name : null}
                onSelectPatient={handleSelectPatient}
              />
            )}

            {/* Operational, Clinical, Diagnostic & Revenue Domain Views */}
            {activePage === 'appointments' && (
              <AppointmentManagement
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
                onSelectPatient={handleSelectPatient}
                onNavigate={(p, pat) => handleNavigate(p, pat)}
              />
            )}
            {activePage === 'ai-desk' && <AIPatientDesk />}
            {activePage === 'pre-admission' && <PreAdmissionPage />}
            {activePage === 'doctor-management' && (
              <DoctorsView
                onNavigate={(p, pat) => handleNavigate(p, pat)}
                userRole={role}
              />
            )}
            {activePage === 'feedback' && (
              ['Hospital Management', 'Admin', 'System Admin', 'Quality'].includes(role) ? (
                <FeedbackPage />
              ) : (
                <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600, color: '#d93025' }}>Access Restricted</h3>
                  <p style={{ margin: '0 0 20px 0', color: '#5f6368', fontSize: '14px', lineHeight: 1.5 }}>
                    The Feedback & Grievance Centre is restricted to Administrative and Quality Management roles.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePage('doctor-portal')}
                    style={{ padding: '8px 16px', borderRadius: '6px', background: '#1a73e8', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Return to Doctor Clinical Desk
                  </button>
                </div>
              )
            )}
            {activePage === 'doctor-portal' && (
              <DoctorDashboard
                onNavigate={(p, pat) => handleNavigate(p, pat)}
                onSelectPatient={handleSelectPatient}
              />
            )}
            {activePage === 'todays-queue' && (
              <TodaysQueueView
                onNavigate={(p, pat) => handleNavigate(p, pat)}
                onSelectPatient={handleSelectPatient}
              />
            )}
            {activePage === 'patient-chat' && <PatientChat />}
            {activePage === 'emergency' && (
              <EmergencyView
                onOpenDrawer={setDrawer}
                onOpenModal={setModal}
                doctorName={role === 'Doctor' ? auth?.name : null}
                userRole={role}
              />
            )}
            {activePage === 'schedules' && <DoctorSchedules />}
            {activePage === 'nursing' && <NursingWorkspaceView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'medications' && <MedicationAdminView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'surgery' && <SurgeryOTView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'bloodbank' && <BloodBankView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'deathmlc' && <DeathMlcView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'sbar' && <SbarView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'lab' && <LabDashboardView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {['billing', 'insurance', 'claims', 'finance', 'tax'].includes(activePage) && (
              <FinancialRevenueView
                initialTab={activePage}
                onOpenDrawer={setDrawer}
                onOpenModal={setModal}
                onSelectPatient={handleSelectPatient}
                userRole={role}
              />
            )}
            {activePage === 'exceptions' && <ExceptionsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'audit' && <AuditTrailView onOpenDrawer={setDrawer} onOpenModal={setModal} />}

            {/* Pharmacy & Supply Chain Domain Views (Live PostgreSQL DB) */}
            {activePage === 'prescriptions' && <PrescriptionsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'drugs' && <DrugMasterView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'pharmacy' && <PharmacyView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'inventory' && <InventoryView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'stores' && <StoresView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'procurement' && <ProcurementView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'vendors' && <VendorsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'cssd' && <CssdView onOpenDrawer={setDrawer} onOpenModal={setModal} />}

            {/* People Domain Views */}
            {(activePage === 'hr-dashboard' || activePage === 'hr') && <HrEmployeeView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {['employees', 'attendance', 'credentials', 'staff', 'canteen'].includes(activePage) && (
              <AdminSystemView module={activePage === 'employees' ? 'Employee Master Directory' : activePage === 'attendance' ? 'Biometric Attendance & Overtime' : activePage === 'credentials' ? 'Staff Credentialing & Medical Licensing' : activePage === 'canteen' ? 'Staff Dining & Canteen Operations' : 'Predictive Nurse & Staff Roster'} onOpenDrawer={setDrawer} onOpenModal={setModal} />
            )}

            {/* Administration Domain Views */}
            {activePage === 'notifications' && <NotificationsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'config' && <ConfigurationView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'reports' && <ReportsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {['integration-arch', 'users', 'roles', 'permissions', 'identity', 'departments', 'services', 'insurers', 'payment-methods', 'facilities', 'integrations'].includes(activePage) && (
              <AdminSystemView module={
                activePage === 'integration-arch' ? 'Integration Architecture' :
                  activePage === 'users' ? 'Users' :
                    activePage === 'roles' ? 'Roles' :
                      activePage === 'permissions' ? 'Permissions' :
                        activePage === 'identity' ? 'Identity' :
                          activePage === 'departments' ? 'Departments' :
                            activePage === 'services' ? 'Services' :
                              activePage === 'insurers' ? 'Insurers' :
                                activePage === 'payment-methods' ? 'Payment Methods' :
                                  activePage === 'facilities' ? 'Facilities' :
                                    activePage === 'integrations' ? 'Integrations' : 'Integration Architecture'
              } onOpenDrawer={setDrawer} onOpenModal={setModal} />
            )}

            {/* Clinical Data Foundation Views */}
            {activePage === 'data-patient' && <DataDomainView domain="Patient Master Index" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'data-ops' && <DataDomainView domain="Operational Fact Records" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'data-clinical' && <DataDomainView domain="Clinical Observation Data" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'data-financial' && <DataDomainView domain="Financial Fact Ledger & AR/AP" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
            {activePage === 'data-quality' && <LiveDataQualityView />}
            {activePage === 'forecasting' && <LiveForecastingView />}
            {activePage === 'beforeafter' && <LiveBeforeAfterView />}

            {/* Standard Workspace Template for Other Domain Pages */}
            {![
              'command', 'patients', 'admissions', 'bedboard', 'clinical', 'discharge', 'soap', 'patient360',
              'assistant', 'beds', 'tables', 'explorer', 'sql', 'analytics', 'settings',
              'ai-command', 'agents', 'preauth-desk', 'discharge-agent', 'approvals', 'orchestrator', 'runs', 'knowledge',
              'governance', 'risk', 'evals', 'observability', 'cost', 'incidents', 'trainer',
              'criticalvalues', 'diagnostics', 'radiology', 'xray-orders',
              'ai-desk', 'patient-chat', 'pre-admission', 'doctor-management', 'doctor-portal', 'escalations',
              'appointments', 'emergency', 'schedules', 'nursing', 'medications', 'surgery',
              'bloodbank', 'deathmlc', 'sbar', 'lab', 'billing', 'insurance', 'claims', 'finance', 'tax',
              'exceptions', 'audit',
              'prescriptions', 'drugs', 'pharmacy', 'inventory', 'stores', 'procurement', 'vendors', 'cssd',
              'hr-dashboard', 'hr', 'employees', 'attendance', 'credentials', 'staff', 'canteen',
              'integration-arch', 'notifications', 'config', 'reports', 'users', 'roles', 'permissions', 'identity',
              'departments', 'services', 'insurers', 'payment-methods', 'facilities', 'integrations',
              'data-patient', 'data-ops', 'data-clinical', 'data-financial', 'data-quality',
              'forecasting', 'beforeafter', 'feedback', 'create-full-details', 'create-full', '/create-full/details'
            ].includes(activePage) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
                        <span>Hospital Operating Platform</span> › <span>{activePage.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 600, textTransform: 'capitalize' }}>
                        {activePage} Management
                      </div>
                      <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
                        Governed enterprise records · clinical data platform
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert(`Exported ${activePage} records`)}
                      style={{
                        height: '30px', padding: '0 12px', borderRadius: '6px',
                        border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                      }}
                    >
                      Export CSV
                    </button>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', marginBottom: '6px' }}>
                      {activePage.charAt(0).toUpperCase() + activePage.slice(1)} Workspace
                    </div>
                    <div style={{ color: '#52585e', fontSize: '12.5px', maxWidth: '520px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                      Active operational stream synchronized with the clinical data platform. Permitted actions and audit entries are tracked under {auth.name}.
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePage('command')}
                      style={{
                        height: '32px', padding: '0 14px', borderRadius: '6px', border: 0,
                        background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600,
                        cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      Return to Executive Dashboard
                    </button>
                  </div>
                </div>
              )}
          </>}
        </main>
      </div>

      {/* Slide-over Detail Drawer */}
      {drawer && (
        <DetailDrawer
          drawer={drawer}
          onClose={() => setDrawer(null)}
          onAction={(act) => {
            if (act.modal) {
              setModal(act.modal);
              setDrawer(null);
            }
          }}
        />
      )}

      {/* Slide-over Hospital Alerts Drawer */}
      <AlertsDrawer
        isOpen={showAlertsDrawer}
        onClose={() => setShowAlertsDrawer(false)}
        onNavigate={handleNavigate}
        onOpenPatient={handleSelectPatient}
        role={role}
        currentUser={auth}
      />

      {/* Master Modal System */}
      {modal && (
        <MasterModal
          modal={modal}
          onClose={() => setModal(null)}
          role={role}
        />
      )}

      {/* iOS Liquid Glass Mobile Simulator Modal */}
      {showMobile && (
        <MobileSimulatorModal
          onClose={() => setShowMobile(false)}
          onSelectPatient={handleSelectPatient}
        />
      )}

      {/* AG-04 Employee Service Agent Floating Chatbot */}
      <EmployeeServiceChatbot
        currentUser={auth}
        currentRole={role}
      />
    </div>
  );
}
