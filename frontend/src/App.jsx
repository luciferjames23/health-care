import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
import { selectAccount } from './services/accountSession';
import { ROLE_PAGE_ACCESS } from './services/meridianData';
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
import MasterModal from './components/MasterModal';
import XrayOrdersView from './components/XrayOrdersView';

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

// Integrated Prototype Views (AI Patient Desk, Appointments, Pre-Admission, Doctor Desk, Patient Chat)
import AIPatientDesk from './pages/admin/AIPatientDesk';
import AppointmentManagement from './pages/admin/AppointmentManagement';
import PreAdmissionPage from './pages/admin/PreAdmissionPage';
import DoctorManagement from './pages/admin/DoctorManagement';
import EscalationPage from './pages/admin/EscalationPage';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorSchedules from './pages/admin/DoctorSchedules';
import PatientChat from './pages/PatientChat';

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
    try { return sessionStorage.getItem('hx_page') || 'command'; } catch { return 'command'; }
  });

  const [selectedPatient, setSelectedPatient] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hx_selected_patient') || 'null'); } catch { return null; }
  });

  // Keep sessionStorage in sync whenever auth / role / activePage / selectedPatient change
  useEffect(() => {
    try { sessionStorage.setItem('hx_auth', JSON.stringify(auth)); } catch {}
  }, [auth]);
  useEffect(() => {
    try { if (role) sessionStorage.setItem('hx_role', role); else sessionStorage.removeItem('hx_role'); } catch {}
  }, [role]);
  useEffect(() => {
    try { sessionStorage.setItem('hx_page', activePage); } catch {}
  }, [activePage]);
  useEffect(() => {
    try {
      if (selectedPatient) {
        sessionStorage.setItem('hx_selected_patient', JSON.stringify(selectedPatient));
      } else {
        sessionStorage.removeItem('hx_selected_patient');
      }
    } catch {}
  }, [selectedPatient]);
  // ─────────────────────────────────────────────────────────────────────────────
  const [showMobile, setShowMobile] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [requestedRadiologyStudy, setRequestedRadiologyStudy] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);
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
        const res = await apiService.getDischargedPatients({}, { revalidateMs: 15000 });
        if (!isMounted) return;
        const pending = (res?.data || []).filter(r => {
          const s = (r.approval_status || '').toLowerCase();
          return !s.includes('approved') && !s.includes('signed');
        });
        setAlertsCount(pending.length);
      } catch (e) {
        if (isMounted) setAlertsCount(0);
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const setRole = (newRole) => {
    setRoleState(newRole);
    const allowed = ROLE_PAGE_ACCESS[newRole];
    if (allowed !== null && allowed !== undefined && !allowed.includes(activePage)) {
      setActivePage(allowed[0] || 'patients');
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
    } catch {}
  };

  const handleSwitchUserPromptPassword = (targetUser) => {
    sessionStorage.removeItem('hc_auth_token');
    try {
      sessionStorage.removeItem('hx_auth');
      sessionStorage.removeItem('hx_role');
      sessionStorage.removeItem('hx_page');
      sessionStorage.removeItem('hx_selected_patient');
      sessionStorage.removeItem('hx_nav_history');
    } catch {}
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
    } catch {}
  }, [navHistory]);

  const handleNavigate = (newPage, newPatient = undefined) => {
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
          setActivePage('command');
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
        onAskAi={handleAskAi}
        onOpenModal={setModal}
        onSwitchUserPromptPassword={handleSwitchUserPromptPassword}
      />

      {/* Main App Layout: Sidebar + Workspace View */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        <AppSidebar
          activePage={activePage}
          setActivePage={(page) => handleNavigate(page)}
          userRole={role}
          doctorName={role === 'Doctor' ? auth?.name : null}
          dischargeCount={dischargeCount}
        />

        <main style={{ flex: 1, minWidth: 0, padding: '16px 24px 48px', overflowY: 'auto' }}>
          {/* Unified Module Step-Back Navigation Header for all non-root modules */}
          {activePage !== 'command' && (
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

          {activePage === 'radiology' && !auth?.canAccessRadiology && role !== 'Doctor' && role !== 'Hospital Management' && role !== 'Admin' ? (
            <section role="alert"><h2>No access</h2><p>This workspace requires an active Radiologist account. Sign in with an authorized account.</p></section>
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
                setSelectedPatient(null);
                handleNavigate('discharge');
              }}
              onOpenSoap={handleOpenSoap}
              onBack={handleStepBack}
              onNavigate={(page) => {
                if (page === 'discharge') {
                  setSelectedPatient(null);
                }
                handleNavigate(page);
              }}
              onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); handleNavigate('radiology'); }}
              onOpenDrawer={setDrawer}
              onOpenModal={setModal}
            />
          )}

          {activePage === 'patients' && (
            <PatientsView
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={(p) => handleNavigate(p)}
              doctorName={role === 'Doctor' ? auth?.name : null}
              userRole={role}
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
          {activePage === 'orchestrator' && <OrchestratorView onNavigate={setActivePage} />}
          {activePage === 'runs' && <AgentRunsView onNavigate={setActivePage} />}
          {activePage === 'knowledge' && <GovernedKnowledgeView onOpenModal={setModal} />}
          {activePage === 'ai-analytics' && <AnalyticsView />}
          {[
            'governance', 'risk', 'evals', 'observability', 'cost', 'incidents', 'trainer'
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
            />
          )}
          {activePage === 'ai-desk' && <AIPatientDesk />}
          {activePage === 'pre-admission' && <PreAdmissionPage />}
          {activePage === 'doctor-management' && <DoctorManagement />}
          {activePage === 'escalations' && <EscalationPage />}
          {activePage === 'doctor-portal' && (
            <DoctorDashboard
              onNavigate={(p, pat) => handleNavigate(p, pat)}
              onSelectPatient={handleSelectPatient}
            />
          )}
          {activePage === 'patient-chat' && <PatientChat />}
          {activePage === 'emergency' && <EmergencyView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
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
          {activePage === 'scenario' && <LiveScenarioSimulatorView />}
          {activePage === 'beforeafter' && <LiveBeforeAfterView />}

          {/* Standard Workspace Template for Other Domain Pages */}
          {![
            'command', 'patients', 'admissions', 'bedboard', 'clinical', 'discharge', 'soap', 'patient360',
            'assistant', 'beds', 'tables', 'explorer', 'sql', 'analytics', 'settings',
            'ai-command', 'agents', 'discharge-agent', 'approvals', 'orchestrator', 'runs', 'knowledge',
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
            'forecasting', 'scenario', 'beforeafter'
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
        />
      )}

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
    </div>
  );
}
