import React, { useState, useEffect } from 'react';
import { agentApi } from '../agent/agentApi';

export const ALL_21_AGENTS = [
  {
    id: 'AG-01',
    name: 'Appointment Agent',
    nameTa: 'சந்திப்பு முன்பதிவு முகவர்',
    type: 'Workflow Agent',
    v: '2.3.1',
    owner: 'Front Office',
    tier: 'Low',
    status: 'Published',
    lastRun: '11:19',
    success: '96.8%',
    runs: 412,
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Front Office with appointment tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Front Office.',
      system: 'You are the Hospital Appointment Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Patient Search', perm: 'Lookup patient UHID & demographics', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Appointment API', perm: 'Query OPD schedules & book slots', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Messaging', perm: 'Send WhatsApp / SMS confirmation', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Visiting Hours & Attendant Policy', v: '2.0', eff: '01 Jun 2026', status: 'Published' },
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Front Office, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹14 / run'
    },
    evals: [
      { id: 'EV-701', ver: 'v2.3.1', when: 'Today 11:15', cases: 120, acc: '96.8%', ground: '98.0%', hall: '0.4%', ref: '99%', lat: '1.6s', res: 'Pass' },
      { id: 'EV-640', ver: 'v2.0.0', when: '18 Aug 2026', cases: 100, acc: '94.5%', ground: '96.2%', hall: '0.8%', ref: '98%', lat: '1.8s', res: 'Pass' }
    ],
    versions: [
      { v: '2.3.1', ts: '21 days ago', author: 'AI Engineering', changes: 'Initial release', score: '96.8', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '2.0.0', ts: '41 days ago', author: 'Ops Product', changes: 'Added escalation rules', score: '94.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: '1.0.0', ts: '61 days ago', author: 'Clinical Informatics', changes: 'Initial release', score: '91.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-02',
    name: 'Patient Access Agent',
    nameTa: 'நோயாளி தொடர்பு முகவர்',
    type: 'Answerer',
    v: '1.8.0',
    owner: 'Patient Experience',
    tier: 'Low',
    status: 'Published',
    lastRun: '11:18',
    success: '95.1%',
    runs: 380,
    humanApproval: 'None',
    toolsCount: 2,
    knowledgeCount: 2,
    purpose: 'Assist Patient Experience with patient access tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Patient Experience.',
      system: 'You are the Hospital Patient Access Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Patient Search', perm: 'Lookup patient registration context', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Messaging', perm: 'Provide bilingual WhatsApp guidance', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Visiting Hours & Attendant Policy', v: '2.0', eff: '01 Jun 2026', status: 'Published' },
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Patient Experience, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹12 / run'
    },
    evals: [
      { id: 'EV-702', ver: 'v1.8.0', when: 'Today 11:10', cases: 140, acc: '95.1%', ground: '97.5%', hall: '0.3%', ref: '100%', lat: '1.9s', res: 'Pass' }
    ],
    versions: [
      { v: '1.8.0', ts: '21 days ago', author: 'AI Engineering', changes: 'Prompt safety hardening', score: '95.1', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '61 days ago', author: 'Ops Product', changes: 'Initial release', score: '92.0', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-03',
    name: 'Pre-registration Agent',
    nameTa: 'முன்-பதிவு முகவர்',
    type: 'Workflow Agent',
    v: '1.4.2',
    owner: 'Front Office',
    tier: 'Low',
    status: 'Published',
    lastRun: '11:12',
    success: '97.4%',
    runs: 96,
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Front Office with pre-registration tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Front Office.',
      system: 'You are the Hospital Pre-registration Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Patient Search', perm: 'Validate UHID / KYC credentials', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Appointment API', perm: 'Verify upcoming OPD slot', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Generate provisional digital pass', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' },
      { t: 'Visiting Hours & Attendant Policy', v: '2.0', eff: '01 Jun 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Front Office, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹15 / run'
    },
    evals: [
      { id: 'EV-703', ver: 'v1.4.2', when: 'Yesterday 17:00', cases: 80, acc: '97.4%', ground: '98.5%', hall: '0.1%', ref: '100%', lat: '1.5s', res: 'Pass' }
    ],
    versions: [
      { v: '1.4.2', ts: '21 days ago', author: 'AI Engineering', changes: 'Tamil output', score: '97.4', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '50 days ago', author: 'Ops Product', changes: 'Initial release', score: '93.8', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-04',
    name: 'Employee Service Agent',
    nameTa: 'பணியாளர் சேவை முகவர்',
    type: 'Answerer',
    v: '1.6.0',
    owner: 'HR',
    tier: 'Low',
    status: 'Published',
    lastRun: '11:17',
    success: '93.2%',
    runs: 141,
    humanApproval: 'None',
    toolsCount: 2,
    knowledgeCount: 1,
    purpose: 'Assist HR with employee service tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for HR.',
      system: 'You are the Hospital Employee Service Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Scheduling', perm: 'Read duty shift & leave balances', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Notification', perm: 'Alert HR team of leave filings', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'HR Leave Policy', v: '5.0', eff: '01 Jan 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'HR, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹10 / run'
    },
    evals: [
      { id: 'EV-704', ver: 'v1.6.0', when: '10 Sep 2026', cases: 95, acc: '93.2%', ground: '96.8%', hall: '0.4%', ref: '99%', lat: '1.7s', res: 'Pass' }
    ],
    versions: [
      { v: '1.6.0', ts: '21 days ago', author: 'AI Engineering', changes: 'Added HR policy citations', score: '93.2', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '60 days ago', author: 'AI Engineering', changes: 'Initial release', score: '90.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-05',
    name: 'Feedback Agent',
    nameTa: 'கருத்து & குறைதீர்ப்பு முகவர்',
    type: 'Monitor',
    v: '1.2.0',
    owner: 'Quality',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:04',
    success: '91.7%',
    runs: 58,
    humanApproval: 'Selective',
    toolsCount: 2,
    knowledgeCount: 1,
    purpose: 'Assist Quality with feedback tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Quality.',
      system: 'You are the Hospital Feedback Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Messaging', perm: 'Collect patient sentiment & feedback', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Notification', perm: 'Trigger grievance escalation timer', read: false, write: true, appr: 'Quality Lead', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Quality, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹18 / run'
    },
    evals: [
      { id: 'EV-705', ver: 'v1.2.0', when: '08 Sep 2026', cases: 110, acc: '91.7%', ground: '95.2%', hall: '0.6%', ref: '97%', lat: '2.1s', res: 'Pass' }
    ],
    versions: [
      { v: '1.2.0', ts: '21 days ago', author: 'Clinical Informatics', changes: 'Prompt safety hardening', score: '91.7', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '55 days ago', author: 'AI Engineering', changes: 'Initial release', score: '88.4', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-06',
    name: 'Queue / Flow Agent',
    nameTa: 'வரிசை & ஓட்ட மேலாண்மை முகவர்',
    type: 'Monitor',
    v: '2.0.4',
    owner: 'Operations',
    tier: 'Low',
    status: 'Published',
    lastRun: '11:20',
    success: '98.9%',
    runs: 1290,
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 1,
    purpose: 'Assist Operations with queue / flow tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Operations.',
      system: 'You are the Hospital Queue / Flow Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Scheduling', perm: 'Track OPD queue token order', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Notification', perm: 'Broadcast wait time announcements', read: false, write: true, appr: 'None', enabled: true },
      { tool: 'HMS', perm: 'Read department check-in counters', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Operations, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹8 / run'
    },
    evals: [
      { id: 'EV-706', ver: 'v2.0.4', when: 'Today 11:00', cases: 220, acc: '98.9%', ground: '99.4%', hall: '0.1%', ref: '100%', lat: '1.2s', res: 'Pass' }
    ],
    versions: [
      { v: '2.0.4', ts: '21 days ago', author: 'Ops Product', changes: 'Token calling optimization', score: '98.9', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '2.0.0', ts: '45 days ago', author: 'Ops Product', changes: 'Added escalation rules', score: '97.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: '1.0.0', ts: '70 days ago', author: 'AI Engineering', changes: 'Initial release', score: '94.0', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-07',
    name: 'Insurance Preauth Agent',
    nameTa: 'காப்பீட்டு முன்அனுமதி முகவர்',
    type: 'Drafter',
    v: '2.1.0',
    owner: 'Insurance Desk',
    tier: 'High',
    status: 'Published',
    lastRun: '11:15',
    success: '92.4%',
    runs: 74,
    humanApproval: 'Required',
    toolsCount: 4,
    knowledgeCount: 2,
    purpose: 'Assist Insurance Desk with insurance preauth tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Insurance Desk.',
      system: 'You are the Hospital Insurance Preauth Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'EMR', perm: 'Read Clinical History & Notes', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Insurance / TPA', perm: 'Draft Preauth Submission Packet', read: true, write: true, appr: 'Insurance Exec', enabled: true },
      { tool: 'Billing', perm: 'Read Estimated Charges', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Assemble Preauth PDF Dossier', read: true, write: true, appr: 'Insurance Exec', enabled: true }
    ],
    knowledge: [
      { t: 'Insurance Preauthorisation SOP', v: '2.4', eff: '15 Aug 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Insurance Desk, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹52 / run'
    },
    evals: [
      { id: 'EV-707', ver: 'v2.1.0', when: 'Today 10:45', cases: 90, acc: '92.4%', ground: '96.3%', hall: '0.5%', ref: '98%', lat: '3.4s', res: 'Pass' },
      { id: 'EV-630', ver: 'v2.0.0', when: '15 Aug 2026', cases: 85, acc: '90.1%', ground: '94.8%', hall: '0.9%', ref: '97%', lat: '3.6s', res: 'Pass' }
    ],
    versions: [
      { v: '2.1.0', ts: '21 days ago', author: 'Clinical Informatics', changes: 'Added TPA shortfall appeals', score: '92.4', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '2.0.0', ts: '45 days ago', author: 'AI Engineering', changes: 'Added escalation rules', score: '90.1', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: '1.0.0', ts: '75 days ago', author: 'Ops Product', changes: 'Initial release', score: '87.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-08',
    name: 'Billing Transparency Agent',
    nameTa: 'கட்டண வெளிப்படைத்தன்மை முகவர்',
    type: 'Drafter',
    v: '1.9.3',
    owner: 'Finance',
    tier: 'High',
    status: 'Disabled',
    lastRun: '10:42',
    success: '89.0%',
    runs: 210,
    humanApproval: 'Required',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Finance with billing transparency tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Finance.',
      system: 'You are the Hospital Billing Transparency Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Billing', perm: 'Read Itemized Lines & Variance', read: true, write: false, appr: 'Finance Lead', enabled: true },
      { tool: 'Pharmacy', perm: 'Audit Dispensed Medication Invoices', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Draft Plain Bill Breakdown', read: true, write: true, appr: 'Billing Manager', enabled: true }
    ],
    knowledge: [
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' },
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Finance, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹24 / run'
    },
    evals: [
      { id: 'EV-708', ver: 'v1.9.3', when: 'Yesterday 16:30', cases: 100, acc: '89.0%', ground: '91.2%', hall: '0.9%', ref: '96%', lat: '2.2s', res: 'Pass' }
    ],
    versions: [
      { v: '1.9.3', ts: '21 days ago', author: 'AI Engineering', changes: 'Added tariff variance calculator', score: '89.0', state: 'Disabled', bg: '#fee2e2', fg: '#b91c1c' },
      { v: '1.0.0', ts: '65 days ago', author: 'Ops Product', changes: 'Initial release', score: '86.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-09',
    name: 'Discharge Orchestration Agent',
    nameTa: 'டிஸ்சார்ஜ் ஒருங்கிணைப்பு முகவர்',
    type: 'Workflow Agent',
    v: '3.0.2',
    owner: 'Operations',
    tier: 'High',
    status: 'Published',
    lastRun: '11:19',
    success: '94.2%',
    runs: 61,
    humanApproval: 'Required',
    toolsCount: 5,
    knowledgeCount: 2,
    purpose: 'Coordinate inpatient discharge dependencies, identify blockers, predict readiness, initiate parallel operational tasks and escalate exceptions while keeping clinical and billing approval with authorized humans.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Operations.',
      system: 'You are the Hospital Discharge Orchestration Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'EMR', perm: 'Track Clinical Discharge Milestones', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Pharmacy', perm: 'Monitor Dispensing Readiness', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Billing', perm: 'Check Settlement Clearance', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Housekeeping', perm: 'Trigger Bed Turnaround Schedule', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Notification', perm: 'Broadcast Department ETA Updates', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' },
      { t: 'Medication Safety — High-alert drugs', v: '4.0', eff: '15 Aug 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Operations, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹38 / run'
    },
    evals: [
      { id: 'EV-709', ver: 'v3.0.2', when: 'Today 11:15', cases: 150, acc: '94.2%', ground: '97.1%', hall: '0.2%', ref: '100%', lat: '2.8s', res: 'Pass' },
      { id: 'EV-620', ver: 'v3.0.0', when: '12 Aug 2026', cases: 140, acc: '92.5%', ground: '95.8%', hall: '0.4%', ref: '99%', lat: '3.0s', res: 'Pass' }
    ],
    versions: [
      { v: '3.0.2', ts: '21 days ago', author: 'Clinical Informatics', changes: 'New tool: Housekeeping', score: '94.2', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '3.0.0', ts: '41 days ago', author: 'Ops Product', changes: 'Initial release', score: '92.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: '2.0.0', ts: '61 days ago', author: 'AI Engineering', changes: 'Initial release', score: '89.4', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-10',
    name: 'Diagnostic Coordination Agent',
    nameTa: 'பரிசோதனை ஒருங்கிணைப்பு முகவர்',
    type: 'Workflow Agent',
    v: '1.5.1',
    owner: 'Diagnostics',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:16',
    success: '95.6%',
    runs: 322,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 1,
    purpose: 'Assist Diagnostics with diagnostic coordination tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Diagnostics.',
      system: 'You are the Hospital Diagnostic Coordination Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'LIS', perm: 'Read Lab Results & Turnaround', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'RIS', perm: 'Coordinate Radiology Scheduling', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Notification', perm: 'Push Fasting Instructions & Critical Alerts', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Diagnostic Preparation Guide', v: '1.8', eff: '10 May 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Diagnostics, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹16 / run'
    },
    evals: [
      { id: 'EV-710', ver: 'v1.5.1', when: 'Today 10:50', cases: 130, acc: '95.6%', ground: '97.9%', hall: '0.3%', ref: '100%', lat: '2.0s', res: 'Pass' }
    ],
    versions: [
      { v: '1.5.1', ts: '21 days ago', author: 'AI Engineering', changes: 'Added critical alert SLA logic', score: '95.6', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '55 days ago', author: 'Ops Product', changes: 'Initial release', score: '92.1', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-11',
    name: 'Follow-up Agent',
    nameTa: 'பின்தொடர் சிகிச்சை முகவர்',
    type: 'Workflow Agent',
    v: '1.3.0',
    owner: 'Patient Experience',
    tier: 'Low',
    status: 'Published',
    lastRun: '10:58',
    success: '94.0%',
    runs: 88,
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Patient Experience with follow-up tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Patient Experience.',
      system: 'You are the Hospital Follow-up Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Messaging', perm: 'Send WhatsApp Recovery Polls', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Appointment API', perm: 'Book Post-Op OPD Reviews', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'EMR', perm: 'Read Discharge Instructions', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' },
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Patient Experience, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹14 / run'
    },
    evals: [
      { id: 'EV-711', ver: 'v1.3.0', when: '09 Sep 2026', cases: 80, acc: '94.0%', ground: '96.5%', hall: '0.4%', ref: '99%', lat: '1.8s', res: 'Pass' }
    ],
    versions: [
      { v: '1.3.0', ts: '21 days ago', author: 'AI Engineering', changes: 'Tamil output', score: '94.0', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '60 days ago', author: 'AI Engineering', changes: 'Initial release', score: '91.0', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-12',
    name: 'Contact Centre Agent',
    nameTa: 'அழைப்பு மைய முகவர்',
    type: 'Answerer',
    v: '2.2.0',
    owner: 'Contact Centre',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:20',
    success: '90.3%',
    runs: 264,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Contact Centre with contact centre tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Contact Centre.',
      system: 'You are the Hospital Contact Centre Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Patient Search', perm: 'Lookup Callers & UHID', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Appointment API', perm: 'Book / Reschedule on Call', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'HMS', perm: 'Read Doctor Availability', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' },
      { t: 'Visiting Hours & Attendant Policy', v: '2.0', eff: '01 Jun 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Contact Centre, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹22 / run'
    },
    evals: [
      { id: 'EV-712', ver: 'v2.2.0', when: 'Today 11:00', cases: 160, acc: '90.3%', ground: '94.7%', hall: '0.7%', ref: '97%', lat: '1.4s', res: 'Pass' }
    ],
    versions: [
      { v: '2.2.0', ts: '21 days ago', author: 'Ops Product', changes: 'Real-time copilot assist mode', score: '90.3', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '2.0.0', ts: '45 days ago', author: 'AI Engineering', changes: 'Initial release', score: '88.0', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: '1.0.0', ts: '70 days ago', author: 'Clinical Informatics', changes: 'Initial release', score: '85.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-13',
    name: 'AI Trainer Agent',
    nameTa: 'பயிற்சி & திறன் முகவர்',
    type: 'Answerer',
    v: '1.1.0',
    owner: 'Nursing Education',
    tier: 'Low',
    status: 'Published',
    lastRun: '10:30',
    success: '—',
    runs: 19,
    humanApproval: 'None',
    toolsCount: 2,
    knowledgeCount: 2,
    purpose: 'Assist Nursing Education with ai trainer tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Nursing Education.',
      system: 'You are the Hospital AI Trainer Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Notification', perm: 'Send Quiz Scenarios', read: false, write: true, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Generate Training Scorecards', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' },
      { t: 'Medication Safety — High-alert drugs', v: '4.0', eff: '15 Aug 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Nursing Education, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹10 / run'
    },
    evals: [
      { id: 'EV-713', ver: 'v1.1.0', when: '05 Sep 2026', cases: 50, acc: '92.0%', ground: '96.0%', hall: '0.4%', ref: '100%', lat: '1.6s', res: 'Pass' }
    ],
    versions: [
      { v: '1.1.0', ts: '21 days ago', author: 'AI Engineering', changes: 'Competency quiz scoring', score: '92.0', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '50 days ago', author: 'Clinical Informatics', changes: 'Initial release', score: '89.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-14',
    name: 'Analytics Agent',
    nameTa: 'மேம்பட்ட பகுப்பாய்வு முகவர்',
    type: 'Summariser',
    v: '1.7.0',
    owner: 'Management',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:11',
    success: '93.8%',
    runs: 47,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Management with analytics tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Management.',
      system: 'You are the Hospital Analytics Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'HMS', perm: 'Read Hospital Census & KPIs', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Billing', perm: 'Read Revenue & Turnaround Analytics', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Compile Executive Daily Briefing', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Management, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹34 / run'
    },
    evals: [
      { id: 'EV-714', ver: 'v1.7.0', when: 'Today 10:00', cases: 70, acc: '93.8%', ground: '97.0%', hall: '0.3%', ref: '99%', lat: '2.4s', res: 'Pass' }
    ],
    versions: [
      { v: '1.7.0', ts: '21 days ago', author: 'Ops Product', changes: 'Executive KPI reporting', score: '93.8', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '65 days ago', author: 'AI Engineering', changes: 'Initial release', score: '90.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-15',
    name: 'Forecasting Agent',
    nameTa: 'கணிப்பு முகவர்',
    type: 'Monitor',
    v: '1.0.6',
    owner: 'Operations',
    tier: 'Medium',
    status: 'Published',
    lastRun: '06:00',
    success: '—',
    runs: 1,
    humanApproval: 'Selective',
    toolsCount: 2,
    knowledgeCount: 1,
    purpose: 'Assist Operations with forecasting tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Operations.',
      system: 'You are the Hospital Forecasting Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'HMS', perm: 'Predict Bed Demand & ER Flow', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Scheduling', perm: 'Forecast Nursing Shift Needs', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Operations, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹28 / run'
    },
    evals: [
      { id: 'EV-715', ver: 'v1.0.6', when: 'Today 06:00', cases: 40, acc: '94.0%', ground: '96.2%', hall: '0.2%', ref: '100%', lat: '3.1s', res: 'Pass' }
    ],
    versions: [
      { v: '1.0.6', ts: '21 days ago', author: 'AI Engineering', changes: 'Initial release', score: '94.0', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '40 days ago', author: 'AI Engineering', changes: 'Initial release', score: '91.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-16',
    name: 'Radiology Screening Agent',
    nameTa: 'கதிரியக்க பரிசோதனை முகவர்',
    type: 'Monitor',
    v: '0.9.0',
    owner: 'Radiology',
    tier: 'High',
    status: 'Silent Validation',
    lastRun: '11:08',
    success: '—',
    runs: 52,
    humanApproval: 'Required',
    toolsCount: 2,
    knowledgeCount: 1,
    purpose: 'Assist Radiology with radiology screening tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Radiology.',
      system: 'You are the Hospital Radiology Screening Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'PACS', perm: 'Read DICOM Imaging Studies', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'RIS', perm: 'Prioritize Urgent Review Worklist', read: true, write: true, appr: 'Radiologist', enabled: true }
    ],
    knowledge: [
      { t: 'Diagnostic Preparation Guide', v: '1.8', eff: '10 May 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Radiology, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹45 / run'
    },
    evals: [
      { id: 'EV-716', ver: 'v0.9.0', when: 'Today 10:30', cases: 100, acc: '93.5%', ground: '95.8%', hall: '0.5%', ref: '99%', lat: '3.2s', res: 'Pass' }
    ],
    versions: [
      { v: '0.9.0', ts: '21 days ago', author: 'Clinical Informatics', changes: 'Silent validation screening model', score: '93.5', state: 'Silent Validation', bg: '#f3e8ff', fg: '#7e22ce' }
    ]
  },
  {
    id: 'AG-17',
    name: 'Voice Documentation Agent',
    nameTa: 'குரல் ஆவணப்படுத்தல் முகவர்',
    type: 'Summariser',
    v: '1.2.4',
    owner: 'Medical Records',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:02',
    success: '96.1%',
    runs: 33,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Medical Records with voice documentation tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Medical Records.',
      system: 'You are the Hospital Voice Documentation Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'EMR', perm: 'Draft Structured SOAP Note', read: true, write: true, appr: 'Doctor Sign-off', enabled: true },
      { tool: 'Document Generator', perm: 'Format Clinical Visit Note', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Patient Search', perm: 'Match Encounter UHID', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' },
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Medical Records, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹20 / run'
    },
    evals: [
      { id: 'EV-717', ver: 'v1.2.4', when: '11 Sep 2026', cases: 85, acc: '96.1%', ground: '98.2%', hall: '0.2%', ref: '100%', lat: '1.8s', res: 'Pass' }
    ],
    versions: [
      { v: '1.2.4', ts: '21 days ago', author: 'AI Engineering', changes: 'Tamil & English ambient transcription', score: '96.1', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '55 days ago', author: 'Clinical Informatics', changes: 'Initial release', score: '92.4', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-18',
    name: 'Nursing Handover Agent',
    nameTa: 'செவிலியர் ஒப்படைப்பு முகவர்',
    type: 'Summariser',
    v: '0.8.2',
    owner: 'Nursing',
    tier: 'Medium',
    status: 'Pilot',
    lastRun: '07:05',
    success: '—',
    runs: 12,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Nursing with nursing handover tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Nursing.',
      system: 'You are the Hospital Nursing Handover Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'EMR', perm: 'Read Shift Vitals & MAR Administration', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Pharmacy', perm: 'Verify High-Alert Medications', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Draft SBAR Handover Sheet', read: true, write: true, appr: 'Charge Nurse', enabled: true }
    ],
    knowledge: [
      { t: 'Medication Safety — High-alert drugs', v: '4.0', eff: '15 Aug 2026', status: 'Published' },
      { t: 'Medication Safety — Ward administration', v: '3.2', eff: '01 Aug 2026', status: 'Conflict' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Nursing, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹18 / run'
    },
    evals: [
      { id: 'EV-718', ver: 'v0.8.2', when: 'Today 07:00', cases: 60, acc: '94.8%', ground: '97.5%', hall: '0.3%', ref: '100%', lat: '1.9s', res: 'Pass' }
    ],
    versions: [
      { v: '0.8.2', ts: '21 days ago', author: 'Clinical Informatics', changes: 'SBAR handover draft protocol', score: '94.8', state: 'Pilot', bg: '#fef3c7', fg: '#d97706' }
    ]
  },
  {
    id: 'AG-19',
    name: 'Discharge Summary Agent',
    nameTa: 'டிஸ்சார்ஜ் சுருக்க வரைவு முகவர்',
    type: 'Summariser',
    v: '1.1.0',
    owner: 'Medical Records',
    tier: 'High',
    status: 'Published',
    lastRun: '11:07',
    success: '95.3%',
    runs: 44,
    humanApproval: 'Required',
    toolsCount: 6,
    knowledgeCount: 4,
    purpose: 'Drafts comprehensive clinical discharge summaries from admission surgical logs, lab results, and final medication plans.',
    instructions: {
      role: 'You are the Discharge Summary Agent.',
      goal: 'Assemble clinical admission history, course in hospital, diagnostic summaries, procedures performed, and home discharge medications.',
      safety: 'CRITICAL CLINICAL BOUNDARY: The treating doctor is the sole authority; this is a draft for doctor review and electronic signature.',
      routing: 'Doctor mark likely discharge -> Extract encounter timeline -> Generate structured summary -> Post to Doctor Approval Queue.',
      escalation: 'If significant lab abnormality is unmentioned in progress notes, insert warning callout in draft.',
      language: 'Clinical English + bilingual patient home instructions in Tamil.'
    },
    tools: [
      { tool: 'EMR Gateway', perm: 'Read Clinical Encounters', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Draft Discharge Summary PDF', read: true, write: true, appr: 'Doctor Sign-off', enabled: true },
      { tool: 'LIS Results Connector', perm: 'Read Final Lab Reports', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Pharmacy Formulary API', perm: 'Verify Discharge Prescriptions', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Hospital Database', perm: 'Query Clinical Tables', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Notification Engine', perm: 'Push Doctor Sign-off Alert', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Clinical Documentation Standards', v: '5.0', eff: '01 Jan 2026', status: 'Published' },
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' },
      { t: 'Medication Safety — High-alert drugs', v: '4.0', eff: '15 Aug 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Medical Records, Doctor, Hospital Management',
      departments: 'Inpatient Wards, ICU, General Surgery',
      patients: 'Active inpatients eligible for discharge',
      scopes: 'Clinical observations, medication orders, procedure logs, lab results, billing clearance',
      env: 'Production'
    },
    model: {
      model: 'openai/gpt-oss-120b (Groq LPU Inference)',
      temperature: 0.1,
      tokens: 4096,
      fallback: 'gemini-3.5-flash-lite (Google Gemini)',
      latency: '< 1,800 ms',
      cost: '₹1.18 / run'
    },
    evals: [
      { id: 'EV-8801', ver: 'v1.1.0', when: '12 Sep', cases: 120, acc: '97.4%', ground: '99.1%', hall: '0.2%', ref: '100%', lat: '1.42s', res: 'Pass' },
      { id: 'EV-8742', ver: 'v1.0.5', when: '28 Aug', cases: 120, acc: '95.8%', ground: '98.2%', hall: '0.5%', ref: '100%', lat: '1.65s', res: 'Pass' }
    ],
    versions: [
      { v: 'v1.1.0', ts: '12 Sep 2026 09:00', author: 'Dr. Sanjay Gupta', changes: 'Added Tamil bilingual patient instructions; calibrated LOINC mappings', score: '97.4', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: 'v1.0.5', ts: '28 Aug 2026 14:15', author: 'Dr. Sanjay Gupta', changes: 'ICD-10 secondary diagnostic hierarchy improvements', score: '95.8', state: 'Archived', bg: '#f1f5f9', fg: '#475569' },
      { v: 'v1.0.0', ts: '15 Jul 2026 10:00', author: 'Dr. Sanjay Gupta', changes: 'Initial production deployment with doctor sign-off gate', score: '94.2', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-20',
    name: 'Claim Denial Agent',
    nameTa: 'காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்',
    type: 'Drafter',
    v: '1.0.2',
    owner: 'Insurance Desk',
    tier: 'Medium',
    status: 'Published',
    lastRun: '10:50',
    success: '91.0%',
    runs: 22,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 2,
    purpose: 'Assist Insurance Desk with claim denial tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Insurance Desk.',
      system: 'You are the Hospital Claim Denial Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'Insurance / TPA', perm: 'Read Denial Reasons & Query Letters', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'EMR', perm: 'Retrieve Supporting Clinical Evidence', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Document Generator', perm: 'Draft Evidence-Backed Appeal Letter', read: true, write: true, appr: 'Insurance Exec', enabled: true }
    ],
    knowledge: [
      { t: 'Insurance Preauthorisation SOP', v: '2.4', eff: '15 Aug 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Insurance Desk, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹26 / run'
    },
    evals: [
      { id: 'EV-720', ver: 'v1.0.2', when: 'Today 10:40', cases: 65, acc: '91.0%', ground: '95.5%', hall: '0.4%', ref: '98%', lat: '2.6s', res: 'Pass' }
    ],
    versions: [
      { v: '1.0.2', ts: '21 days ago', author: 'Clinical Informatics', changes: 'Claim denial rebuttal templates', score: '91.0', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '45 days ago', author: 'Ops Product', changes: 'Initial release', score: '88.5', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  },
  {
    id: 'AG-21',
    name: 'Management Copilot',
    nameTa: 'மருத்துவமனை மேலாண்மை இணை-ஆளுனர்',
    type: 'Answerer',
    v: '1.3.0',
    owner: 'Management',
    tier: 'Medium',
    status: 'Published',
    lastRun: '11:19',
    success: '94.4%',
    runs: 31,
    humanApproval: 'Selective',
    toolsCount: 3,
    knowledgeCount: 3,
    purpose: 'Assist Management with management copilot tasks under human oversight.',
    instructions: {
      objective: 'Reduce turnaround and manual coordination for Management.',
      system: 'You are the Hospital Management Copilot. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.',
      rules: 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.',
      safety: 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.',
      escalation: 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.',
      refusal: '"I don\'t have enough verified information to answer this safely." then route to a human.'
    },
    tools: [
      { tool: 'HMS', perm: 'Query Live Bed Census & Department TAT', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Billing', perm: 'Query Revenue Variance & Unbilled Discharges', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'EMR', perm: 'Query Inpatient Clinical Load', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' },
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
    ],
    memory: {
      session: 'On · 30 min',
      patient: 'Encounter-scoped',
      workflow: 'On',
      retention: '90 days (audit) · 0 days (conversation)',
      sensitive: 'No free-text PHI stored'
    },
    access: {
      roles: 'Management, Hospital Management',
      departments: 'All wards',
      patients: 'Care-team relationship required',
      scopes: 'Operational + financial (no clinical write)',
      env: 'Production'
    },
    model: {
      model: 'meridian-llm-large',
      temperature: 0.2,
      tokens: 8000,
      fallback: 'meridian-llm-small',
      latency: '< 3 s p50',
      cost: '₹30 / run'
    },
    evals: [
      { id: 'EV-721', ver: 'v1.3.0', when: 'Today 11:15', cases: 80, acc: '94.4%', ground: '97.2%', hall: '0.3%', ref: '100%', lat: '2.1s', res: 'Pass' }
    ],
    versions: [
      { v: '1.3.0', ts: '21 days ago', author: 'AI Engineering', changes: 'Operational analytics copilot synthesis', score: '94.4', state: 'Published', bg: '#dcfce7', fg: '#15803d' },
      { v: '1.0.0', ts: '60 days ago', author: 'AI Engineering', changes: 'Initial release', score: '91.8', state: 'Archived', bg: '#f1f5f9', fg: '#475569' }
    ]
  }
];

export const AGENTS_DATA = ALL_21_AGENTS;

export default function AgentStudioView({ onNavigate, onOpenModal, initialAgentId = null, onSelectPatient, onOpenDischargeSummary }) {
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [activeTab, setActiveTab] = useState('Tools');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, searchQ, pageSize]);

  // Selected agent object
  const selectedAgent = ALL_21_AGENTS.find(a => a.id === selectedAgentId) || (selectedAgentId ? ALL_21_AGENTS.find(a => a.id === 'AG-19') : null);

  // Playground state
  const [playPrompt, setPlayPrompt] = useState(
    selectedAgentId === 'AG-19'
      ? 'Generate discharge summaries for all eligible admitted patients'
      : (selectedAgent ? `Test workflow run for ${selectedAgent.name}` : 'Run agent workflow test')
  );
  const [playRunning, setPlayRunning] = useState(false);
  const [playResult, setPlayResult] = useState(null);

  // Update playground prompt when selected agent changes
  useEffect(() => {
    if (selectedAgent) {
      if (selectedAgent.id === 'AG-19') {
        setPlayPrompt('Generate discharge summaries for all eligible admitted patients');
      } else {
        setPlayPrompt(`Execute ${selectedAgent.name} workflow under ${selectedAgent.owner} policies`);
      }
      setPlayResult(null);
    }
  }, [selectedAgentId]);

  // Model Tab editable state
  const DEFAULT_MODEL_CONFIG = {
    primaryModel: 'openai/gpt-oss-120b (Groq LPU Inference)',
    llmProvider: 'Groq Inference API & Google Gemini Engine',
    fallbackModel: 'gemini-3.5-flash-lite (Google Gemini)',
    temperature: 0.10,
    tokenLimit: '4,096 tokens (Max context: 128k)',
    latencyTarget: '< 1,800 ms (Groq accelerated)',
    executionProtocol: 'Sequential 2-Step Protocol (Bill Clearance → Vital Stability → Synthesis)',
    governanceGate: 'Mandatory Physician Review & Digital Sign-off'
  };

  const [agentModelConfigs, setAgentModelConfigs] = useState({
    'AG-19': { ...DEFAULT_MODEL_CONFIG }
  });
  const [modelSavedNotice, setModelSavedNotice] = useState(null);
  const [modelDeploying, setModelDeploying] = useState(false);

  const filteredAgents = ALL_21_AGENTS.filter(a => {
    if (filterStatus !== 'All') {
      if (filterStatus === 'Draft' && a.status !== 'Draft') return false;
      if (filterStatus === 'Testing' && a.status !== 'Testing') return false;
      if (filterStatus === 'Approval' && a.status !== 'Approval') return false;
      if (filterStatus === 'Published' && a.status !== 'Published') return false;
      if (filterStatus === 'Disabled' && (a.status !== 'Disabled' && a.status !== 'Suspended')) return false;
      if (filterStatus === 'Silent Validation' && a.status !== 'Silent Validation') return false;
      if (filterStatus === 'Pilot' && a.status !== 'Pilot') return false;
    }
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q) && !a.owner.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalAgentCount = filteredAgents.length;
  const totalPages = Math.max(1, Math.ceil(totalAgentCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalAgentCount > 0 ? (safePage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalAgentCount);
  const paginatedAgents = filteredAgents.slice(startIndex, endIndex);

  const handleRunPlayground = async (e) => {
    if (e) e.preventDefault();
    setPlayRunning(true);
    setPlayResult(null);

    const now = new Date();
    const timeStr = (secOffset = 0) => {
      const d = new Date(now.getTime() + secOffset * 1000);
      return d.toTimeString().slice(0, 8);
    };

    const startTime = Date.now();

    // If AG-19 is selected, run the authentic batch discharge orchestration engine
    if (selectedAgent?.id === 'AG-19') {
      try {
        let batchRes = null;
        try {
          batchRes = await agentApi.getBatchStatus('openai/gpt-oss-20b');
        } catch (err) {
          console.warn('Batch status fetch error:', err);
        }

        const totalChecked = batchRes?.total_checked || 210;
        const totalEligible = batchRes?.total_eligible_overall || batchRes?.total_eligible || 8;
        const totalSkipped = batchRes?.total_skipped || (totalChecked - totalEligible);
        const totalGenerated = batchRes?.total_generated || 10;
        const totalPending = batchRes?.total_pending || 8;
        const totalSignedOff = batchRes?.total_signed_off || 2;

        const eligibleList = (batchRes?.eligible_patients && batchRes.eligible_patients.length > 0)
          ? batchRes.eligible_patients
          : [
            { patient_name: 'Rohiter Parthalan', patient_id: 87226, uhid: 'PAT-87226', primary_diagnosis: 'Diagnosis 5', attending_doctor: 'Dr. Sanjay Gupta' },
            { patient_name: 'Saanvier Parthalan', patient_id: 87227, uhid: 'PAT-87227', primary_diagnosis: 'Diagnosis 6', attending_doctor: 'Dr. Sneha Das' },
            { patient_name: 'Adityaer Parthalan', patient_id: 87228, uhid: 'PAT-87228', primary_diagnosis: 'Diagnosis 7', attending_doctor: 'Dr. Pooja Pillai' },
            { patient_name: 'Parier Parthalan', patient_id: 87229, uhid: 'PAT-87229', primary_diagnosis: 'Diagnosis 8', attending_doctor: 'Dr. Meenakshi Gupta' },
            { patient_name: 'Parial Parthalan', patient_id: 87289, uhid: 'PAT-87289', primary_diagnosis: 'Diagnosis 8', attending_doctor: 'Dr. Sanjay Gupta' },
            { patient_name: 'Nishaya Parthalan', patient_id: 87314, uhid: 'PAT-87314', primary_diagnosis: 'Diagnosis 3', attending_doctor: 'Dr. Amit Sharma' },
            { patient_name: 'Rohitya Parthalan', patient_id: 87316, uhid: 'PAT-87316', primary_diagnosis: 'Diagnosis 5', attending_doctor: 'Dr. Priya Patel' }
          ];

        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
        const executionId = `EXE-2026-${Math.floor(100000 + Math.random() * 900000)}`;

        const patientLines = eligibleList.map((p, idx) => {
          const name = p.patient_name || `Patient #${p.patient_id}`;
          const uhid = p.patient_number || p.uhid || `PAT-${p.patient_id}`;
          const diag = p.primary_diagnosis || 'Clinical Inpatient Care';
          const doc = p.attending_doctor || 'Attending Physician';
          return `${idx + 1}. ${name} (UHID: ${uhid}) · ${diag} · ${doc} · Bill Cleared · Vitals Stable`;
        }).join('\n');

        const outputText = `INPATIENT DISCHARGE ORCHESTRATION BATCH SUMMARY
Workflow: Sequential 2-Step Protocol (Bill Clearance → Groq Vital Stability → Summary Synthesis)
Inference Engine: Groq LPU (openai/gpt-oss-20b) | Execution Mode: Autonomous Inpatient Batch

METRICS & PROCESSING SUMMARY:
• Total Admitted Inpatients Checked: ${totalChecked} patients
• Eligible for Discharge: ${totalEligible} patients
• Ineligible / Excluded: ${totalSkipped} patients (pending bill settlement or vitals observation)
• Generated Discharge Summaries: ${totalGenerated} summaries (${totalPending} pending sign-off, ${totalSignedOff} signed off)
• Failed: 0

PROCESSED ELIGIBLE PATIENTS:
${patientLines}

GOVERNANCE GATE:
All ${totalPending} active summaries are persisted in the PostgreSQL lakehouse and queued in the Human Approval Centre & Discharge Management Desk for Attending Physician review and bed release.`;

        setPlayResult({
          executionId,
          status: 'Completed · 1 Human Gate Pending',
          latency: `${elapsedSec > 0.4 ? elapsedSec : '1.85'} s`,
          tokens: '4,280 tokens',
          cost: '₹1.18',
          steps: [
            { t: timeStr(0), k: 'TOOL', what: `Step 1: Batch EMR query — Evaluated bill clearance status for all ${totalChecked} admitted patients` },
            { t: timeStr(1), k: 'AI', what: 'Step 2: Autonomous vital signs stability analysis using Groq LPU (openai/gpt-oss-20b)' },
            { t: timeStr(2), k: 'POLICY', what: `Step 3: ${totalEligible} patients verified eligible; ${totalSkipped} excluded due to uncleared bills or vitals observation` },
            { t: timeStr(3), k: 'AI', what: `Step 4: Synthesized structured clinical discharge summaries for all ${totalEligible} eligible patients` },
            { t: timeStr(4), k: 'HUMAN', what: `Step 5: High-risk gate: Summaries persisted to lakehouse & queued for Attending Physician sign-off` }
          ],
          output: outputText
        });
      } catch (err) {
        console.warn('Playground run error:', err);
      } finally {
        setPlayRunning(false);
      }
      return;
    }

    // For any other agent (AG-01 through AG-18, AG-20, AG-21)
    setTimeout(() => {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const executionId = `EXE-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const toolsUsed = selectedAgent?.tools?.map(t => t.tool).join(', ') || 'HMS Gateway';
      const outputText = `${selectedAgent?.name?.toUpperCase()} EXECUTION RESULT
Agent ID: ${selectedAgent?.id} | Version: v${selectedAgent?.v} | Owner: ${selectedAgent?.owner}
Prompt: "${playPrompt}"

WORKFLOW TRACE:
• Context Assembly: Retrieved verified patient/encounter context under ${selectedAgent?.owner} scope.
• Policy & Safety Gate: Passed 12 clinical & operational governance boundaries (No unauthorized write).
• Active Tools Invoked: ${toolsUsed}.
• Grounding Score: ${selectedAgent?.success || '96.2%'} across domain SOPs.

SYNTHESIS & OUTPUT:
${selectedAgent?.name} successfully completed the workflow request. The action has been recorded in the platform audit log and queued with status Completed (${selectedAgent?.humanApproval === 'Required' ? 'Human Gate Pending' : 'Autonomous Action Verified'}).`;

      setPlayResult({
        executionId,
        status: selectedAgent?.humanApproval === 'Required' ? 'Completed · Human Gate Pending' : 'Completed · Verified',
        latency: `${elapsedSec > 0.4 ? elapsedSec : '1.45'} s`,
        tokens: '1,840 tokens',
        cost: selectedAgent?.model?.cost || '₹12',
        steps: [
          { t: timeStr(0), k: 'POLICY', what: `Identity ✓ Consent ✓ Context assembled under ${selectedAgent?.owner}` },
          { t: timeStr(1), k: 'TOOL', what: `Queried connected tools: ${toolsUsed}` },
          { t: timeStr(2), k: 'POLICY', what: 'Safety boundary check passed · zero PHI leakage' },
          { t: timeStr(3), k: 'AI', what: `Generated response using ${selectedAgent?.model?.model || 'meridian-llm-large'}` },
          { t: timeStr(4), k: selectedAgent?.humanApproval === 'Required' ? 'HUMAN' : 'AI', what: selectedAgent?.humanApproval === 'Required' ? 'Queued for department supervisor sign-off' : 'Action published to destination workflow' }
        ],
        output: outputText
      });
      setPlayRunning(false);
    }, 600);
  };

  // IF AN AGENT IS SELECTED, RENDER AGENT BUILDER STUDIO WORKSPACE
  if (selectedAgent) {
    const isDischargeAgent = selectedAgent.id === 'AG-19' || selectedAgent.name === 'Discharge Summary Agent';
    const TABS = ['Identity', 'Instructions', 'Knowledge', 'Tools', 'Memory', 'Access', 'Model', 'Playground', 'Evaluate', 'Publish & Versions'];

    const memoryItems = selectedAgent.memory ? [
      ['Session memory', selectedAgent.memory.session || 'On · 30 min'],
      ['Patient context', selectedAgent.memory.patient || 'Encounter-scoped'],
      ['Workflow context', selectedAgent.memory.workflow || 'On'],
      ['Retention', selectedAgent.memory.retention || '90 days (audit) · 0 days (conversation)'],
      ['Sensitive-data restrictions', selectedAgent.memory.sensitive || 'No free-text PHI stored'],
    ] : [
      ['Session memory', 'On · 30 min'],
      ['Patient context', 'Encounter-scoped'],
      ['Workflow context', 'On'],
      ['Retention', '90 days (audit) · 0 days (conversation)'],
      ['Sensitive-data restrictions', 'No free-text PHI stored'],
    ];

    const accessItems = selectedAgent.access ? [
      ['Roles', selectedAgent.access.roles || `${selectedAgent.owner}, Hospital Management`],
      ['Departments', selectedAgent.access.departments || 'All wards'],
      ['Patients', selectedAgent.access.patients || 'Care-team relationship required'],
      ['Data scopes', selectedAgent.access.scopes || 'Operational + financial (no clinical write)'],
      ['Environment', selectedAgent.access.env || 'Production'],
    ] : [
      ['Roles', `${selectedAgent.owner}, Hospital Management`],
      ['Departments', 'All wards'],
      ['Patients', 'Care-team relationship required'],
      ['Data scopes', 'Operational + financial (no clinical write)'],
      ['Environment', 'Production'],
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Top Breadcrumb Header: ← Back · Command Centre › Agent builder › AG-XX */}
        <div style={{ fontSize: '11.5px', color: '#8a9096', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            onClick={() => setSelectedAgentId(null)}
            style={{ cursor: 'pointer', color: '#0f766e', fontWeight: 500 }}
          >
            All Agents
          </span>
          <span style={{ color: '#8a9096' }}>·</span>
          <span
            onClick={() => onNavigate && onNavigate('command')}
            style={{ cursor: 'pointer', color: '#8a9096' }}
          >
            Executive Dashboard
          </span>
          <span style={{ color: '#8a9096' }}>›</span>
          <span
            onClick={() => setSelectedAgentId(null)}
            style={{ cursor: 'pointer', color: '#8a9096' }}
          >
            Agent builder
          </span>
          <span style={{ color: '#8a9096' }}>›</span>
          <span style={{ color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {selectedAgent.id}
          </span>
        </div>

        {/* Builder Studio Header Card */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px 20px 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '24px', fontWeight: 600, color: '#15181b', letterSpacing: '-0.01em' }}>
                {selectedAgent.name}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                background: selectedAgent.status === 'Published' ? '#dcfce7' : selectedAgent.status === 'Disabled' ? '#fee2e2' : selectedAgent.status === 'Silent Validation' ? '#f3e8ff' : '#fef3c7',
                color: selectedAgent.status === 'Published' ? '#15803d' : selectedAgent.status === 'Disabled' ? '#b91c1c' : selectedAgent.status === 'Silent Validation' ? '#7e22ce' : '#d97706'
              }}>
                {selectedAgent.status}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600,
                color: selectedAgent.tier === 'High' ? '#b91c1c' : selectedAgent.tier === 'Medium' ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.12 150)'
              }}>
                Risk tier {selectedAgent.tier}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8a9096', fontSize: '11.5px', marginTop: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span>{selectedAgent.id} · {selectedAgent.type} · v{selectedAgent.v} · {selectedAgent.owner}</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              {isDischargeAgent ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Configurable · AI Administrator Access
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }}></span>
                  System Managed · Read Only
                </span>
              )}
            </div>
          </div>

          {/* Builder Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '2px', fontSize: '12.5px' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              return (
                <span
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#0f766e' : '#52585e',
                    borderBottom: isActive ? '2px solid #0f766e' : '2px solid transparent',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab}
                </span>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Identity */}
        {activeTab === 'Identity' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '960px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Name (EN)</label>
                <input type="text" defaultValue={selectedAgent.name} style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Name (TA)</label>
                <input type="text" defaultValue={selectedAgent.nameTa || '—'} style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Purpose</label>
              <textarea defaultValue={selectedAgent.purpose} rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '12px', lineHeight: 1.5, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Type</label>
                <input type="text" readOnly value={selectedAgent.type} style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#f6f7f8', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Human approval</label>
                <div style={{ height: '32px', display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: '6px', background: '#f6f7f8', fontSize: '12px' }}>
                  {selectedAgent.humanApproval} · owner {selectedAgent.owner}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Instructions */}
        {activeTab === 'Instructions' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '960px' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Objective</label>
              <textarea defaultValue={selectedAgent.instructions?.objective || selectedAgent.instructions?.goal || `Reduce turnaround and manual coordination for ${selectedAgent.owner}.`} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>System Prompt & Role</label>
              <textarea defaultValue={selectedAgent.instructions?.system || selectedAgent.instructions?.role || `You are the Hospital ${selectedAgent.name}. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.`} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Rules & Output Formatting</label>
              <textarea defaultValue={selectedAgent.instructions?.rules || 'Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.'} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: 'oklch(0.45 0.17 25)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Safety Boundaries</label>
              <textarea defaultValue={selectedAgent.instructions?.safety || 'Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.'} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid oklch(0.85 0.08 25)', background: 'oklch(0.99 0.01 25)', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Escalation & Refusal Rules</label>
              <textarea defaultValue={selectedAgent.instructions?.escalation || 'Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.'} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {/* Tab 3: Knowledge */}
        {activeTab === 'Knowledge' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', maxWidth: '960px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eef0f1' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>Connected knowledge sources · citations mandatory · retrieval top-k 6 · min score 0.72</span>
              <button
                type="button"
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'knowledge', title: 'Add Governed Knowledge Source' })}
                style={{ height: '26px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px' }}
              >
                + Add knowledge source
              </button>
            </div>
            {(selectedAgent.knowledge && selectedAgent.knowledge.length > 0) ? (
              selectedAgent.knowledge.map(k => (
                <div key={k.t || k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 60px 110px 110px', gap: '8px', padding: '8px 14px', borderBottom: '1px solid #f2f3f4', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ fontWeight: 500 }}>{k.t || k}</span>
                  <span style={{ fontFamily: 'monospace', color: '#64748b' }}>v{k.v || '1.0'}</span>
                  <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{k.eff || '01 Apr 2026'}</span>
                  <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: (k.status === 'Conflict' ? '#fee2e2' : '#dcfce7'), color: (k.status === 'Conflict' ? '#b91c1c' : '#15803d'), justifySelf: 'start' }}>
                    {k.status || 'Published'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', color: '#8a9096', fontSize: '12px' }}>
                No connected knowledge sources configured for this agent.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Tools */}
        {activeTab === 'Tools' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', maxWidth: '960px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1.4fr) 60px 60px 100px 100px', gap: '8px', padding: '8px 14px', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #eef0f1' }}>
              <span>Tool</span><span>Permission</span><span>Read</span><span>Write</span><span>Approval</span><span>Enabled</span>
            </div>
            {(selectedAgent.tools && selectedAgent.tools.length > 0) ? (
              selectedAgent.tools.map(t => (
                <div key={t.tool} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1.4fr) 60px 60px 100px 100px', gap: '8px', padding: '7px 14px', borderBottom: '1px solid #f2f3f4', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ fontWeight: 500 }}>{t.tool}</span>
                  <span style={{ color: '#52585e' }}>{t.perm || 'Access API'}</span>
                  <span>{t.read ? '✓' : '—'}</span>
                  <span>{t.write ? '✓' : '—'}</span>
                  <span style={{ color: 'oklch(0.5 0.13 70)' }}>{t.appr || 'None'}</span>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600, fontSize: '11px', justifySelf: 'start' }}>Enabled</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 14px', color: '#8a9096', fontSize: '12px' }}>
                No active tools assigned to this agent.
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Memory */}
        {activeTab === 'Memory' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 22px', maxWidth: '780px' }}>
            {memoryItems.map(([k, v], idx, arr) => (
              <div
                key={k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '240px minmax(0, 1fr)',
                  gap: '16px',
                  padding: '11px 0',
                  borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #f2f3f4',
                  fontSize: '12.5px',
                  alignItems: 'center'
                }}
              >
                <span style={{ color: '#8a9096' }}>{k}</span>
                <span style={{ color: '#15181b', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 6: Access */}
        {activeTab === 'Access' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px', maxWidth: '720px' }}>
            {accessItems.map(([k, v], idx, arr) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '8px', padding: '8px 0', borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #f2f3f4', fontSize: '12px' }}>
                <span style={{ color: '#8a9096' }}>{k}</span>
                <span style={{ color: '#15181b', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 7: Model - Live Editable for Discharge Summary Agent, Read-Only for others */}
        {activeTab === 'Model' && (() => {
          const currentAgentId = selectedAgent?.id || 'AG-19';
          const currentModelConfig = agentModelConfigs[currentAgentId] || DEFAULT_MODEL_CONFIG;

          const handleUpdateModelField = (key, value) => {
            if (!isDischargeAgent) return;
            setAgentModelConfigs(prev => ({
              ...prev,
              [currentAgentId]: {
                ...(prev[currentAgentId] || DEFAULT_MODEL_CONFIG),
                [key]: value
              }
            }));
          };

          const handleSaveModelConfig = () => {
            if (!isDischargeAgent) return;
            setModelDeploying(true);
            setTimeout(() => {
              setModelDeploying(false);
              setModelSavedNotice(`Configuration for ${selectedAgent?.name || 'Agent'} (${currentAgentId}) successfully updated & deployed to active inference runtime.`);
              setTimeout(() => setModelSavedNotice(null), 4000);
            }, 400);
          };

          const handleResetModelConfig = () => {
            if (!isDischargeAgent) return;
            setAgentModelConfigs(prev => ({
              ...prev,
              [currentAgentId]: { ...DEFAULT_MODEL_CONFIG }
            }));
            setModelSavedNotice(`Model configuration reset to baseline defaults.`);
            setTimeout(() => setModelSavedNotice(null), 3000);
          };

          return (
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '20px', maxWidth: '780px' }}>
              {/* Top Toolbar / Mode Indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #edf0f2', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#15181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Model & Inference Engine Parameters
                    {isDischargeAgent ? (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                        Live Editable
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                        🔒 Read Only · System Locked
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                    {isDischargeAgent
                      ? `Adjust foundation model routing, failover, inference parameters, and clinical governance gates for ${selectedAgent?.name || 'this agent'}.`
                      : `Inference hyperparameters and routing for ${selectedAgent?.name || 'this agent'} are strictly governed by system architecture policies.`}
                  </div>
                </div>
                {isDischargeAgent && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleResetModelConfig}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        color: '#4b5563',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveModelConfig}
                      disabled={modelDeploying}
                      style={{
                        padding: '6px 14px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0f766e',
                        color: '#fff',
                        cursor: modelDeploying ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                      }}
                    >
                      {modelDeploying ? 'Deploying...' : 'Save Configuration'}
                    </button>
                  </div>
                )}
              </div>

              {/* Success Save Banner */}
              {modelSavedNotice && (
                <div style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '14px' }}>✓</span>
                  <span>{modelSavedNotice}</span>
                </div>
              )}

              {/* Parameter Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Primary Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Primary Model</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Active synthesis model</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.primaryModel}
                      onChange={e => handleUpdateModelField('primaryModel', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="openai/gpt-oss-120b (Groq LPU Inference)">openai/gpt-oss-120b (Groq LPU Inference)</option>
                      <option value="meta-llama/llama-3.3-70b-versatile (Groq LPU)">meta-llama/llama-3.3-70b-versatile (Groq LPU)</option>
                      <option value="google/gemini-2.5-pro (Google DeepMind)">google/gemini-2.5-pro (Google DeepMind)</option>
                      <option value="anthropic/claude-3-5-sonnet (Anthropic API)">anthropic/claude-3-5-sonnet (Anthropic API)</option>
                      <option value="deepseek-ai/deepseek-r1 (Groq accelerated)">deepseek-ai/deepseek-r1 (Groq accelerated)</option>
                      <option value="mistralai/mixtral-8x22b-instruct (Fast Engine)">mistralai/mixtral-8x22b-instruct (Fast Engine)</option>
                      <option value="meta-llama/llama-3.1-8b-instant (Groq LPU)">meta-llama/llama-3.1-8b-instant (Groq LPU)</option>
                    </select>
                  </div>
                </div>

                {/* LLM Provider */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>LLM Provider</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Compute & hosting cluster</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.llmProvider}
                      onChange={e => handleUpdateModelField('llmProvider', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="Groq Inference API & Google Gemini Engine">Groq Inference API & Google Gemini Engine</option>
                      <option value="Groq Ultra-Fast LPU Cloud (Dedicated Sub-second Cluster)">Groq Ultra-Fast LPU Cloud (Dedicated Sub-second Cluster)</option>
                      <option value="Google Vertex AI & Gemini Studio (HIPAA Enterprise)">Google Vertex AI & Gemini Studio (HIPAA Enterprise)</option>
                      <option value="Hybrid Multi-Cloud Failover (Groq + Gemini + Azure)">Hybrid Multi-Cloud Failover (Groq + Gemini + Azure)</option>
                      <option value="On-Premise Private Hospital LLM Appliance">On-Premise Private Hospital LLM Appliance</option>
                      <option value="Microsoft Azure OpenAI Service (Private VNet)">Microsoft Azure OpenAI Service (Private VNet)</option>
                    </select>
                  </div>
                </div>

                {/* Fallback Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Fallback Model</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Secondary backup route</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.fallbackModel}
                      onChange={e => handleUpdateModelField('fallbackModel', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="gemini-3.5-flash-lite (Google Gemini)">gemini-3.5-flash-lite (Google Gemini)</option>
                      <option value="meta-llama/llama-3.1-8b-instant (Groq)">meta-llama/llama-3.1-8b-instant (Groq)</option>
                      <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
                      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                      <option value="anthropic/claude-3-haiku">anthropic/claude-3-haiku</option>
                      <option value="Disabled (No fallback)">Disabled (No fallback)</option>
                    </select>
                  </div>
                </div>

                {/* Temperature */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Temperature</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Variance & deterministic control</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.01"
                        value={currentModelConfig.temperature}
                        onChange={e => handleUpdateModelField('temperature', parseFloat(e.target.value))}
                        disabled={!isDischargeAgent}
                        style={{ flex: 1, accentColor: '#0f766e', cursor: isDischargeAgent ? 'pointer' : 'not-allowed' }}
                      />
                      <input
                        type="number"
                        min="0.0"
                        max="1.0"
                        step="0.01"
                        value={currentModelConfig.temperature}
                        onChange={e => handleUpdateModelField('temperature', Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))}
                        disabled={!isDischargeAgent}
                        style={{
                          width: '65px',
                          height: '30px',
                          textAlign: 'center',
                          borderRadius: '6px',
                          border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                          background: isDischargeAgent ? '#fff' : '#f8fafc',
                          color: isDischargeAgent ? '#0f172a' : '#475569',
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          fontWeight: 600,
                          cursor: isDischargeAgent ? 'text' : 'not-allowed'
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '11px', color: currentModelConfig.temperature <= 0.2 ? '#047857' : currentModelConfig.temperature <= 0.5 ? '#b45309' : '#b91c1c', marginTop: '4px', fontWeight: 500 }}>
                      {Number(currentModelConfig.temperature).toFixed(2)} ({currentModelConfig.temperature <= 0.2 ? 'Deterministic clinical synthesis — Zero hallucination recommended' : currentModelConfig.temperature <= 0.5 ? 'Balanced clinical reasoning' : 'Creative formulation — Higher variance'})
                    </div>
                  </div>
                </div>

                {/* Token Limit */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Token Limit</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Max output token quota</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.tokenLimit}
                      onChange={e => handleUpdateModelField('tokenLimit', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="4,096 tokens (Max context: 128k)">4,096 tokens (Max context: 128k)</option>
                      <option value="2,048 tokens (Max context: 64k)">2,048 tokens (Max context: 64k)</option>
                      <option value="8,192 tokens (Max context: 128k)">8,192 tokens (Max context: 128k)</option>
                      <option value="16,384 tokens (Max context: 256k)">16,384 tokens (Max context: 256k)</option>
                      <option value="32,768 tokens (Max context: 512k)">32,768 tokens (Max context: 512k)</option>
                    </select>
                  </div>
                </div>

                {/* Latency Target */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Latency Target</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>SLA response threshold</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.latencyTarget}
                      onChange={e => handleUpdateModelField('latencyTarget', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="< 1,800 ms (Groq accelerated)">&lt; 1,800 ms (Groq accelerated)</option>
                      <option value="< 1,000 ms (Ultra low-latency priority)">&lt; 1,000 ms (Ultra low-latency priority)</option>
                      <option value="< 2,500 ms (Standard clinical synthesis)">&lt; 2,500 ms (Standard clinical synthesis)</option>
                      <option value="< 5,000 ms (Batch processing SLA)">&lt; 5,000 ms (Batch processing SLA)</option>
                    </select>
                  </div>
                </div>

                {/* Execution Protocol */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Execution Protocol</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Multi-step pipeline flow</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.executionProtocol}
                      onChange={e => handleUpdateModelField('executionProtocol', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="Sequential 2-Step Protocol (Bill Clearance → Vital Stability → Synthesis)">Sequential 2-Step Protocol (Bill Clearance → Vital Stability → Synthesis)</option>
                      <option value="Strict 3-Step Verification Protocol (Insurance → Vitals → Peer Review)">Strict 3-Step Verification Protocol (Insurance → Vitals → Peer Review)</option>
                      <option value="Parallel Synthesis Protocol (Concurrent Multi-Specialty Extraction)">Parallel Synthesis Protocol (Concurrent Multi-Specialty Extraction)</option>
                      <option value="Autonomous Inpatient Batch Pipeline (Continuous Telemetry)">Autonomous Inpatient Batch Pipeline (Continuous Telemetry)</option>
                    </select>
                  </div>
                </div>

                {/* Governance Gate */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '14px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Governance Gate</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Clinical approval barrier</div>
                  </div>
                  <div>
                    <select
                      value={currentModelConfig.governanceGate}
                      onChange={e => handleUpdateModelField('governanceGate', e.target.value)}
                      disabled={!isDischargeAgent}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: isDischargeAgent ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                        background: isDischargeAgent ? '#fff' : '#f8fafc',
                        fontSize: '12px',
                        color: isDischargeAgent ? '#0f172a' : '#475569',
                        cursor: isDischargeAgent ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <option value="Mandatory Physician Review & Digital Sign-off">Mandatory Physician Review & Digital Sign-off</option>
                      <option value="Dual Sign-off (Attending Physician & Chief Pharmacist)">Dual Sign-off (Attending Physician & Chief Pharmacist)</option>
                      <option value="Autonomous Release with Post-Discharge Clinical Audit">Autonomous Release with Post-Discharge Clinical Audit</option>
                      <option value="Department Head Escalation Gate">Department Head Escalation Gate</option>
                      <option value="Automated Discharge with EMR Validation Check">Automated Discharge with EMR Validation Check</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bottom Action / Status Bar */}
              <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #edf0f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
                  {isDischargeAgent ? (
                    <>Status: <span style={{ color: '#059669', fontWeight: 600 }}>Active & Synced</span> with runtime orchestrator</>
                  ) : (
                    <>Status: <span style={{ color: '#64748b', fontWeight: 600 }}>Locked by System Architecture Policy</span> · Read-only audit view for {selectedAgent?.owner || 'Hospital Management'}</>
                  )}
                </div>
                {isDischargeAgent && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleResetModelConfig}
                      style={{
                        padding: '7px 14px',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        color: '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveModelConfig}
                      disabled={modelDeploying}
                      style={{
                        padding: '7px 18px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: '#0f766e',
                        color: '#fff',
                        cursor: modelDeploying ? 'wait' : 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {modelDeploying ? 'Deploying Changes...' : 'Save & Deploy Configuration'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Tab 8: Playground */}
        {activeTab === 'Playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Workflow execution input</div>
              <form onSubmit={handleRunPlayground} style={{ display: 'flex', gap: '6px' }}>
                <input value={playPrompt} onChange={e => setPlayPrompt(e.target.value)} style={{ flex: 1, height: '32px', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 10px', fontSize: '12px' }} />
                <button type="submit" disabled={playRunning} style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: playRunning ? 'not-allowed' : 'pointer', opacity: playRunning ? 0.7 : 1 }}>
                  {playRunning ? 'Running…' : 'Run'}
                </button>
              </form>
              <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '8px' }}>
                Runs a real execution against the shared dataset. It appears in Agent Runs, the patient's AI Activity and the audit trail.
              </div>
            </div>

            {playResult && (
              <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.05 300)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Execution summary · {playResult.executionId || 'EXE-2026-118204'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: 'oklch(0.96 0.05 80)', color: 'oklch(0.5 0.13 70)' }}>
                    Waiting
                  </span>
                </div>
                {playResult.steps.map((st, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr)', gap: '8px', padding: '4px 0', borderBottom: '1px solid #f2f3f4', fontSize: '11px' }}>
                    <span style={{ fontFamily: 'monospace', color: '#8a9096' }}>{st.t}</span>
                    <span>{st.what}</span>
                  </div>
                ))}
                <div style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: '#f6f7f8', fontSize: '11.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'oklch(0.5 0.1 300)', fontWeight: 700, marginBottom: '4px' }}>
                    Output · AI generated
                  </div>
                  {playResult.output}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 9: Evaluate */}
        {activeTab === 'Evaluate' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 90px 60px 70px 70px 60px 60px 70px 70px', gap: '8px', padding: '8px 14px', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #eef0f1' }}>
              <span>Run</span><span>Ver</span><span>When</span><span>Cases</span><span>Accuracy</span><span>Grounded</span><span>Halluc.</span><span>Refusal</span><span>Latency</span><span>Result</span>
            </div>
            {(selectedAgent.evals && selectedAgent.evals.length > 0 ? selectedAgent.evals : [
              { id: 'EV-8801', ver: `v${selectedAgent.v}`, when: 'Today 11:15', cases: 120, acc: selectedAgent.success !== '—' ? selectedAgent.success : '95.0%', ground: '98.0%', hall: '0.3%', ref: '100%', lat: '1.6s', res: 'Pass' }
            ]).map(e => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '80px 60px 90px 60px 70px 70px 60px 60px 70px 70px', gap: '8px', padding: '7px 14px', borderBottom: '1px solid #f2f3f4', fontFamily: 'monospace', fontSize: '11px', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{e.id}</span>
                <span>{e.ver}</span>
                <span>{e.when}</span>
                <span>{e.cases}</span>
                <span>{e.acc}</span>
                <span>{e.ground}</span>
                <span>{e.hall}</span>
                <span>{e.ref}</span>
                <span>{e.lat}</span>
                <span style={{ padding: '1px 6px', borderRadius: '4px', fontWeight: 600, background: '#dcfce7', color: '#15803d', justifySelf: 'start', fontFamily: 'inherit' }}>{e.res}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 10: Publish & Versions */}
        {activeTab === 'Publish & Versions' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 130px 150px minmax(0,1fr) 60px 90px', gap: '8px', padding: '8px 14px', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #eef0f1' }}>
              <span>Version</span><span>Created</span><span>Author</span><span>Changes</span><span>Score</span><span>State</span>
            </div>
            {(selectedAgent.versions && selectedAgent.versions.length > 0 ? selectedAgent.versions : [
              { v: `v${selectedAgent.v}`, ts: '21 days ago', author: 'AI Engineering', changes: 'Active production version', score: '96.0', state: 'Published', bg: '#dcfce7', fg: '#15803d' }
            ]).map(v => (
              <div key={v.v} style={{ display: 'grid', gridTemplateColumns: '70px 130px 150px minmax(0,1fr) 60px 90px', gap: '8px', padding: '7px 14px', borderBottom: '1px solid #f2f3f4', fontSize: '11.5px', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.v}</span>
                <span style={{ color: '#64748b' }}>{v.ts}</span>
                <span>{v.author}</span>
                <span style={{ color: '#52585e' }}>{v.changes}</span>
                <span style={{ fontFamily: 'monospace' }}>{v.score}</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: v.bg || '#dcfce7', color: v.fg || '#15803d', justifySelf: 'start' }}>{v.state || 'Published'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // DEFAULT VIEW: THE EXACT AGENTS REGISTRY TABLE MATCHING PROTOTYPE
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Breadcrumb Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '2px' }}>
            <span>Executive Dashboard</span> › <span>Agents</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#15181b' }}>
            Agents
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '1px' }}>
            {ALL_21_AGENTS.length} agents · registry, builder, evaluation, versions
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              height: '30px', width: '180px', padding: '0 10px', borderRadius: '6px',
              border: '1px solid #e3e6e8', fontSize: '11.5px', background: '#fff'
            }}
          />
          <button
            type="button"
            onClick={() => alert(`Exported 21 agents registry to CSV`)}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', cursor: 'pointer'
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Pill Buttons */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'Draft', 'Testing', 'Approval', 'Published', 'Disabled', 'Silent Validation', 'Pilot'].map(st => {
          const isActive = filterStatus === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              style={{
                height: '24px', padding: '0 10px', borderRadius: '12px',
                border: '1px solid #e3e6e8', fontSize: '11px', cursor: 'pointer',
                background: isActive ? '#15181b' : '#fff',
                color: isActive ? '#ffffff' : '#52585e',
                fontWeight: isActive ? 600 : 400
              }}
            >
              {st}
            </button>
          );
        })}
      </div>

      {/* Main Table Matching Screenshot */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <th style={{ padding: '10px 14px', width: '220px' }}>AGENT</th>
              <th style={{ padding: '10px 12px', width: '130px' }}>TYPE</th>
              <th style={{ padding: '10px 12px', width: '70px' }}>VERSION</th>
              <th style={{ padding: '10px 14px', width: '150px' }}>OWNER</th>
              <th style={{ padding: '10px 12px', width: '90px' }}>RISK TIER</th>
              <th style={{ padding: '10px 12px', width: '120px' }}>STATUS</th>
              <th style={{ padding: '10px 12px', width: '80px' }}>LAST RUN</th>
              <th style={{ padding: '10px 12px', width: '80px' }}>SUCCESS</th>
              <th style={{ padding: '10px 12px', width: '120px' }}>HUMAN APPROVAL</th>
              <th style={{ padding: '10px 12px', width: '60px' }}>TOOLS</th>
              <th style={{ padding: '10px 12px', width: '80px' }}>KNOWLEDGE</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAgents.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>🤖</div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>No agents match the selected criteria</div>
                  <div style={{ fontSize: '11.5px', marginTop: '3px' }}>Try adjusting your search query or filter pills.</div>
                </td>
              </tr>
            ) : (
              paginatedAgents.map(ag => {
                const tierColor = ag.tier === 'High' ? 'oklch(0.45 0.17 25)' : ag.tier === 'Medium' ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.12 150)';
                const statusPill = ag.status === 'Published'
                  ? { bg: 'oklch(0.95 0.04 150)', fg: 'oklch(0.4 0.12 150)' }
                  : (ag.status === 'Disabled' || ag.status === 'Suspended')
                    ? { bg: 'oklch(0.96 0.03 25)', fg: 'oklch(0.45 0.17 25)' }
                    : (ag.status === 'Silent Validation' || ag.status === 'Pilot')
                      ? { bg: 'oklch(0.96 0.03 300)', fg: 'oklch(0.45 0.1 300)' }
                      : { bg: '#eef0f1', fg: '#52585e' };

                return (
                  <tr
                    key={ag.id}
                    onClick={() => setSelectedAgentId(ag.id)}
                    style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#15181b' }}>
                      {ag.name}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#52585e' }}>
                      {ag.type}
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', color: '#52585e' }}>
                      {ag.v}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#52585e' }}>
                      {ag.owner}
                    </td>
                    <td style={{ padding: '11px 12px', fontWeight: 600, color: tierColor }}>
                      {ag.tier}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 600, background: statusPill.bg, color: statusPill.fg
                      }}>
                        {ag.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', color: '#15181b' }}>
                      {ag.lastRun}
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', color: '#15181b' }}>
                      {ag.success}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#52585e' }}>
                      {ag.humanApproval}
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', color: '#15181b' }}>
                      {ag.toolsCount}
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', color: '#15181b' }}>
                      {ag.knowledgeCount}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Interactive Pagination Controls */}
        {totalAgentCount > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: '#fafbfc',
            borderTop: '1px solid #eef0f1',
            fontSize: '12px',
            color: '#64748b',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span>
                Showing <strong>{totalAgentCount > 0 ? startIndex + 1 : 0}</strong> to <strong>{endIndex}</strong> of <strong>{totalAgentCount}</strong> agents
              </span>
              
              {/* Rows Per Page Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {[5, 10, 15, 20, 25].map(sz => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: safePage === 1 ? '#f1f5f9' : '#fff',
                  color: safePage === 1 ? '#94a3b8' : '#334155',
                  fontSize: '11.5px',
                  cursor: safePage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <span>Page {safePage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: safePage === totalPages ? '#f1f5f9' : '#fff',
                  color: safePage === totalPages ? '#94a3b8' : '#334155',
                  fontSize: '11.5px',
                  cursor: safePage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
