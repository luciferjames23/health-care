import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';
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

// Databricks Gold Layer Views
import BedDemandView from './components/BedDemandView';
import SchemaExplorerView from './components/SchemaExplorerView';
import DataExplorerView from './components/DataExplorerView';
import SqlSandboxView from './components/SqlSandboxView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';

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
  const [auth, setAuth] = useState(null);
  const [role, setRoleState] = useState(null);
  const [activePage, setActivePage] = useState('command');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [requestedRadiologyStudy, setRequestedRadiologyStudy] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);

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

  const handleSignOut = () => {
    setAuth(null);
    setRoleState(null);
  };

  const handleAskAi = (query) => {
    setAiPrompt(query);
    setActivePage('assistant');
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setActivePage('patient360');
  };

  const handleOpenSoap = (patient) => {
    setSelectedPatient(patient);
    setActivePage('soap');
  };

  const handleOpenDischargeSummary = (patientOrSummary) => {
    setSelectedPatient(patientOrSummary);
    setActivePage('discharge');
  };

  // If not authenticated, display login screen
  if (!auth) {
    return (
      <AuthScreen
        onLoginSuccess={(userObj) => {
          setAuth(userObj);
          setRole(userObj.role);
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
      />

      {/* Main App Layout: Sidebar + Workspace View */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        <AppSidebar activePage={activePage} setActivePage={setActivePage} userRole={role} />

        <main style={{ flex: 1, minWidth: 0, padding: '16px 24px 48px', overflowY: 'auto' }}>
          {activePage === 'command' && (
            <CommandCentreView onNavigate={setActivePage} onAskAi={handleAskAi} />
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
              onNavigate={setActivePage}
              doctorName={role === 'Doctor' ? auth?.name : null}
              userRole={role}
            />
          )}

          {activePage === 'soap' && (
            <SoapNoteView
              patient={selectedPatient}
              doctorName={auth?.name}
              onBack={() => setActivePage('clinical')}
              onOpenPatient={handleSelectPatient}
            />
          )}

          {activePage === 'patient360' && (
            <Patient360View
              patient={selectedPatient}
              onOpenDischarge={() => {
                setSelectedPatient(null);
                setActivePage('discharge');
              }}
              onOpenSoap={handleOpenSoap}
              onBack={() => setActivePage('patients')}
              onNavigate={(page) => {
                if (page === 'discharge') {
                  setSelectedPatient(null);
                }
                setActivePage(page);
              }}
              onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); setActivePage('radiology'); }}
              onOpenDrawer={setDrawer}
              onOpenModal={setModal}
            />
          )}

          {activePage === 'patients' && (
            <PatientsView
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={setActivePage}
              doctorName={role === 'Doctor' ? auth?.name : null}
              userRole={role}
            />
          )}

          {activePage === 'admissions' && (
            <AdmissionsView
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={setActivePage}
              doctorName={role === 'Doctor' ? auth?.name : null}
              userRole={role}
            />
          )}

          {activePage === 'bedboard' && <BedDemandView onSelectPatient={handleSelectPatient} />}

          {activePage === 'assistant' && (
            <HospitalAssistantView onNavigate={setActivePage} defaultQuery={aiPrompt} />
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
            <ResultsCriticalValuesView onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); setActivePage('radiology'); }} />
          )}
          {activePage === 'diagnostics' && (
            <DiagnosticsView onOpenRadiologyStudy={(studyId) => { setRequestedRadiologyStudy(studyId); setActivePage('radiology'); }} />
          )}
          {activePage === 'radiology' && (
            <RadiologyView requestedStudyId={requestedRadiologyStudy} onRequestedStudyHandled={() => setRequestedRadiologyStudy(null)} currentUser={auth} />
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
          {activePage === 'doctor-portal' && <DoctorDashboard />}
          {activePage === 'patient-chat' && <PatientChat />}
          {activePage === 'emergency' && <EmergencyView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'schedules' && <SchedulesView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'nursing' && <NursingWorkspaceView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'medications' && <MedicationAdminView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {(activePage === 'surgery' || activePage === 'otschedule') && <SurgeryOTView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
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
          
          {/* Pharmacy & Supply Chain Domain Views */}
          {activePage === 'prescriptions' && <PrescriptionsView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'drugs' && <DrugMasterView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'pharmacy' && <PharmacyView onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {['inventory', 'stores', 'procurement', 'vendors', 'cssd'].includes(activePage) && (
            <AdminSystemView module={activePage === 'inventory' ? 'Inventory Catalog & Stock' : activePage === 'procurement' ? 'Procurement & 3-Way Purchase Orders' : activePage === 'vendors' ? 'Vendor Management & Contracts' : activePage === 'cssd' ? 'CSSD Sterilization Register' : 'Central Stores & Depots'} onOpenDrawer={setDrawer} onOpenModal={setModal} />
          )}

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
            <AdminSystemView module={activePage === 'integration-arch' ? 'Integration Architecture' : activePage === 'users' ? 'User Accounts & MFA Security' : activePage === 'permissions' ? 'RBAC & ABAC Policy Permission Matrix' : activePage === 'identity' ? 'Patient Identity Resolution & Consent Master' : activePage === 'departments' ? 'Clinical Departments & Specialty Services' : activePage === 'facilities' ? 'Facilities & Housekeeping Bed Management' : activePage === 'integrations' ? 'Interface Connectors (HL7 / FHIR / ASTM)' : 'Enterprise Master Data'} onOpenDrawer={setDrawer} onOpenModal={setModal} />
          )}

          {/* Clinical Data Foundation Views */}
          {activePage === 'data-patient' && <DataDomainView domain="Patient Master Index" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'data-ops' && <DataDomainView domain="Operational Fact Records" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'data-clinical' && <DataDomainView domain="Clinical Observation Data" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'data-financial' && <DataDomainView domain="Financial Fact Ledger & AR/AP" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'data-quality' && <DataDomainView domain="Automated Data Quality & Rules" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'forecasting' && <DataDomainView domain="Predictive Inpatient Census & Demand" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'scenario' && <DataDomainView domain="Hospital Capacity & Surge Simulator" onOpenDrawer={setDrawer} onOpenModal={setModal} />}
          {activePage === 'beforeafter' && <DataDomainView domain="Pre vs Post AI Intervention Outcomes" onOpenDrawer={setDrawer} onOpenModal={setModal} />}

          {/* Standard Workspace Template for Other Domain Pages */}
          {![
            'command', 'patients', 'admissions', 'bedboard', 'clinical', 'discharge', 'soap', 'patient360',
            'assistant', 'beds', 'tables', 'explorer', 'sql', 'analytics', 'settings',
            'ai-command', 'agents', 'discharge-agent', 'approvals', 'orchestrator', 'runs', 'knowledge',
            'governance', 'risk', 'evals', 'observability', 'cost', 'incidents', 'trainer',
            'criticalvalues', 'diagnostics', 'radiology',
            'ai-desk', 'patient-chat', 'pre-admission', 'doctor-management', 'doctor-portal', 'escalations',
            'appointments', 'emergency', 'schedules', 'nursing', 'medications', 'surgery', 'otschedule',
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
                    Governed enterprise records · live clinical data platform
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
                  Return to Command Centre
                </button>
              </div>
            </div>
          )}
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
