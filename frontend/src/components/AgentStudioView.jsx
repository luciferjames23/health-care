import React, { useState } from 'react';

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
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 4,
    purpose: 'Handles omnichannel appointment requests, slot matching, reminders, and automated no-show rescheduling via WhatsApp and Web.',
    instructions: {
      role: 'You are the Appointment Booking Agent for Hospital Operating Platform.',
      goal: 'Find available doctor slots, confirm patient identity, verify insurance empanelment, and send bilingual confirmation.',
      safety: 'Never provide medical triage advice; route emergency symptoms immediately to Emergency triage.',
      routing: 'Read consultant schedule -> Check doctor leave master -> Issue queue token -> Send WhatsApp in Tamil/English.',
      escalation: 'If patient requests a slot with a doctor whose OP is full, route to Front Desk Supervisor with priority flag.',
      language: 'Deliver in Tamil for Tamil-preferred UHID; English default for others.'
    },
    tools: [
      { tool: 'Patient Search', perm: 'Read UHID & Demographics', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Appointment API', perm: 'Create / Reschedule Bookings', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'Consultant Schedules', perm: 'Read OPD Slots & Leave', read: true, write: false, appr: 'None', enabled: true },
    ],
    knowledge: [
      { t: 'OPD Consultation Schedule FY26-27', v: '2.1', eff: '01 Apr 2026', status: 'Published' },
      { t: 'Patient Registration & Identity SOP', v: '3.0', eff: '15 Jan 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 6,
    knowledgeCount: 5,
    purpose: 'Answers patient queries regarding visiting hours, parking, tariff estimates, insurance cashless rules, and hospital facilities.',
    instructions: {
      role: 'You are the Patient Access Agent.',
      goal: 'Provide compassionate, grounded answers to patient & family queries with strict knowledge citations.',
      safety: 'Mask clinical diagnostic data; refuse requests seeking clinical interpretation of test results.',
      routing: 'Intent detection -> RAG retrieval -> Policy verification -> Bilingual output formatting.',
      escalation: 'If query confidence < 70%, refuse politely and route to Front Office Executive.',
      language: 'Tamil and English bilingual responses.'
    },
    tools: [
      { tool: 'Knowledge Base Gateway', perm: 'Retrieve Governed SOPs', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Patient Portal API', perm: 'Verify Patient Context', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Visiting Hours & Attendant Policy', v: '2.0', eff: '01 Jun 2026', status: 'Published' },
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 8,
    knowledgeCount: 5,
    purpose: 'Digital pre-registration via WhatsApp / Web, collecting KYC documents, ABHA ID verification, and preliminary consent.',
    instructions: {
      role: 'You are the Pre-registration Agent.',
      goal: 'Capture demographic information, generate temporary UHID token, and verify insurance card OCR.',
      safety: 'Do not collect credit card numbers or biometric secrets over chat channels.',
      routing: 'Capture form data -> OCR Insurance card -> Create provisional master patient index record.',
      escalation: 'Duplicate UHID match flags Front Office supervisor.',
      language: 'Tamil, English, Hindi.'
    },
    tools: [
      { tool: 'Master Patient Index', perm: 'Create / Match UHID', read: true, write: true, appr: 'None', enabled: true },
      { tool: 'ABHA Gateway', perm: 'Verify Ayushman Bharat Health ID', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Patient Registration & Identity SOP', v: '3.0', eff: '15 Jan 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 6,
    knowledgeCount: 6,
    purpose: 'Answers employee HR policy questions (leave balance, night shift allowance, payroll dates, benefits) with citations.',
    instructions: {
      role: 'You are the Employee Service Agent.',
      goal: 'Answer staff HR policy questions strictly from HR Leave Policy v5.0 and Payroll FAQ.',
      safety: 'Do not disclose peer salaries or private personnel disciplinary records.',
      routing: 'HR query -> RAG lookup in HR knowledge -> Fetch employee leave balance -> Answer.',
      escalation: 'Complex salary dispute routes to HR Manager.',
      language: 'English, Tamil.'
    },
    tools: [
      { tool: 'HRMS Gateway', perm: 'Read Employee Leave Balance', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'HR Leave Policy', v: '5.0', eff: '01 Jan 2026', status: 'Published' }
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
    humanApproval: 'Selective',
    toolsCount: 4,
    knowledgeCount: 3,
    purpose: 'Classifies patient feedback, detects negative sentiment, and routes complaints to service recovery owners with SLA timers.',
    instructions: {
      role: 'You are the Feedback & Service Recovery Agent.',
      goal: 'Parse incoming patient surveys, classify complaint category, assess sentiment urgency, and draft recovery responses.',
      safety: 'Sensitive clinical grievances must be resolved by a human Quality Manager; agent only drafts acknowledgement.',
      routing: 'Survey event -> Sentiment classification -> SLA timer creation -> Notify Department Head.',
      escalation: 'Frustrated patient sentiment with SLA > 30m breaches trigger immediate phone call alert.',
      language: 'Tamil and English.'
    },
    tools: [
      { tool: 'Feedback System', perm: 'Log Grievance & SLA', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 4,
    knowledgeCount: 3,
    purpose: 'Tracks OPD check-ins, consultation wait times, token calling displays, and detects bottleneck delays across specialties.',
    instructions: {
      role: 'You are the Queue & Patient Flow Agent.',
      goal: 'Optimize consultation queue sequencing, update waiting display tokens, and notify patients of live queue position.',
      safety: 'Do not reorder emergency patients; emergency triage acuity always overrides routine queue order.',
      routing: 'Check-in event -> Calculate doctor consultation velocity -> Push estimated turn time.',
      escalation: 'OP wait > 30 min triggers notification to Front Desk Executive.',
      language: 'Display boards & WhatsApp SMS.'
    },
    tools: [
      { tool: 'Queue Management Engine', perm: 'Update Token Queues', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'OPD Consultation Schedule FY26-27', v: '2.1', eff: '01 Apr 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 4,
    knowledgeCount: 2,
    purpose: 'Assembles cashless preauthorisation bundles from EMR notes, estimates, and diagnostic proofs with denial-risk scoring.',
    instructions: {
      role: 'You are the Insurance Preauthorisation Assembly Agent.',
      goal: 'Assemble preauth submission packets for TPA submission with ICD-10 coding and missing document detection.',
      safety: 'Mandatory human approval: Preauth bundles must be reviewed and submitted by the Insurance Executive.',
      routing: 'Admission detected -> Check insurer checklist -> Score denial risk -> Submit to Approval Centre.',
      escalation: 'Denial risk > 25% flags Insurance Supervisor.',
      language: 'English.'
    },
    tools: [
      { tool: 'EMR Gateway', perm: 'Read Clinical History', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Insurance TPA Portal', perm: 'Draft Preauth Submission', read: true, write: true, appr: 'Insurance Exec', enabled: true }
    ],
    knowledge: [
      { t: 'Insurance Preauthorisation SOP', v: '2.4', eff: '15 Aug 2026', status: 'Published' },
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 7,
    knowledgeCount: 3,
    purpose: 'Drafts plain-language explanations for estimate-to-actual bill variances, itemized consumables, and TPA co-pay details.',
    instructions: {
      role: 'You are the Billing Transparency Agent.',
      goal: 'Explain bill items and variances in plain language using Tariff FY26-27 rules.',
      safety: 'All billing dispute waivers and credit note requests require Finance Manager approval.',
      routing: 'Provisional bill generated -> Detect variance > 5% -> Draft plain explanation.',
      escalation: 'Variance > 10% requires mandatory in-person billing counselling.',
      language: 'English, Tamil.'
    },
    tools: [
      { tool: 'Billing Engine', perm: 'Read Itemized Charges', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' },
      { t: 'Estimate Counselling SOP', v: '2.0', eff: '01 Apr 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 9,
    knowledgeCount: 5,
    purpose: 'Coordinates multi-department dependency graphs (summary, pharmacy, billing, TPA settlement, nursing teaching) and predicts ready time.',
    instructions: {
      role: 'You are the Discharge Orchestration Agent.',
      goal: 'Maintain the critical path DAG for all inpatient discharges from doctor intent to bed release, dynamically adjusting ETA.',
      safety: 'Never bypass doctor summary sign-off or final billing clearance. Patient cannot be released if clinical hold is active.',
      routing: 'Doctor intent -> Dispatch parallel tasks to Pharmacy, Billing, TPA -> Update live board -> Trigger Housekeeping.',
      escalation: 'Dependency stalled > 45m beyond SLA notifies Operations Head.',
      language: 'Bilingual ETA broadcasts.'
    },
    tools: [
      { tool: 'EMR Gateway', perm: 'Read Clinical Status', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Pharmacy Gateway', perm: 'Read Dispense State', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Billing Engine', perm: 'Read Clearance State', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Housekeeping API', perm: 'Schedule Bed Cleaning', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
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
    humanApproval: 'Selective',
    toolsCount: 6,
    knowledgeCount: 1,
    purpose: 'Coordinates diagnostic preparation and fasting instructions, groups pending lab/imaging tests, and alerts critical values.',
    instructions: {
      role: 'You are the Diagnostic Coordination Agent.',
      goal: 'Group pending investigations, send patient fasting instructions, track sample TAT, and notify critical values.',
      safety: 'Critical laboratory values require treating clinician acknowledgement within 15 minutes; timer escalation is mandatory.',
      routing: 'LIS/RIS Event -> Match test instructions -> Push to ward/patient -> Monitor timers.',
      escalation: 'Unacknowledged critical value after 15m escalates to Department Head.',
      language: 'Tamil/English.'
    },
    tools: [
      { tool: 'LIS Gateway', perm: 'Read Lab Results', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'Notification Engine', perm: 'Push Critical Alerts', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Critical Value Policy', v: '1.4', eff: '15 Aug 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 7,
    knowledgeCount: 5,
    purpose: 'Automates post-discharge check-in calls and WhatsApp messages, screening for recovery warning signs and booking OPD reviews.',
    instructions: {
      role: 'You are the Post-Discharge Follow-up Agent.',
      goal: 'Check on patient recovery, monitor surgical wound status, and confirm follow-up consultation date.',
      safety: 'Any reported chest pain, fever > 101F, or severe bleeding immediately triggers triage callback.',
      routing: 'Discharge event + 48h -> Trigger bilingual WhatsApp survey -> Record recovery response.',
      escalation: 'Red-flag symptom routes to Ward Duty Doctor.',
      language: 'Tamil, English.'
    },
    tools: [
      { tool: 'Messaging Gateway', perm: 'Send WhatsApp Polls', read: false, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 4,
    knowledgeCount: 4,
    purpose: 'Real-time call transcription, caller intent detection, sentiment monitoring, and agent-assist copilot suggestions during live calls.',
    instructions: {
      role: 'You are the Contact Centre Telephony Copilot.',
      goal: 'Transcribe caller speech, retrieve relevant patient record context, and suggest answers to the human agent.',
      safety: 'Human agent remains on the line; AI operates in assist mode only.',
      routing: 'Audio stream -> Transcribe -> RAG retrieval -> Suggest response to operator.',
      escalation: 'Frustrated caller sentiment triggers service recovery ticket.',
      language: 'Tamil, English, Hindi.'
    },
    tools: [
      { tool: 'Telephony Engine', perm: 'Stream Audio & Transcribe', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Tariff Schedule FY26-27', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 3,
    knowledgeCount: 5,
    purpose: 'Simulates clinical and operational interactive training scenarios, quizzes staff on safe AI use, and scores competency.',
    instructions: {
      role: 'You are the AI Trainer Agent.',
      goal: 'Conduct role-based competency quizzes and interactive role-play scenarios for clinical and billing staff.',
      safety: 'Clearly demarcate all simulated clinical cases from real patient records.',
      routing: 'Select module -> Run scenario -> Grade response -> Submit for supervisor sign-off.',
      escalation: 'Quiz score < 80% triggers remedial review module.',
      language: 'English.'
    },
    tools: [
      { tool: 'LMS Platform', perm: 'Record Training Scores', read: true, write: true, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Patient Rights Charter', v: '1.0', eff: '01 Feb 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 5,
    knowledgeCount: 4,
    purpose: 'Generates scheduled executive operational summaries, discharge turnaround metrics, and revenue leak analyses.',
    instructions: {
      role: 'You are the Management Analytics Agent.',
      goal: 'Synthesize Lakehouse Gold data into concise daily operations briefings and KPI variance reports.',
      safety: 'Mask patient-level identifiable health information (PHI) in aggregate management reports.',
      routing: 'Query Gold Layer -> Aggregate department metrics -> Format executive briefing.',
      escalation: 'Negative metric trend > 10% highlights alert for COO.',
      language: 'Executive English.'
    },
    tools: [
      { tool: 'Databricks Lakehouse', perm: 'Query Gold Tables', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 4,
    knowledgeCount: 3,
    purpose: 'Predicts bed demand, emergency load, nurse-to-patient staffing requirements, and pharmacy inventory stock-out risks.',
    instructions: {
      role: 'You are the Hospital Forecasting Agent.',
      goal: 'Generate hourly predictive load forecasts for ICU, General Ward, and Staff Roster allocation.',
      safety: 'All staffing and roster modifications require Hospital Management sign-off.',
      routing: 'Aggregate Gold Data -> Run forecasting models -> Draft roster modifications.',
      escalation: 'Predicted bed occupancy > 92% triggers amber capacity alert.',
      language: 'Executive English.'
    },
    tools: [
      { tool: 'Databricks Lakehouse', perm: 'Read Historical Census', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
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
    humanApproval: 'Selective',
    toolsCount: 5,
    knowledgeCount: 2,
    purpose: 'Screens incoming DICOM imaging studies in silent validation mode to flag high-probability acute findings for prioritized radiologist review.',
    instructions: {
      role: 'You are the Radiology Screening & Prioritization Agent.',
      goal: 'Evaluate CT, MRI, and X-ray studies in silent mode to prioritize urgent acute cases on the radiologist worklist.',
      safety: 'AI SCREENING ONLY: AI output does not constitute a diagnosis. The radiologist remains the sole final decision-maker.',
      routing: 'DICOM study received -> Run vision model -> Flag priority tag on PACS worklist.',
      escalation: 'Suspected intracranial hemorrhage or pneumothorax flags STAT priority.',
      language: 'Radiology DICOM tags.'
    },
    tools: [
      { tool: 'PACS / RIS Gateway', perm: 'Read DICOM Metadata & Pixels', read: true, write: true, appr: 'Radiologist', enabled: true }
    ],
    knowledge: [
      { t: 'Diagnostic Preparation Guide', v: '1.8', eff: '10 May 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 4,
    knowledgeCount: 3,
    purpose: 'Transcribes doctor conversational dictations in Tamil and English into structured SOAP clinical notes.',
    instructions: {
      role: 'You are the Clinical Voice Documentation Agent.',
      goal: 'Transcribe ambient physician dictations into Subjective, Objective, Assessment, and Plan (SOAP) clinical note structures.',
      safety: 'Doctor must review, edit, and electronically sign the note before it commits to the permanent medical record.',
      routing: 'Receive audio -> Transcribe medical entities -> Structure SOAP format -> Post to Doctor Workspace.',
      escalation: 'Unrecognized drug name flags for physician clarification.',
      language: 'Tamil and English.'
    },
    tools: [
      { tool: 'Voice Processing Gateway', perm: 'Transcribe Medical Audio', read: true, write: false, appr: 'None', enabled: true },
      { tool: 'EMR Gateway', perm: 'Draft SOAP Note', read: true, write: true, appr: 'Doctor Sign-off', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Clinical Documentation Standards', v: '5.0', eff: '01 Jan 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 5,
    knowledgeCount: 4,
    purpose: 'Synthesizes shift vitals, MAR high-alert medications, pending diagnostics, and clinical alerts into structured SBAR handovers.',
    instructions: {
      role: 'You are the Nursing Handover SBAR Agent.',
      goal: 'Synthesize shift vitals, high-alert medication administrations, pending diagnostics, and clinical risks into structured SBAR summaries.',
      safety: 'Draft only: Outgoing and incoming charge nurses must review, verify, and sign off the handover.',
      routing: 'Fetch shift MAR + vitals -> Formulate SBAR -> Queue for nurse electronic sign-off.',
      escalation: 'Unadministered high-alert medication triggers high-visibility warning in handover summary.',
      language: 'Clinical English.'
    },
    tools: [
      { tool: 'Nursing MAR System', perm: 'Read Medication Logs', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Medication Safety — High-alert drugs', v: '4.0', eff: '15 Aug 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 6,
    knowledgeCount: 4,
    purpose: 'Drafts comprehensive clinical discharge summaries from admission SOAP notes, surgical logs, lab results, and final medication plans.',
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
      { tool: 'Document Generator', perm: 'Draft Discharge Summary PDF', read: true, write: true, appr: 'Doctor Sign-off', enabled: true }
    ],
    knowledge: [
      { t: 'NABH Clinical Documentation Standards', v: '5.0', eff: '01 Jan 2026', status: 'Published' }
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
    humanApproval: 'Required',
    toolsCount: 5,
    knowledgeCount: 3,
    purpose: 'Analyzes insurer claim queries and denial letters, cross-references clinical justification in EMR, and drafts evidence-backed appeals.',
    instructions: {
      role: 'You are the Claim Denial & Appeal Agent.',
      goal: 'Parse insurer shortfall/denial rationale, retrieve matching clinical notes and lab proofs, and assemble structured appeal letters.',
      safety: 'All appeals require review and electronic submission by the Insurance Executive.',
      routing: 'Insurer query detected -> Extract clause citation -> Match EMR proof -> Draft appeal letter -> Submit to Approval Queue.',
      escalation: 'Shortfall > ₹50,000 escalates to Finance Manager.',
      language: 'Legal & Insurance Formal English.'
    },
    tools: [
      { tool: 'Insurance TPA Gateway', perm: 'Read Denial Letters', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Insurance Claims Procedure', v: '1.3', eff: '01 Apr 2026', status: 'Published' }
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
    humanApproval: 'None',
    toolsCount: 4,
    knowledgeCount: 6,
    purpose: 'Answers executive queries on hospital census, revenue leakages, discharge bottlenecks, and clinician productivity with Lakehouse citations.',
    instructions: {
      role: 'You are the Hospital Management Copilot.',
      goal: 'Answer strategic, operational, and financial queries using Databricks Gold Layer analytics with full source citations.',
      safety: 'Mask patient-level identifiable health information (PHI); aggregate only across departments unless authorized.',
      routing: 'Receive natural language prompt -> Query Databricks SQL Sandbox / Gold Views -> Compute metrics -> Format executive briefing.',
      escalation: 'Sensitive financial variance > 15% includes reminder to consult Chief Financial Officer.',
      language: 'Executive English.'
    },
    tools: [
      { tool: 'Databricks Gold Layer', perm: 'Query Aggregated Analytics', read: true, write: false, appr: 'None', enabled: true }
    ],
    knowledge: [
      { t: 'Inpatient Discharge SOP', v: '3.1', eff: '01 Jul 2026', status: 'Published' }
    ]
  }
];

export const AGENTS_DATA = ALL_21_AGENTS.map((a, idx) => ({
  ...a,
  runs: a.runs !== undefined ? a.runs : (42 + (idx * 7) % 180)
}));

export default function AgentStudioView({ onNavigate }) {
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [activeTab, setActiveTab] = useState('Identity');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQ, setSearchQ] = useState('');

  // Playground state
  const [playPrompt, setPlayPrompt] = useState('Draft discharge summary for patient Murugan Selvam (CABG triple vessel)');
  const [playRunning, setPlayRunning] = useState(false);
  const [playResult, setPlayResult] = useState(null);

  const selectedAgent = ALL_21_AGENTS.find(a => a.id === selectedAgentId);

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

  const handleRunPlayground = (e) => {
    if (e) e.preventDefault();
    setPlayRunning(true);
    setPlayResult(null);
    setTimeout(() => {
      setPlayRunning(false);
      setPlayResult({
        status: 'Completed · 1 Human Gate Pending',
        latency: '1.42 s',
        tokens: '1,240 tokens',
        cost: '₹0.38',
        steps: [
          { t: '11:21:02', k: 'TOOL', what: 'Query EMR: Retrieved surgical log, pre-op labs, post-op telemetry for Murugan Selvam (MER-2026-007733)' },
          { t: '11:21:03', k: 'POLICY', what: '12 Governance Checks Passed: PHI verified, care-team scope authorized, citations required' },
          { t: '11:21:03', k: 'AI', what: 'Drafting structured summary: Diagnosis, surgical course, ICU stay, vitals stability, discharge medications' },
          { t: '11:21:04', k: 'HUMAN', what: 'High-risk gate: Draft queued in Human Approval Centre (AP-0005) for Dr. Priya Venkatesh sign-off' }
        ],
        output: `CLINICAL DISCHARGE SUMMARY DRAFT (PRE-SIGN-OFF)
Patient: Murugan Selvam (UHID: MER-2026-007733) | Age: 58 | Gender: Male
Attending Surgeon: Dr. Priya Venkatesh, Senior Cardiothoracic Surgeon
Admission Date: 08 Sep 2026 | Discharge Intent: 15 Sep 2026

PRIMARY DIAGNOSIS: Severe Triple Vessel Coronary Artery Disease (CAD) (ICD-10: I25.10)
PROCEDURE PERFORMED: Coronary Artery Bypass Grafting (CABG) x3 (LIMA-LAD, SVG-OM, SVG-RCA) on CPB (09 Sep 2026)`
      });
    }, 800);
  };

  const TABS = ['Identity', 'Instructions', 'Knowledge', 'Tools', 'Memory', 'Access', 'Model', 'Playground', 'Evaluate', 'Publish & Versions'];

  // IF AN AGENT IS SELECTED, RENDER AGENT BUILDER STUDIO WORKSPACE
  if (selectedAgent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Top Breadcrumb Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: '11.5px', color: '#8a9096', marginBottom: '4px' }}>
              <span onClick={() => setSelectedAgentId(null)} style={{ cursor: 'pointer', color: 'oklch(0.4 0.1 200)', fontWeight: 600 }}>← Back</span>
              {' '}·{' '}
              <span onClick={() => onNavigate('command')} style={{ cursor: 'pointer' }}>Command Centre</span> › <span onClick={() => setSelectedAgentId(null)} style={{ cursor: 'pointer' }}>Agents</span> › <strong style={{ color: '#15181b' }}>{selectedAgent.name}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAgentId(null)}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '11.5px', cursor: 'pointer'
            }}
          >
            ← Back to Agents List
          </button>
        </div>

        {/* Builder Studio Header */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 18px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '20px', fontWeight: 700 }}>{selectedAgent.name}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                  background: selectedAgent.status === 'Published' ? 'oklch(0.95 0.04 150)' : selectedAgent.status === 'Disabled' || selectedAgent.status === 'Suspended' ? 'oklch(0.96 0.03 25)' : 'oklch(0.96 0.03 300)',
                  color: selectedAgent.status === 'Published' ? 'oklch(0.4 0.12 150)' : selectedAgent.status === 'Disabled' || selectedAgent.status === 'Suspended' ? 'oklch(0.45 0.17 25)' : 'oklch(0.45 0.1 300)'
                }}>
                  {selectedAgent.status}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#eef0f1', color: '#15181b', fontFamily: 'monospace' }}>
                  v{selectedAgent.v}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: selectedAgent.tier === 'High' ? 'oklch(0.45 0.17 25)' : selectedAgent.tier === 'Medium' ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.12 150)'
                }}>
                  Risk tier {selectedAgent.tier}
                </span>
              </div>
              <div style={{ color: '#8a9096', fontSize: '12px', marginTop: '4px' }}>
                {selectedAgent.id} · Owner: {selectedAgent.owner} · Approval: {selectedAgent.humanApproval} · Success: {selectedAgent.success}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => alert(`Saved draft of ${selectedAgent.name}`)}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', cursor: 'pointer' }}
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Playground')}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', cursor: 'pointer' }}
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Evaluate')}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', cursor: 'pointer' }}
              >
                Evaluate
              </button>
              <button
                type="button"
                onClick={() => alert(`Published version ${selectedAgent.v} to Production!`)}
                style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Publish
              </button>
            </div>
          </div>

          {/* Builder Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '14px', borderTop: '1px solid #f2f3f4', paddingTop: '4px' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 12px', border: 0, background: 'transparent',
                    cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'oklch(0.4 0.1 200)' : '#52585e',
                    borderBottom: isActive ? '2px solid oklch(0.5 0.1 200)' : '2px solid transparent'
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Panes */}
        {activeTab === 'Identity' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '960px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Name (EN)</label>
                <input type="text" defaultValue={selectedAgent.name} style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Name (TA)</label>
                <input type="text" defaultValue={selectedAgent.nameTa || 'முகவர்'} style={{ width: '100%', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '12px', boxSizing: 'border-box' }} />
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

        {activeTab === 'Instructions' && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '960px' }}>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Role & System Persona</label>
              <textarea defaultValue={selectedAgent.instructions?.role || `You are the ${selectedAgent.name}.`} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: '#8a9096', display: 'block', marginBottom: '4px' }}>Goal & Task Description</label>
              <textarea defaultValue={selectedAgent.instructions?.goal || selectedAgent.purpose} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', color: 'oklch(0.45 0.17 25)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Clinical Safety Boundaries</label>
              <textarea defaultValue={selectedAgent.instructions?.safety || 'Strict safety rules applied.'} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid oklch(0.85 0.08 25)', background: 'oklch(0.99 0.01 25)', fontFamily: 'monospace', fontSize: '11.5px', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {activeTab === 'Playground' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Test input</div>
              <form onSubmit={handleRunPlayground} style={{ display: 'flex', gap: '6px' }}>
                <input value={playPrompt} onChange={e => setPlayPrompt(e.target.value)} style={{ flex: 1, height: '32px', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 10px', fontSize: '12px' }} />
                <button type="submit" style={{ height: '32px', padding: '0 12px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
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
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Execution summary · EXE-2026-118204</span>
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

        {!['Identity', 'Instructions', 'Playground'].includes(activeTab) && (
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{activeTab} Settings</div>
            <div style={{ color: '#52585e', fontSize: '12px' }}>Enterprise configuration verified under AI Governance standards.</div>
          </div>
        )}
      </div>
    );
  }

  // DEFAULT VIEW: THE EXACT AGENTS REGISTRY TABLE FROM THE SCREENSHOT
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* Breadcrumb Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '2px' }}>
            <span onClick={() => onNavigate('command')} style={{ cursor: 'pointer', color: 'oklch(0.4 0.1 200)' }}>← Back</span>
            {' '}·{' '}
            <span>Command Centre</span> › <span>Agents</span>
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
            {filteredAgents.map(ag => {
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
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
