import requests

BASE_URL = "http://localhost:8000"

def test_appointments():
    print("Testing GET /api/dashboard/appointments without date constraints (All Time)...")
    resp = requests.get(f"{BASE_URL}/api/dashboard/appointments", params={"doctor_id": 1017})
    print("Status:", resp.status_code)
    data = resp.json()
    appointments = data.get("appointments", [])
    total = data.get("total", 0)
    print(f"Total appointments returned for Doctor 1017 (Dr. Edwin Stephano J): {total}")
    for apt in appointments:
        print(f"  - ID: {apt.get('booking_id')}, Patient: {apt.get('patient_name')}, Doctor: {apt.get('doctor_name')}, Date: {apt.get('appointment_date')}, Status: {apt.get('status')}")

    assert total > 0, "Expected appointments for Dr. Edwin Stephano J!"
    print("SUCCESS: Appointment fetching verified!")

if __name__ == "__main__":
    test_appointments()
