import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config, json

conn = db_config.get_db_connection()
cur = conn.cursor()

ag04_data = {
    'agent_id': 'AG-04',
    'name': 'Employee Service Agent',
    'name_ta': 'பணியாளர் சேவை முகவர்',
    'type': 'Internal Staff Chatbot',
    'version': '1.7.0',
    'owner': 'HR Operations & Clinical Directorate',
    'risk_tier': 'Low',
    'status': 'Published',
    'human_approval': 'None',
    'purpose': 'Provide 24/7 conversational assistance to hospital doctors, nurses, technicians, and staff for shift timings, duty rosters, leave & comp-off balance ledger queries, and leave filings with live PostgreSQL grounding.',
    'last_run': '10:20 AM',
    'success_rate': '98.5%',
    'runs': 842,
    'instructions': {
        'objective': 'Automate employee self-service inquiries for shift timing, duty rosters, leave balance tracking, and leave filings with 100% verified PostgreSQL roster grounding.',
        'system': 'You are the Hospital Employee Service Agent (AG-04 · பணியாளர் சேவை முகவர்). Provide conversational HR and roster assistance to hospital staff (doctors, nurses, technicians, admin). Query PostgreSQL tables (staff_rosters, employee_leave_balances, employee_leave_requests) to fetch accurate shift schedules, reconcile leave quotas (Comp-off, Casual, Sick, Earned), apply leaves, and cite authoritative hospital HR policies. Never provide clinical medical advice or diagnose patients.',
        'rules': 'Present duty shifts clearly with date, duty hours (e.g., Morning 07:00 AM - 03:00 PM), department/ward, and on-call status. Display leave balances in itemized format with available quotas. Support bilingual English and Tamil (தமிழ்) responses. Record all leave filings with timestamp and supervisor routing.',
        'safety': 'Strictly restricted to internal hospital employee operations. Refuse patient clinical queries, medication advice, or prescription modifications. Mask employee salaries and confidential HR disciplinary records. Ensure leave filings check ward nursing coverage rules.',
        'escalation': 'Escalate shift clashes, emergency leave rejections, or policy disputes to the HR Operations Head (ext. 4401) and Ward Nursing Supervisor.',
        'refusal': 'I cannot answer medical or patient-care queries. I am your Employee Service Agent for HR and duty schedules. For patient care, please use clinical copilot or consult attending physician.'
    },
    'tools': [
        {'tool': 'PostgreSQL Roster Engine', 'perm': 'Query live duty rosters, shift timings & on-call schedules from staff_rosters', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
        {'tool': 'Leave Balance Ledger', 'perm': 'Fetch employee leave balances (Casual, Sick, Comp-off, Earned)', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
        {'tool': 'Leave Filing Engine', 'perm': 'Create and submit new leave requests into employee_leave_requests', 'read': True, 'write': True, 'appr': 'Supervisor', 'enabled': True},
        {'tool': 'HR Policy v5.0 Knowledge Engine', 'perm': 'Search hospital HR policies, shift allowances & benefits', 'read': True, 'write': False, 'appr': 'None', 'enabled': True}
    ],
    'knowledge': [
        {'t': 'HR Leave & Attendance Policy v5.0', 'v': '5.0', 'eff': '01 Jan 2026', 'status': 'Published'},
        {'t': 'Nursing Shift Allowance & Roster SOP', 'v': '3.2', 'eff': '15 Mar 2026', 'status': 'Published'},
        {'t': 'Employee Health & Dependent Medical Benefit Scheme', 'v': '2.4', 'eff': '01 Jun 2026', 'status': 'Published'}
    ],
    'memory': {'session': 'On · 30 min', 'patient': 'Staff-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
    'access': {'roles': 'HR, Hospital Management, Doctors, Nurses, Technicians, Admin', 'departments': 'All Wards, ICUs, Labs, OT, Admin', 'patients': 'Staff-scoped', 'scopes': 'Operational HR read/write', 'env': 'Production'},
    'model': {'model': 'meridian-llm-large', 'temperature': 0.2, 'tokens': 8000, 'fallback': 'meridian-llm-small', 'latency': '< 1.5 s p50', 'cost': '₹4 / run'},
    'evals': [
        {'id': 'EV-704', 'ver': 'v1.7.0', 'when': 'Today 09:30', 'cases': 180, 'acc': '98.5%', 'ground': '99.2%', 'hall': '0.1%', 'ref': '100%', 'lat': '1.2s', 'res': 'Pass'},
        {'id': 'EV-650', 'ver': 'v1.6.0', 'when': '15 Sep 2026', 'cases': 120, 'acc': '95.8%', 'ground': '97.4%', 'hall': '0.3%', 'ref': '99%', 'lat': '1.4s', 'res': 'Pass'}
    ],
    'versions': [
        {'v': '1.7.0', 'ts': 'Today', 'author': 'AI Engineering', 'changes': 'Added live PostgreSQL staff_rosters sync and bilingual Tamil HR response templates', 'score': '98.5', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'},
        {'v': '1.6.0', 'ts': '21 days ago', 'author': 'HR Ops', 'changes': 'Added leave balance ledger integration', 'score': '95.8', 'state': 'Archived', 'bg': '#f1f5f9', 'fg': '#475569'}
    ],
    'managed_state': 'Configurable • Dynamic'
}

cur.execute('''
    INSERT INTO agent_configurations (
        agent_id, name, name_ta, type, version, owner, risk_tier, status,
        human_approval, purpose, instructions, tools, knowledge, memory, access,
        model, evals, versions, managed_state, last_run, success_rate, runs
    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT (agent_id) DO UPDATE SET
        name = EXCLUDED.name,
        name_ta = EXCLUDED.name_ta,
        type = EXCLUDED.type,
        version = EXCLUDED.version,
        owner = EXCLUDED.owner,
        risk_tier = EXCLUDED.risk_tier,
        status = EXCLUDED.status,
        human_approval = EXCLUDED.human_approval,
        purpose = EXCLUDED.purpose,
        instructions = EXCLUDED.instructions,
        tools = EXCLUDED.tools,
        knowledge = EXCLUDED.knowledge,
        memory = EXCLUDED.memory,
        access = EXCLUDED.access,
        model = EXCLUDED.model,
        evals = EXCLUDED.evals,
        versions = EXCLUDED.versions,
        managed_state = EXCLUDED.managed_state,
        last_run = EXCLUDED.last_run,
        success_rate = EXCLUDED.success_rate,
        runs = EXCLUDED.runs,
        updated_at = NOW();
''', (
    ag04_data['agent_id'], ag04_data['name'], ag04_data['name_ta'],
    ag04_data['type'], ag04_data['version'], ag04_data['owner'],
    ag04_data['risk_tier'], ag04_data['status'], ag04_data['human_approval'],
    ag04_data['purpose'],
    json.dumps(ag04_data['instructions']), json.dumps(ag04_data['tools']),
    json.dumps(ag04_data['knowledge']), json.dumps(ag04_data['memory']),
    json.dumps(ag04_data['access']), json.dumps(ag04_data['model']),
    json.dumps(ag04_data['evals']), json.dumps(ag04_data['versions']),
    ag04_data['managed_state'],
    ag04_data['last_run'], ag04_data['success_rate'], ag04_data['runs']
))
conn.commit()
print('AG-04 upserted into agent_configurations table successfully.')
