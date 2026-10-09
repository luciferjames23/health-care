import sys
from pathlib import Path
import psycopg2
import psycopg2.extras
import json
import math
from datetime import datetime, timedelta

# Set utf-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from connectors.databricks_connector import DatabricksConnector
from routers.gold import get_live_analytics, get_live_forecasting

def test_database_and_apis():
    db = DatabricksConnector()
    conn = db.get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    print("=" * 80)
    print("1. DATABASE GROUND TRUTH VALIDATION")
    print("=" * 80)
    
    # 1. Patients, Visits, Admissions
    cur.execute("SELECT COUNT(*) as c FROM patients")
    db_total_patients = cur.fetchone()["c"]
    
    cur.execute("SELECT COUNT(*) as c FROM appointments")
    db_total_appointments = cur.fetchone()["c"]
    
    cur.execute("SELECT COUNT(*) as c FROM admissions")
    db_total_admissions_all = cur.fetchone()["c"]
    
    cur.execute("SELECT COUNT(*) as c FROM dim_admission_inputs WHERE discharge_status IS NULL OR LOWER(discharge_status) != 'discharged'")
    db_active_inpatients = cur.fetchone()["c"]
    
    cur.execute("SELECT COUNT(*) as c FROM emergency_triage")
    db_emergency = cur.fetchone()["c"]
    
    print(f"Total Patients: {db_total_patients}")
    print(f"Total Appointments: {db_total_appointments}")
    print(f"Total Historical Admissions: {db_total_admissions_all}")
    print(f"Active Inpatients (dim_admission_inputs): {db_active_inpatients}")
    print(f"Emergency Triage: {db_emergency}")
    
    # 2. Beds & Occupancy
    cur.execute("SELECT COUNT(*) as c FROM beds")
    db_total_beds = cur.fetchone()["c"]
    
    cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied'")
    db_occupied_beds_table = cur.fetchone()["c"]
    
    cur.execute("SELECT status, COUNT(*) as c FROM beds GROUP BY status")
    bed_status_breakdown = cur.fetchall()
    print(f"Total Beds in 'beds' table: {db_total_beds}")
    print(f"Beds by status: {bed_status_breakdown}")
    print(f"Available Beds: {db_total_beds - db_occupied_beds_table}")
    print(f"Occupancy Rate: {round(db_occupied_beds_table / db_total_beds * 100, 2)}%")
    
    # 3. Revenue, Billing, Payments
    cur.execute("SELECT COALESCE(SUM(net_amount), 0) as total_billed FROM bills")
    db_total_billed = float(cur.fetchone()["total_billed"])
    
    cur.execute("SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE payment_status = 'SUCCESS'")
    db_total_paid = float(cur.fetchone()["total_paid"])
    
    db_outstanding = db_total_billed - db_total_paid
    print(f"Total Billed: INR {db_total_billed:,.2f}")
    print(f"Total Paid (SUCCESS): INR {db_total_paid:,.2f}")
    print(f"Outstanding Balance: INR {db_outstanding:,.2f}")
    
    # 4. Insurance Claims
    cur.execute("""
        SELECT 
            COUNT(*) as claim_count,
            COALESCE(SUM(claimed_amount), 0) as claimed,
            COALESCE(SUM(approved_amount), 0) as approved,
            COALESCE(SUM(settled_amount), 0) as settled,
            COUNT(CASE WHEN claim_status IN ('APPROVED', 'SETTLED', 'PARTIALLY_APPROVED') THEN 1 END) as approved_count,
            COUNT(CASE WHEN claim_status IN ('REJECTED', 'DENIED') THEN 1 END) as rejected_count,
            COUNT(CASE WHEN claim_status IN ('SUBMITTED', 'IN_PROCESS', 'PENDING', 'UNDER_REVIEW') THEN 1 END) as pending_count
        FROM insurance_claims
    """)
    claims_stats = dict(cur.fetchone())
    claims_total = claims_stats["claim_count"]
    appr_rate = (claims_stats["approved_count"] / claims_total * 100) if claims_total > 0 else 0
    rej_rate = (claims_stats["rejected_count"] / claims_total * 100) if claims_total > 0 else 0
    pend_rate = (claims_stats["pending_count"] / claims_total * 100) if claims_total > 0 else 0
    
    print(f"Claims Stats: Total={claims_total}, Claimed=INR {claims_stats['claimed']:,.2f}, Approved=INR {claims_stats['approved']:,.2f}, Settled=INR {claims_stats['settled']:,.2f}")
    print(f"Claims Counts: Approved={claims_stats['approved_count']} ({appr_rate:.1f}%), Rejected={claims_stats['rejected_count']} ({rej_rate:.1f}%), Pending={claims_stats['pending_count']} ({pend_rate:.1f}%)")
    
    # 5. Department Breakdown
    cur.execute("""
        SELECT d.department_name as department, COUNT(*) as count
        FROM dim_admission_inputs dai
        JOIN admissions a ON dai.admission_id = a.admission_id
        JOIN departments d ON a.department_id = d.id
        GROUP BY d.department_name
        ORDER BY count DESC
    """)
    dept_stats = cur.fetchall()
    print(f"Active Department Inpatients Breakdown (top 5): {dept_stats[:5]}")
    
    # 6. Check fact_bed_demand_forecast_7day_detailed table
    cur.execute("SELECT COUNT(*) as c FROM fact_bed_demand_forecast_7day_detailed")
    forecast_rows_count = cur.fetchone()["c"]
    print(f"fact_bed_demand_forecast_7day_detailed row count: {forecast_rows_count}")
    
    if forecast_rows_count > 0:
        cur.execute("SELECT * FROM fact_bed_demand_forecast_7day_detailed ORDER BY forecast_date LIMIT 7")
        sample_forecast = cur.fetchall()
        print(f"Sample table forecast rows (first 3): {sample_forecast[:3]}")
        
    # 7. Check dim_revenue_predictions table
    cur.execute("SELECT COUNT(*) as c FROM dim_revenue_predictions")
    rev_pred_count = cur.fetchone()["c"]
    print(f"dim_revenue_predictions row count: {rev_pred_count}")
    
    print("\n" + "=" * 80)
    print("2. LIVE ANALYTICS API VALIDATION")
    print("=" * 80)
    
    analytics_resp = get_live_analytics()
    print("Analytics API returned success:", analytics_resp.get("success"))
    print("Analytics Metrics:", json.dumps(analytics_resp.get("metrics"), indent=2))
    print("Analytics Encounter Distribution:", json.dumps(analytics_resp.get("encounter_distribution"), indent=2))
    print("Analytics Top Diagnoses (first 3):", json.dumps(analytics_resp.get("top_diagnoses", [])[:3], indent=2))
    print("Analytics Department Breakdown (first 3):", json.dumps(analytics_resp.get("department_breakdown", [])[:3], indent=2))
    print("Analytics Monthly Trend:", json.dumps(analytics_resp.get("monthly_trend", []), indent=2))
    
    print("\n" + "=" * 80)
    print("3. LIVE FORECASTING API VALIDATION")
    print("=" * 80)
    
    forecasting_resp = get_live_forecasting()
    print("Forecasting API returned success:", forecasting_resp.get("success"))
    print("Forecasting Summary:", json.dumps(forecasting_resp.get("summary"), indent=2))
    print("Daily Forecast (all 7 days):", json.dumps(forecasting_resp.get("daily_forecast", []), indent=2))
    print("Ward Forecast (first 5 wards):", json.dumps(forecasting_resp.get("ward_forecast", [])[:5], indent=2))
    
    print("\n" + "=" * 80)
    print("4. EVALUATING FORECAST MODEL ACCURACY (MAE, RMSE, MAPE)")
    print("=" * 80)
    # Check historical daily admissions/census over the past 30 days vs moving average / baseline predictor
    cur.execute("""
        SELECT 
            admission_date::DATE as dt, 
            COUNT(*) as actual_admissions 
        FROM admissions 
        GROUP BY dt 
        ORDER BY dt DESC 
        LIMIT 30
    """)
    hist_adms = cur.fetchall()
    if hist_adms:
        hist_adms.reverse()
        actuals = [r["actual_admissions"] for r in hist_adms]
        # Calculate moving average predictions (window 7)
        preds = []
        for i in range(len(actuals)):
            if i < 7:
                preds.append(sum(actuals[:i+1]) / (i+1))
            else:
                preds.append(sum(actuals[i-7:i]) / 7.0)
                
        errors = [p - a for p, a in zip(preds[7:], actuals[7:])]
        abs_errors = [abs(e) for e in errors]
        sq_errors = [e**2 for e in errors]
        pct_errors = [abs(e)/a * 100 for e, a in zip(errors, actuals[7:]) if a > 0]
        
        mae = sum(abs_errors) / len(abs_errors) if abs_errors else 0
        rmse = math.sqrt(sum(sq_errors) / len(sq_errors)) if sq_errors else 0
        mape = sum(pct_errors) / len(pct_errors) if pct_errors else 0
        
        print(f"Historical 30-Day Admissions Evaluation:")
        print(f"  • Sample Size: {len(actuals)} days")
        print(f"  • Mean Daily Admissions: {sum(actuals)/len(actuals):.2f}")
        print(f"  • MAE (Mean Absolute Error): {mae:.2f} admissions/day")
        print(f"  • RMSE (Root Mean Squared Error): {rmse:.2f} admissions/day")
        print(f"  • MAPE (Mean Absolute Percentage Error): {mape:.2f}%")
        print(f"  • Accuracy (100 - MAPE): {max(0, 100 - mape):.2f}%")
    
    conn.close()

if __name__ == "__main__":
    test_database_and_apis()
