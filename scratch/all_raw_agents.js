const agents = [
  { id: 'AG-01', name: 'Appointment Agent', v: '2.3.1', owner: 'Front Office', tier: 'Low', status: 'Active', success: '96.8%', lastRun: '11:19', runs: 412 },
  { id: 'AG-02', name: 'Patient Access Agent', v: '1.8.0', owner: 'Patient Experience', tier: 'Low', status: 'Active', success: '95.1%', lastRun: '11:18', runs: 380 },
  { id: 'AG-03', name: 'Pre-registration Agent', v: '1.4.2', owner: 'Front Office', tier: 'Low', status: 'Active', success: '97.4%', lastRun: '11:12', runs: 96 },
  { id: 'AG-04', name: 'Employee Service Agent', v: '1.6.0', owner: 'HR', tier: 'Low', status: 'Active', success: '93.2%', lastRun: '11:17', runs: 141 },
  { id: 'AG-05', name: 'Feedback Agent', v: '1.2.0', owner: 'Quality', tier: 'Medium', status: 'Active', success: '91.7%', lastRun: '11:04', runs: 58 },
  { id: 'AG-06', name: 'Queue / Flow Agent', v: '2.0.4', owner: 'Operations', tier: 'Low', status: 'Active', success: '98.9%', lastRun: '11:20', runs: 1290 },
  { id: 'AG-07', name: 'Insurance Preauth Agent', v: '2.1.0', owner: 'Insurance Desk', tier: 'High', status: 'Active', success: '92.4%', lastRun: '11:15', runs: 74 },
  { id: 'AG-08', name: 'Billing Transparency Agent', v: '1.9.3', owner: 'Finance', tier: 'High', status: 'Suspended', success: '89.0%', lastRun: '10:42', runs: 210 },
  { id: 'AG-09', name: 'Discharge Orchestration Agent', v: '3.0.2', owner: 'Operations', tier: 'High', status: 'Active', success: '94.2%', lastRun: '11:19', runs: 61 },
  { id: 'AG-10', name: 'Diagnostic Coordination Agent', v: '1.5.1', owner: 'Diagnostics', tier: 'Medium', status: 'Active', success: '95.6%', lastRun: '11:16', runs: 322 },
  { id: 'AG-11', name: 'Follow-up Agent', v: '1.3.0', owner: 'Patient Experience', tier: 'Low', status: 'Active', success: '94.0%', lastRun: '10:58', runs: 88 },
  { id: 'AG-12', name: 'Contact Centre Agent', v: '2.2.0', owner: 'Contact Centre', tier: 'Medium', status: 'Active', success: '90.3%', lastRun: '11:20', runs: 264 },
  { id: 'AG-13', name: 'AI Trainer Agent', v: '1.1.0', owner: 'Nursing Education', tier: 'Low', status: 'Active', success: '—', lastRun: '10:30', runs: 19 },
  { id: 'AG-14', name: 'Analytics Agent', v: '1.7.0', owner: 'Management', tier: 'Medium', status: 'Active', success: '93.8%', lastRun: '11:11', runs: 47 },
  { id: 'AG-15', name: 'Forecasting Agent', v: '1.0.6', owner: 'Operations', tier: 'Medium', status: 'Active', success: '—', lastRun: '06:00', runs: 1 },
  { id: 'AG-16', name: 'Radiology Screening Agent', v: '0.9.0', owner: 'Radiology', tier: 'High', status: 'Silent Validation', success: '—', lastRun: '11:08', runs: 52 },
  { id: 'AG-17', name: 'Voice Documentation Agent', v: '1.2.4', owner: 'Medical Records', tier: 'Medium', status: 'Active', success: '96.1%', lastRun: '11:02', runs: 33 },
  { id: 'AG-18', name: 'Nursing Handover Agent', v: '0.8.2', owner: 'Nursing', tier: 'Medium', status: 'Pilot', success: '—', lastRun: '07:05', runs: 12 },
];

const AGENT_EXTRA = [
  { id: 'AG-19', name: 'Discharge Summary Agent', v: '1.1.0', owner: 'Medical Records', tier: 'High', status: 'Active', success: '95.3%', lastRun: '11:07', runs: 44 },
  { id: 'AG-20', name: 'Claim Denial Agent', v: '1.0.2', owner: 'Insurance Desk', tier: 'Medium', status: 'Active', success: '91.0%', lastRun: '10:50', runs: 22 },
  { id: 'AG-21', name: 'Management Copilot', v: '1.3.0', owner: 'Management', tier: 'Medium', status: 'Active', success: '94.4%', lastRun: '11:19', runs: 31 },
];

const TYPE_OF = n => /Copilot|Access|Employee|Contact|Trainer/.test(n) ? 'Answerer' : /Summary|Handover|Voice|Analytics/.test(n) ? 'Summariser' : /Billing|Preauth|Claim/.test(n) ? 'Drafter' : /Screening|Queue|Feedback|Forecast/.test(n) ? 'Monitor' : /Discharge|Diagnostic|Appointment|Follow|Pre-reg/.test(n) ? 'Workflow Agent' : 'Decision Support';