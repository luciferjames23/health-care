import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config, json

conn = db_config.get_db_connection()
cur = conn.cursor()

AGENTS_TO_SEED = [
    # ── AG-14  Analytics Agent ────────────────────────────────────────────────
    {
        'agent_id': 'AG-14',
        'name': 'Analytics Agent',
        'name_ta': 'மேம்பட்ட பகுப்பாய்வு முகவர்',
        'type': 'Summariser & Intelligence Agent',
        'version': '2.0.0',
        'owner': 'Hospital Management & Operations Directorate',
        'risk_tier': 'Medium',
        'status': 'Published',
        'human_approval': 'Selective',
        'purpose': 'Synthesize enterprise hospital performance metrics, bed occupancy trends, revenue cycle velocity, and clinical quality KPIs into real-time executive briefings.',
        'last_run': '11:11 AM',
        'success_rate': '97.8%',
        'runs': 580,
        'instructions': {
            'objective': 'Synthesize enterprise hospital performance metrics, bed occupancy trends, revenue cycle velocity, and clinical quality KPIs into real-time executive briefings.',
            'system': 'You are the Meridian Hospital Analytics Agent (AG-14 · மேம்பட்ட பகுப்பாய்வு முகவர்). Your role is to synthesize enterprise hospital performance data from PostgreSQL and Gold Lakehouse tables (daily census, ward bed occupancy, ALOS, revenue cycle turnaround times, OPD doctor footfall, and clinical safety incident rates). Generate executive-grade daily briefings, identify operational bottlenecks, and formulate actionable management recommendations in English and Tamil (தமிழ்).',
            'rules': 'Provide quantitative metrics with percentage trends and benchmark targets. Support dual-language English & Tamil executive summaries. Highlight operational variances exceeding +/- 10%. Include department-level drilldowns.',
            'safety': 'Strictly read-only access to operational, financial, and anonymized clinical analytics. Mask patient PHI in management summaries. Never alter source transaction logs or bill records.',
            'escalation': 'Escalate critical KPI breaches (e.g., Bed Occupancy > 92%, ER Wait Times > 90 mins, Claim Denial Rate > 8%) to Medical Director and Chief Operating Officer immediately.',
            'refusal': 'Unable to compute executive analytics: Source lakehouse tables unverified or data refresh in progress. Escalating to Data Engineering Lead.'
        },
        'tools': [
            {'tool': 'Hospital Lakehouse Gold API', 'perm': 'Query aggregated daily census, admissions, discharges & ALOS metrics', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Revenue Cycle Analytics Engine', 'perm': 'Query billing velocity, claim denial rates & cash collection KPIs', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Executive Briefing Generator', 'perm': 'Assemble daily leadership briefing cards & PDF digest', 'read': True, 'write': True, 'appr': 'None', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'Hospital Executive KPI Master Framework FY26-27', 'v': '3.2', 'eff': '01 Apr 2026', 'status': 'Published'},
            {'t': 'NABH Clinical Quality & Safety Indicator SOP', 'v': '4.0', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'Tamil Management Terminology & Executive Digest Standard', 'v': '1.5', 'eff': '15 May 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Management, Chief Medical Officer, Chief Operating Officer, Department Leads', 'departments': 'All Wards, ICUs, OPD, Finance, Operations', 'patients': 'Anonymized Aggregate Analytics', 'scopes': 'Operational + financial read (no clinical write)', 'env': 'Production'},
        'model': {'model': 'meridian-llm-large', 'temperature': 0.2, 'tokens': 8000, 'fallback': 'meridian-llm-small', 'latency': '< 2.0 s p50', 'cost': '₹8 / run'},
        'evals': [
            {'id': 'EV-714', 'ver': 'v2.0.0', 'when': 'Today 10:00', 'cases': 120, 'acc': '97.8%', 'ground': '99.0%', 'hall': '0.1%', 'ref': '100%', 'lat': '1.8s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.0.0', 'ts': 'Today', 'author': 'Operations Engineering', 'changes': 'Added Gold Lakehouse live telemetry sync and bilingual Tamil executive briefing generator', 'score': '97.8', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'},
            {'v': '1.7.0', 'ts': '21 days ago', 'author': 'Ops Product', 'changes': 'Executive KPI reporting', 'score': '93.8', 'state': 'Archived', 'bg': '#f1f5f9', 'fg': '#475569'}
        ],
        'managed_state': 'Configurable • Dynamic'
    },

    # ── AG-15  Forecasting Agent ──────────────────────────────────────────────
    {
        'agent_id': 'AG-15',
        'name': 'Forecasting Agent',
        'name_ta': 'கணிப்பு முகவர்',
        'type': 'Predictive Monitor & Planner',
        'version': '2.0.0',
        'owner': 'Hospital Operations & Bed Management',
        'risk_tier': 'Medium',
        'status': 'Published',
        'human_approval': 'Selective',
        'purpose': 'Forecast 7-day inpatient bed demand, emergency inflow surges, and ward-specific capacity bottlenecks to optimize hospital admission flow and staffing.',
        'last_run': '06:00 AM',
        'success_rate': '98.2%',
        'runs': 310,
        'instructions': {
            'objective': 'Forecast 7-day inpatient bed demand, emergency inflow surges, and ward-specific capacity bottlenecks to optimize hospital admission flow and staffing.',
            'system': 'You are the Meridian Hospital Forecasting Agent (AG-15 · கணிப்பு முகவர்). Your role is to compute 7-day rolling inpatient census projections, predictive emergency/elective bed demand forecasts, and ward unit occupancy trends using PostgreSQL Gold tables (fact_bed_demand_forecast_7day_detailed) and historical admission patterns. Provide early warning alerts for impending ICU/HDU bed shortages and recommend proactive patient transfers and staffing reallocations.',
            'rules': 'Generate 7-day rolling horizon projections categorized by ward (Cardiology, ICU, General, Maternity, Pediatric). Provide predicted occupancy percentages and confidence intervals. Flag predicted surge dates.',
            'safety': 'Forecast models serve as decision support only. Do not autonomously reject emergency admissions or alter bed allocation without Bed Manager / Triage Physician approval.',
            'escalation': 'Trigger High-Alert Surge Notification to Hospital Incident Commander and Ward Nursing Lead when forecasted bed occupancy exceeds 90% within 48 hours.',
            'refusal': 'Historical admission variance too high or census telemetry unavailable to generate reliable 7-day forecast. Escalating to Bed Management Desk.'
        },
        'tools': [
            {'tool': 'fact_bed_demand_forecast_7day_detailed Engine', 'perm': 'Query 7-day predictive bed demand, emergency vs elective admissions & occupancy rates', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Bed Capacity & Surge Modeler', 'perm': 'Simulate ward capacity headroom and calculate bed crunch probabilities', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Staffing Alignment Bus', 'perm': 'Push nurse-to-patient ratio recommendations to staff_rosters engine', 'read': True, 'write': True, 'appr': 'Nursing Supervisor', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'Hospital Bed Surge Management & Capacity Planning Protocol', 'v': '4.1', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'Emergency Inflow Forecasting & Seasonal Surge Standard', 'v': '2.8', 'eff': '15 Mar 2026', 'status': 'Published'},
            {'t': 'Inpatient Discharge & Turnaround SOP v3.1', 'v': '3.1', 'eff': '01 Jul 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Operations, Bed Management, Nursing Leadership, Emergency Dept Triage', 'departments': 'All Inpatient Wards, ICUs, Emergency, OT', 'patients': 'Aggregated Ward Cohorts', 'scopes': 'Operational predictive read/write', 'env': 'Production'},
        'model': {'model': 'meridian-llm-large', 'temperature': 0.1, 'tokens': 8000, 'fallback': 'Clinical Census Predictor', 'latency': '< 1.5 s p50', 'cost': '₹6 / run'},
        'evals': [
            {'id': 'EV-715', 'ver': 'v2.0.0', 'when': 'Today 06:00', 'cases': 100, 'acc': '98.2%', 'ground': '99.4%', 'hall': '0.0%', 'ref': '100%', 'lat': '1.3s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.0.0', 'ts': 'Today', 'author': 'Operations Engineering', 'changes': 'Integrated fact_bed_demand_forecast_7day_detailed 7-day rolling surge predictor', 'score': '98.2', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'},
            {'v': '1.0.6', 'ts': '30 days ago', 'author': 'Operations', 'changes': 'Initial bed demand forecasting model', 'score': '91.4', 'state': 'Archived', 'bg': '#f1f5f9', 'fg': '#475569'}
        ],
        'managed_state': 'Configurable • Dynamic'
    }
]

for ag in AGENTS_TO_SEED:
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
        ag['agent_id'], ag['name'], ag['name_ta'],
        ag['type'], ag['version'], ag['owner'],
        ag['risk_tier'], ag['status'], ag['human_approval'],
        ag['purpose'],
        json.dumps(ag['instructions']), json.dumps(ag['tools']),
        json.dumps(ag['knowledge']), json.dumps(ag['memory']),
        json.dumps(ag['access']), json.dumps(ag['model']),
        json.dumps(ag['evals']), json.dumps(ag['versions']),
        ag['managed_state'],
        ag['last_run'], ag['success_rate'], ag['runs']
    ))
    print(f"Upserted {ag['agent_id']} ({ag['name']}) successfully.")

conn.commit()
cur.close()
conn.close()
print("AG-14 and AG-15 successfully seeded into database.")
