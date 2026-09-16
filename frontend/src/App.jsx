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

// Databricks Gold Layer Views
import RevenueView from './components/RevenueView';
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
  ExceptionsView
} from './components/DummyDomainViews';

export default function App() {
  useEffect(() => {
    // Proactively pre-fetch and warm cache in background so all tabs load instantly without loading spinners
    apiService.preloadAllGoldData();
  }, []);
  const [auth, setAuth] = useState({
    username: 'meera.iyer',
    name: 'Meera Iyer',
    role: 'Hospital Management',
    dept: 'Administration'
  });

  const [role, setRoleState] = useState('Hospital Management');
  const [activePage, setActivePage] = useState('command');
  const [clockMins, setClockMins] = useState(11 * 60 + 20); // 11:20 AM
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [requestedRadiologyStudy, setRequestedRadiologyStudy] = useState(null);

  const setRole = (newRole) => {
    setRoleState(newRole);
    const allowed = ROLE_PAGE_ACCESS[newRole];
    if (allowed !== null && allowed !== undefined && !allowed.includes(activePage)) {
      setActivePage(allowed[0] || 'patients');
    }
  };

  // Clock format
  const hours = Math.floor(clockMins / 60) % 24;
  const minutes = clockMins % 60;
  const formattedClock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const advanceClock = () => {
    setClockMins(m => m + 15);
  };

  const handleSignOut = () => {
    setAuth(null);
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
        clock={formattedClock}
        advanceClock={advanceClock}
        alertsCount={9}
        onSignOut={handleSignOut}
        onOpenMobile={() => setShowMobile(true)}
        onAskAi={handleAskAi}
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
              doctorName={auth.name}
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
            />
          )}

          {activePage === 'discharge' && (
            <DischargeCommandCentre
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'soap' && (
            <SoapNoteView
              patient={selectedPatient}
              doctorName={auth.name}
              onBack={() => setActivePage('clinical')}
              onOpenPatient={handleSelectPatient}
            />
          )}

          {activePage === 'patient360' && (
            <Patient360View
              patient={selectedPatient}
              onOpenDischarge={() => setActivePage('discharge')}
              onOpenSoap={handleOpenSoap}
              onBack={() => setActivePage('clinical')}
            />
          )}

          {activePage === 'patients' && (
            <PatientsView
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'admissions' && (
            <AdmissionsView
              onSelectPatient={handleSelectPatient}
              onOpenSoap={handleOpenSoap}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'bedboard' && <BedDemandView onSelectPatient={handleSelectPatient} />}

          {activePage === 'assistant' && (
            <HospitalAssistantView onNavigate={setActivePage} defaultQuery={aiPrompt} />
          )}

          {activePage === 'revenue' && <RevenueView />}
          {activePage === 'beds' && <BedDemandView onSelectPatient={handleSelectPatient} />}
          {activePage === 'tables' && <SchemaExplorerView onViewData={() => setActivePage('explorer')} />}
          {activePage === 'explorer' && <DataExplorerView />}
          {activePage === 'sql' && <SqlSandboxView />}
          {activePage === 'analytics' && <AnalyticsView />}
          {activePage === 'settings' && <SettingsView />}

          {/* AI & Agents Platform Views */}
          {activePage === 'ai-command' && <AiCommandCentreView onNavigate={setActivePage} />}
          {activePage === 'agents' && <AgentStudioView onNavigate={setActivePage} />}
          {activePage === 'discharge-agent' && <DischargeAgentView onNavigate={setActivePage} />}
          {activePage === 'approvals' && <ApprovalsView onNavigate={setActivePage} userRole={role} />}
          {activePage === 'orchestrator' && <OrchestratorView onNavigate={setActivePage} />}
          {activePage === 'runs' && <AgentRunsView onNavigate={setActivePage} />}
          {activePage === 'knowledge' && <GovernedKnowledgeView />}
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
            <RadiologyView requestedStudyId={requestedRadiologyStudy} onRequestedStudyHandled={() => setRequestedRadiologyStudy(null)} />
          )}

          {/* Operational, Clinical, Diagnostic & Revenue Domain Dummy Views */}
          {activePage === 'appointments' && <AppointmentsView />}
          {activePage === 'emergency' && <EmergencyView />}
          {activePage === 'schedules' && <SchedulesView />}
          {activePage === 'nursing' && <NursingWorkspaceView />}
          {activePage === 'medications' && <MedicationAdminView />}
          {(activePage === 'surgery' || activePage === 'otschedule') && <SurgeryOTView />}
          {activePage === 'bloodbank' && <BloodBankView />}
          {activePage === 'deathmlc' && <DeathMlcView />}
          {activePage === 'sbar' && <SbarView />}
          {activePage === 'lab' && <LabDashboardView />}
          {activePage === 'billing' && <BillingView />}
          {activePage === 'insurance' && <InsuranceView />}
          {activePage === 'claims' && <ClaimsView />}
          {activePage === 'finance' && <FinanceDashboardView />}
          {activePage === 'tax' && <TaxConfigView />}
          {activePage === 'exceptions' && <ExceptionsView />}
          {activePage === 'audit' && <AuditTrailView />}
          {activePage === 'data-patient' && <DataDomainView domain="Patient Master Index" />}
          {activePage === 'data-ops' && <DataDomainView domain="Operational Fact Records" />}
          {activePage === 'data-clinical' && <DataDomainView domain="Clinical Observation Data" />}
          {activePage === 'data-financial' && <DataDomainView domain="Financial Fact Ledger & AR/AP" />}
          {activePage === 'data-quality' && <DataDomainView domain="Automated Data Quality & Rules" />}
          {activePage === 'forecasting' && <DataDomainView domain="Predictive Inpatient Census & Demand" />}
          {activePage === 'scenario' && <DataDomainView domain="Hospital Capacity & Surge Simulator" />}
          {activePage === 'beforeafter' && <DataDomainView domain="Pre vs Post AI Intervention Outcomes" />}

          {/* Standard Workspace Template for Other Domain Pages */}
          {![
            'command', 'patients', 'admissions', 'bedboard', 'clinical', 'discharge', 'soap', 'patient360',
            'assistant', 'revenue', 'beds', 'tables', 'explorer', 'sql', 'analytics', 'settings',
            'ai-command', 'agents', 'discharge-agent', 'approvals', 'orchestrator', 'runs', 'knowledge',
            'governance', 'risk', 'evals', 'observability', 'cost', 'incidents', 'trainer',
            'criticalvalues', 'diagnostics', 'radiology',
            'appointments', 'emergency', 'schedules', 'nursing', 'medications', 'surgery', 'otschedule',
            'bloodbank', 'deathmlc', 'sbar', 'lab', 'billing', 'insurance', 'claims', 'finance', 'tax',
            'exceptions', 'audit',
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
