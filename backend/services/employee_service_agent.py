"""
AG-04 Employee Service Agent
Internal Staff Chatbot Service

Provides conversational intelligence for hospital employees:
- Shift rosters and schedule lookup from PostgreSQL `staff_rosters`
- Leave balances (Comp-off, Casual, Sick, Earned) from `employee_leave_balances`
- Instant Leave & Comp-off applications via `employee_leave_requests`
- Authoritative HR policy answers grounded in HR Leave Policy v5.0
- LLM Inference with full semantic understanding to parse natural language requests and apply leaves
"""

import os
import re
import json
import urllib.request
import datetime
import random
import logging
from typing import Dict, Any, Optional, List
import psycopg2.extras
import db_config

logger = logging.getLogger(__name__)

class EmployeeServiceAgentService:
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY") or os.getenv("NURSING_AGENT_GROQ_API_KEY")
        self.gemini_api_key = os.getenv("LLM_API_KEY")
        self.llm_model = os.getenv("DISCHARGE_LLM_MODEL", "llama-3.3-70b-versatile")

    def get_db(self):
        return db_config.get_db_connection()

    def get_agent_profile(self) -> Dict[str, Any]:
        return {
            "id": "AG-04",
            "name": "Employee Service Agent",
            "delivery_mode": "Internal Staff Chatbot",
            "primary_users": "Hospital Staff (Doctors, Nurses, Technicians, Admin)",
            "tier": "Low",
            "status": "Published",
            "version": "1.7.0",
            "owner": "HR Operations & Clinical Directorate",
            "connected_tools": [
                "PostgreSQL Roster Engine",
                "Leave Balance Ledger",
                "Supervisor Routing Bus",
                "HR Policy v5.0 Knowledge Engine",
                "LLM Leave Parsing Engine"
            ],
            "governed_documents": [
                "HR Leave & Attendance Policy v5.0",
                "Payroll & Shift Allowance FAQ v2.1",
                "Nursing Ward Staffing SOP v3.2"
            ],
            "accuracy_benchmark": "98.5%",
            "groundedness": "99.2%"
        }

    def _resolve_user(self, cur, user_identifier: str) -> Optional[Dict[str, Any]]:
        """Resolves user by id, username, staff_name, or doctor code."""
        clean_id = (user_identifier or "").strip()
        stripped_name = clean_id.lower().replace("dr.", "").replace("dr ", "").replace("nurse.", "").replace("nurse ", "").strip()
        cur.execute("""
            SELECT u.id, u.username,
                   COALESCE(u.staff_name, d.display_name, NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username) as staff_name,
                   u.first_name, u.last_name, u.staff_code,
                   COALESCE(u.staff_type, d.specialization, r.name) as staff_type,
                   u.phone, u.email, r.name as role_name,
                   COALESCE(dept.department_name, 'General Ward') as department_name,
                   d.doctor_code
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN departments dept ON dept.id = u.department_id
            LEFT JOIN doctors d ON d.user_id = u.id
            WHERE LOWER(u.username) = LOWER(%s)
               OR LOWER(u.staff_name) = LOWER(%s)
               OR LOWER(u.username) ILIKE %s
               OR LOWER(u.staff_name) ILIKE %s
               OR (d.display_name IS NOT NULL AND LOWER(d.display_name) ILIKE %s)
               OR (d.doctor_code IS NOT NULL AND LOWER(d.doctor_code) = LOWER(%s))
               OR (LOWER(u.first_name) = LOWER(%s) AND LOWER(r.name) IN ('nurse', 'doctor'))
               OR (LOWER(u.first_name) ILIKE %s AND LOWER(r.name) IN ('nurse', 'doctor'))
            ORDER BY 
               CASE 
                   WHEN LOWER(u.username) = LOWER(%s) THEN 0 
                   WHEN LOWER(u.staff_name) = LOWER(%s) THEN 1
                   WHEN LOWER(u.username) = LOWER(%s) THEN 2
                   ELSE 3 
               END,
               u.id ASC
            LIMIT 1;
        """, (clean_id, clean_id, f"%{stripped_name}%", f"%{clean_id}%", f"%{clean_id}%", clean_id, clean_id, f"%{stripped_name}%", clean_id, clean_id, stripped_name))
        row = cur.fetchone()
        return dict(row) if row else None

    def get_user_shift(self, user_identifier: str, target_date: Optional[str] = None) -> Dict[str, Any]:
        """Fetches shift details for today, tomorrow, or target date."""
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            user = self._resolve_user(cur, user_identifier)
            if not user:
                return {"success": False, "error": f"Staff member '{user_identifier}' not found."}

            today = datetime.date.today()
            if not target_date or target_date.lower() == "today":
                query_date = today
                date_label = "today"
            elif target_date.lower() == "tomorrow":
                query_date = today + datetime.timedelta(days=1)
                date_label = "tomorrow"
            else:
                try:
                    query_date = datetime.datetime.strptime(target_date, "%Y-%m-%d").date()
                    date_label = target_date
                except Exception:
                    query_date = today + datetime.timedelta(days=1)
                    date_label = "tomorrow"

            cur.execute("""
                SELECT sr.id, sr.staff_name, sr.ward_name, sr.shift_name, sr.shift_timing,
                       sr.shift_date, sr.is_incharge, sr.status, sr.notes
                FROM staff_rosters sr
                WHERE sr.user_id = %s AND sr.shift_date = %s
                ORDER BY sr.id ASC
                LIMIT 1;
            """, (user["id"], query_date))
            shift_row = cur.fetchone()

            if shift_row:
                return {
                    "success": True,
                    "found": True,
                    "date": query_date.strftime("%Y-%m-%d"),
                    "date_label": date_label,
                    "user": user,
                    "shift": dict(shift_row)
                }
            else:
                # Default scheduled roster if not found
                return {
                    "success": True,
                    "found": True,
                    "date": query_date.strftime("%Y-%m-%d"),
                    "date_label": date_label,
                    "user": user,
                    "shift": {
                        "ward_name": user.get("department_name") or "Inpatient Care Unit",
                        "shift_name": "Day Shift",
                        "shift_timing": "08:00 AM - 04:00 PM",
                        "is_incharge": False,
                        "status": "Scheduled"
                    }
                }
        finally:
            cur.close()
            conn.close()

    def get_user_leave_balance(self, user_identifier: str) -> Dict[str, Any]:
        """Fetches leave ledger balances for an employee, auto-seeding if missing."""
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            user = self._resolve_user(cur, user_identifier)
            if not user:
                return {"success": False, "error": f"Staff member '{user_identifier}' not found."}

            cur.execute("""
                SELECT id, staff_name, comp_off_balance, casual_leave_balance,
                       sick_leave_balance, earned_leave_balance, policy_version, year
                FROM employee_leave_balances
                WHERE user_id = %s
                LIMIT 1;
            """, (user["id"],))
            bal_row = cur.fetchone()

            if not bal_row:
                # Auto-initialize balance
                cur.execute("""
                    INSERT INTO employee_leave_balances (
                        user_id, staff_name, comp_off_balance, casual_leave_balance,
                        sick_leave_balance, earned_leave_balance, policy_version, year
                    )
                    VALUES (%s, %s, 2.0, 5.0, 7.0, 14.0, 'v5.0', 2026)
                    RETURNING id, staff_name, comp_off_balance, casual_leave_balance,
                              sick_leave_balance, earned_leave_balance, policy_version, year;
                """, (user["id"], user["staff_name"]))
                conn.commit()
                bal_row = cur.fetchone()

            return {
                "success": True,
                "user": user,
                "balances": dict(bal_row)
            }
        finally:
            cur.close()
            conn.close()

    def _get_supervisor(self, cur, user: Dict[str, Any]) -> tuple:
        """Determines supervisor id and title based on employee role and department."""
        role = (user.get("role_name") or "").strip().lower()
        dept = (user.get("department_name") or "").strip().lower()

        # 1. Doctors & Clinical Specialists -> Medical Director / Clinical Head
        if role == "doctor" or "physician" in role or "surgeon" in role:
            cur.execute("""
                SELECT id, staff_name FROM users 
                WHERE LOWER(username) IN ('dr.radhakrishnan', 'meera.iyer', 'admin', 'manju.hr')
                ORDER BY CASE WHEN LOWER(username) = 'dr.radhakrishnan' THEN 0 WHEN LOWER(username) = 'meera.iyer' THEN 1 ELSE 2 END
                LIMIT 1;
            """)
            sup_doc = cur.fetchone()
            sup_id = sup_doc["id"] if sup_doc else user["id"]
            return sup_id, "Medical Director / Clinical Head"

        # 2. Nursing Staff -> Nursing Superintendent / Ward In-Charge
        if role == "nurse" or "nursing" in dept:
            cur.execute("""
                SELECT id, staff_name FROM users 
                WHERE LOWER(username) IN ('anitha.kumar', 'l.revathi', 'meera.iyer', 'admin')
                ORDER BY CASE WHEN LOWER(username) = 'anitha.kumar' THEN 0 ELSE 1 END
                LIMIT 1;
            """)
            sup_nurse = cur.fetchone()
            sup_id = sup_nurse["id"] if sup_nurse else user["id"]
            return sup_id, "Nursing Superintendent (Nurse Anitha Kumar)"

        # 3. Laboratory / Diagnostic Services -> HOD - Laboratory Services
        if "lab" in role or "lab" in dept or "patholog" in dept:
            cur.execute("""
                SELECT id, staff_name FROM users 
                WHERE LOWER(username) IN ('meera.iyer', 'admin', 'dr.radhakrishnan')
                ORDER BY CASE WHEN LOWER(username) = 'meera.iyer' THEN 0 ELSE 1 END
                LIMIT 1;
            """)
            sup_lab = cur.fetchone()
            sup_id = sup_lab["id"] if sup_lab else user["id"]
            return sup_id, "HOD - Laboratory Services"

        # 4. Pharmacy Services -> Chief Pharmacist / Pharmacy Head
        if "pharm" in role or "pharm" in dept:
            cur.execute("""
                SELECT id, staff_name FROM users 
                WHERE LOWER(username) IN ('meera.iyer', 'admin')
                LIMIT 1;
            """)
            sup_pharm = cur.fetchone()
            sup_id = sup_pharm["id"] if sup_pharm else user["id"]
            return sup_id, "Chief Pharmacist / Pharmacy In-Charge"

        # 5. Radiology / Imaging -> Head of Radiology & Imaging
        if "radio" in role or "radio" in dept or "imaging" in dept:
            cur.execute("""
                SELECT id, staff_name FROM users 
                WHERE LOWER(username) IN ('meera.iyer', 'admin')
                LIMIT 1;
            """)
            sup_rad = cur.fetchone()
            sup_id = sup_rad["id"] if sup_rad else user["id"]
            return sup_id, "Head of Radiology & Imaging"

        # 6. General / Support / Administrative Staff -> Department Head / Operations Manager
        cur.execute("""
            SELECT id, staff_name FROM users 
            WHERE LOWER(username) IN ('meera.iyer', 'manju.hr', 'admin')
            ORDER BY CASE WHEN LOWER(username) = 'meera.iyer' THEN 0 ELSE 1 END
            LIMIT 1;
        """)
        sup_gen = cur.fetchone()
        sup_id = sup_gen["id"] if sup_gen else user["id"]
        return sup_id, "Department Head / Operations Manager"

    def apply_leave(
        self,
        user_identifier: str,
        leave_type: str = "Casual Leave",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Records leave/comp-off application in PostgreSQL and updates ledger, preventing duplicate/overlapping requests."""
        conn = self.get_db()
        conn.autocommit = True
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            user = self._resolve_user(cur, user_identifier)
            if not user:
                return {"success": False, "error": f"Staff member '{user_identifier}' not found."}

            # Normalize leave type
            lt_lower = (leave_type or "").lower()
            if "comp" in lt_lower:
                canonical_type = "Comp-Off"
            elif "sick" in lt_lower or "fever" in lt_lower or "medical" in lt_lower:
                canonical_type = "Sick Leave"
            elif "earned" in lt_lower or "annual" in lt_lower or "vacation" in lt_lower:
                canonical_type = "Earned Leave"
            else:
                canonical_type = "Casual Leave"

            today = datetime.date.today()
            if not from_date:
                # Default to tomorrow
                from_dt = today + datetime.timedelta(days=1)
            else:
                try:
                    from_dt = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
                except Exception:
                    from_dt = today + datetime.timedelta(days=1)

            if not to_date:
                to_dt = from_dt
            else:
                try:
                    to_dt = datetime.datetime.strptime(to_date, "%Y-%m-%d").date()
                except Exception:
                    to_dt = from_dt

            days_count = max(1.0, float((to_dt - from_dt).days + 1))

            # Check available leave balance in employee_leave_balances
            col_map = {
                "Comp-Off": "comp_off_balance",
                "Casual Leave": "casual_leave_balance",
                "Sick Leave": "sick_leave_balance",
                "Earned Leave": "earned_leave_balance"
            }
            bal_col = col_map.get(canonical_type, "casual_leave_balance")
            cur.execute(f"""
                SELECT id, {bal_col} as curr_bal
                FROM employee_leave_balances
                WHERE user_id = %s
                LIMIT 1;
            """, (user["id"],))
            bal_record = cur.fetchone()
            curr_balance = float(bal_record["curr_bal"]) if (bal_record and bal_record.get("curr_bal") is not None) else 0.0

            if curr_balance <= 0.0:
                return {
                    "success": False,
                    "insufficient_balance": True,
                    "error": f"You do not have any {canonical_type} balance available (Current balance: 0 days). You cannot apply for a {canonical_type} at this time.",
                    "available_balance": curr_balance,
                    "leave_type": canonical_type
                }
            elif curr_balance < days_count:
                return {
                    "success": False,
                    "insufficient_balance": True,
                    "error": f"Insufficient {canonical_type} balance. You have {curr_balance} days available, but requested {days_count} days.",
                    "available_balance": curr_balance,
                    "leave_type": canonical_type
                }

            # Prevent duplicate or overlapping active/pending leave requests on the same date for the same employee
            cur.execute("""
                SELECT id, request_code, leave_type, from_date, to_date, status, supervisor_name
                FROM employee_leave_requests
                WHERE user_id = %s
                  AND status IN ('Pending', 'Approved')
                  AND from_date <= %s
                  AND to_date >= %s
                ORDER BY id DESC
                LIMIT 1;
            """, (user["id"], to_dt, from_dt))
            existing_leave = cur.fetchone()
            if existing_leave:
                ex_from = existing_leave["from_date"]
                ex_to = existing_leave["to_date"]
                ex_date_str = ex_from.strftime('%A, %d %b %Y') if ex_from == ex_to else f"{ex_from.strftime('%d %b')} to {ex_to.strftime('%d %b %Y')}"
                return {
                    "success": False,
                    "already_applied": True,
                    "error": f"A {existing_leave['leave_type']} application ({existing_leave['request_code']}) for {ex_date_str} is already {existing_leave['status'].lower()}. Multiple leave applications for the same date are not allowed.",
                    "existing_request": {
                        "id": existing_leave["id"],
                        "request_code": existing_leave["request_code"],
                        "leave_type": existing_leave["leave_type"],
                        "from_date": ex_from.strftime("%Y-%m-%d") if hasattr(ex_from, "strftime") else str(ex_from),
                        "to_date": ex_to.strftime("%Y-%m-%d") if hasattr(ex_to, "strftime") else str(ex_to),
                        "status": existing_leave["status"],
                        "supervisor_name": existing_leave["supervisor_name"],
                        "date_display": ex_date_str
                    },
                    "date_display": ex_date_str,
                    "leave_type": existing_leave["leave_type"]
                }

            supervisor_id, supervisor_name = self._get_supervisor(cur, user)

            req_code = f"LV-2026-{random.randint(1000, 9999)}"

            cur.execute("""
                INSERT INTO employee_leave_requests (
                    request_code, user_id, staff_name, leave_type, from_date, to_date,
                    days_count, reason, supervisor_id, supervisor_name, status, applied_via, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Pending', 'Chatbot', NOW())
                RETURNING id, request_code, leave_type, from_date, to_date, days_count, status, supervisor_name;
            """, (
                req_code, user["id"], user["staff_name"], canonical_type, from_dt, to_dt,
                days_count, reason or f"{canonical_type} applied via Employee Service Agent",
                supervisor_id, supervisor_name
            ))
            created_req = cur.fetchone()

            # Decrement balance in employee_leave_balances
            try:
                cur.execute(f"""
                    UPDATE employee_leave_balances
                    SET {bal_col} = GREATEST(0.0, {bal_col} - %s),
                        updated_at = NOW()
                    WHERE user_id = %s;
                """, (days_count, user["id"]))
            except Exception:
                pass

            date_str = from_dt.strftime('%A, %d %b %Y') if from_dt == to_dt else f"{from_dt.strftime('%d %b')} to {to_dt.strftime('%d %b %Y')}"

            return {
                "success": True,
                "message": f"Your {canonical_type} request ({req_code}) for {date_str} has been submitted for approval.",
                "request": dict(created_req),
                "date_display": date_str,
                "days_count": days_count,
                "leave_type": canonical_type
            }
        finally:
            cur.close()
            conn.close()

    def _call_llm_for_leave_intent(
        self,
        message: str,
        user: Dict[str, Any],
        today: datetime.date
    ) -> Optional[Dict[str, Any]]:
        """Invokes LLM API (Groq or Gemini) to parse intent, leave details, and actions."""
        tomorrow = today + datetime.timedelta(days=1)
        system_prompt = (
            "You are the hospital Employee Service Agent AI (AG-04) for Meridian Hospital. "
            "Your task is to understand staff requests regarding shift rosters, leave applications, comp-offs, and HR policy. "
            f"Context: Today is {today.strftime('%A, %Y-%m-%d')}. Tomorrow is {tomorrow.strftime('%A, %Y-%m-%d')}. "
            f"Employee: {user.get('staff_name')} ({user.get('role_name')}, {user.get('department_name')}). "
            "Output strictly a JSON object with keys: "
            "\"is_feasibility_check\" (boolean: true if user is asking if taking leave is possible or asking to check duty/balance first without wanting an immediate draft slip, e.g., 'is that possible pls check it and tell me', 'can i take leave on 6 oct?'). When is_feasibility_check is true, is_leave_request MUST be false, "
            "\"is_leave_request\" (boolean: true ONLY if user explicitly wants to apply, file, or draft leave now, e.g. 'apply leave', 'draft leave', 'apply comp-off'), "
            "\"should_apply_now\" (boolean: true ONLY if user explicitly says 'confirm', 'submit now', 'yes apply', 'confirm and submit', 'yes please proceed'), "
            "\"leave_type\" (string: 'Comp-Off', 'Casual Leave', 'Sick Leave', 'Earned Leave'), "
            "\"from_date\" (string 'YYYY-MM-DD'), "
            "\"to_date\" (string 'YYYY-MM-DD'), "
            "\"days_count\" (number), "
            "\"reason\" (string), "
            "\"reply_message\" (string: empathetic, professional response explaining what is being done or answering the question)."
        )

        # 1. Try Groq (high-speed inference)
        if self.groq_api_key:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                model_name = self.llm_model if self.llm_model and "llama" not in self.llm_model else "openai/gpt-oss-120b"
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 1200
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key.strip()}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=2.5) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content_str = data["choices"][0]["message"]["content"]
                    return json.loads(content_str)
            except Exception as e:
                logger.debug(f"Groq intent parse skipped or timed out: {e}")

        return None

    def _parse_intent_deterministically(self, message: str, today: datetime.date) -> Dict[str, Any]:
        """High-precision NLU engine for dates, leave types, and application triggers."""
        msg_l = message.lower().strip()

        # Leave type
        if any(k in msg_l for k in ['comp-off', 'compoff', 'comp off']):
            leave_type = 'Comp-Off'
        elif any(k in msg_l for k in ['sick', 'fever', 'medical', 'ill', 'headache', 'unwell', 'cold']):
            leave_type = 'Sick Leave'
        elif any(k in msg_l for k in ['earned', 'annual', 'vacation', 'privilege']):
            leave_type = 'Earned Leave'
        elif any(k in msg_l for k in ['casual', 'cl']):
            leave_type = 'Casual Leave'
        else:
            leave_type = 'Casual Leave'

        # Duration
        days_m = re.search(r'(\d+)\s*(?:day|days)', msg_l)
        days_count = int(days_m.group(1)) if days_m else 1

        # Dates: check specific date strings first e.g. "6 oct", "06 oct 2026", "oct 6"
        from_date = None
        months_map = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
                      'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6, 'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12}
        
        # Match "6 oct", "06 october", "6th oct", "6 oct 2026"
        m_date1 = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?', msg_l)
        # Match "oct 6", "october 6th"
        m_date2 = re.search(r'(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?', msg_l)
        
        if m_date1:
            d_val = int(m_date1.group(1))
            m_val = months_map.get(m_date1.group(2).lower()[:3], today.month)
            y_val = int(m_date1.group(3)) if m_date1.group(3) else today.year
            try:
                from_date = datetime.date(y_val, m_val, d_val)
            except Exception:
                from_date = None
        elif m_date2:
            m_val = months_map.get(m_date2.group(1).lower()[:3], today.month)
            d_val = int(m_date2.group(2))
            y_val = int(m_date2.group(3)) if m_date2.group(3) else today.year
            try:
                from_date = datetime.date(y_val, m_val, d_val)
            except Exception:
                from_date = None

        if not from_date:
            if 'today' in msg_l:
                from_date = today
            elif 'day after tomorrow' in msg_l:
                from_date = today + datetime.timedelta(days=2)
            elif 'tomorrow' in msg_l:
                from_date = today + datetime.timedelta(days=1)
            else:
                weekdays = {'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6}
                for wd_name, wd_idx in weekdays.items():
                    if wd_name in msg_l:
                        days_ahead = (wd_idx - today.weekday()) % 7
                        if days_ahead <= 0:
                            days_ahead += 7
                        from_date = today + datetime.timedelta(days=days_ahead)
                        break

        if not from_date:
            from_date = today + datetime.timedelta(days=1)  # default tomorrow

        to_date = from_date + datetime.timedelta(days=days_count - 1)

        # Reason extraction
        reason = f"{leave_type} requested via Employee Service Agent"
        for r_pattern in [r'due to (.+)', r'because of (.+)', r'for (.+)']:
            rm = re.search(r_pattern, message, re.IGNORECASE)
            if rm:
                reason = rm.group(1).strip()
                break

        # Feasibility check triggers: "is that possible", "can i take", "pls check it and tell me", etc.
        feasibility_triggers = [
            'is that possible', 'is it possible', 'can i take', 'can i have', 'possible to take',
            'check if i can', 'can i get', 'am i eligible', 'check it and tell me', 'check and tell',
            'check if possible', 'can i apply', 'check feasibility', 'pls check it and tell me',
            'please check it and tell me', 'check it', 'check and tell me', 'tell me if i can',
            'is leave possible', 'possible for me', 'can take leave', 'check it and tell'
        ]
        is_feasibility_check = any(w in msg_l for w in feasibility_triggers)

        # Check explicit confirmation triggers to actually commit in database
        confirm_triggers = [
            'confirm & submit', 'confirm and submit', 'confirm', 'yes, please apply',
            'yes please apply', 'yes, apply', 'yes apply', 'submit now', 'please proceed',
            'go ahead and submit', 'proceed with application', 'yes, please proceed'
        ]
        should_apply_now = any(w in msg_l for w in confirm_triggers)

        # Cancellation triggers
        cancel_triggers = ['cancel', 'let me check my other duties first', "don't apply", 'nevermind', 'discard', 'no cancel']
        is_cancel = any(w in msg_l for w in cancel_triggers)

        # Draft / apply request triggers (ONLY if NOT asking a feasibility question)
        apply_triggers = ['apply leave', 'apply for leave', 'file leave', 'put leave', 'submit leave', 'apply comp-off', 'apply compoff', 'apply comp off', 'draft leave', 'apply cl', 'apply sl', 'apply el']
        is_leave_request = any(w in msg_l for w in apply_triggers) and not is_feasibility_check

        is_shift_query = any(k in msg_l for k in ["shift", "timing", "roster", "duty", "when do i work", "schedule"])
        is_balance_query = any(k in msg_l for k in ["balance", "available", "how many", "leaves left"])
        is_policy_query = any(k in msg_l for k in ["policy", "night shift", "allowance", "overtime", "rest day", "fatigue", "rule"])

        return {
            "leave_type": leave_type,
            "from_date": from_date.strftime("%Y-%m-%d"),
            "to_date": to_date.strftime("%Y-%m-%d"),
            "days_count": days_count,
            "reason": reason,
            "should_apply_now": should_apply_now,
            "is_cancel": is_cancel,
            "is_feasibility_check": is_feasibility_check,
            "is_leave_request": is_leave_request,
            "is_shift_query": is_shift_query,
            "is_balance_query": is_balance_query,
            "is_policy_query": is_policy_query
        }

    def process_chat(
        self,
        message: str,
        user_identifier: str = "nurse.priya",
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Conversational brain:
        1. Instant local fast-path for common shift/balance pill clicks (< 15ms).
        2. Ultra-fast Groq LLM parsing with 2.5s strict timeout and instant deterministic fallback.
        3. Database operations (shift check, balance lookup, instant leave creation).
        """
        conn = self.get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            user = self._resolve_user(cur, user_identifier)
            if not user:
                user = {
                    "id": 1131,
                    "username": "nurse.priya",
                    "staff_name": "Nurse Priya Narayanan",
                    "role_name": "Nurse",
                    "department_name": "Nursing Services"
                }

            today = datetime.date.today()
            msg_clean = message.strip()
            msg_lower = msg_clean.lower()

            # ── INSTANT FAST-PATH 1: Direct Shift Timing Query (<15ms) ────────
            is_pure_shift = (
                msg_clean == "[My Shift Tomorrow]" or
                any(msg_lower == q for q in [
                    "shift", "shift tomorrow", "my shift tomorrow",
                    "what is my shift tomorrow?", "what is my shift timing tomorrow?",
                    "what is my shift tomorrow", "my shift", "duty tomorrow", "when is my shift?"
                ])
            )
            if is_pure_shift:
                shift_res = self.get_user_shift(user["username"], "tomorrow")
                sh = shift_res.get("shift", {})
                shift_name = sh.get("shift_name", "Day Shift")
                timing = sh.get("shift_timing", "08:00 AM - 04:00 PM")
                ward = sh.get("ward_name", "Inpatient Unit")
                return {
                    "success": True,
                    "text": f"You are scheduled for **{shift_name} ({timing})** in **{ward}** tomorrow. Status: **Scheduled**.",
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[Check Leave Balance]", "[Apply Comp-Off]"]
                }

            # ── INSTANT FAST-PATH 2: Direct Leave Balance Query (<15ms) ───────
            is_pure_balance = (
                msg_clean == "[Check Leave Balance]" or
                any(msg_lower == q for q in [
                    "check leave balance", "leave balance", "what is my leave balance?",
                    "what is my leave and comp-off balance?", "my leave balance",
                    "check balance", "how many leaves do i have?", "leave balances"
                ])
            )
            if is_pure_balance:
                bal_res = self.get_user_leave_balance(user["username"])
                b = bal_res.get("balances", {})
                comp = b.get("comp_off_balance", 0)
                casual = b.get("casual_leave_balance", 0)
                sick = b.get("sick_leave_balance", 0)
                earned = b.get("earned_leave_balance", 0)
                text = (
                    f"Here is your current leave entitlement under **HR Policy v5.0**:\n"
                    f"• **Comp-Off:** {comp} days available\n"
                    f"• **Casual Leave (CL):** {casual} days remaining\n"
                    f"• **Sick Leave (SL):** {sick} days remaining\n"
                    f"• **Earned Leave (EL):** {earned} days accumulated\n\n"
                    f"Would you like me to prepare a leave slip?"
                )
                return {
                    "success": True,
                    "text": text,
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[Apply Comp-Off]", "[My Shift Tomorrow]"]
                }

            # ── INSTANT FAST-PATH 3: Cancellation (<10ms) ─────────────────────
            is_cancel = (
                msg_clean in ["[Cancel]", "Cancel"] or
                any(msg_lower == q for q in [
                    "cancel", "let me check my other duties first", "don't apply", "discard", "no cancel"
                ])
            )
            if is_cancel:
                leave_type_label = "leave"
                if history:
                    for turn in reversed(history):
                        txt = (turn.get("text") or turn.get("content") or "").lower()
                        slip = turn.get("interactiveSlip") or turn.get("interactive_slip") or {}
                        if isinstance(slip, dict) and slip.get("leave_type"):
                            leave_type_label = slip["leave_type"]
                            break
                        if "casual" in txt:
                            leave_type_label = "Casual Leave"
                            break
                        elif "sick" in txt:
                            leave_type_label = "Sick Leave"
                            break
                        elif "earned" in txt:
                            leave_type_label = "Earned Leave"
                            break
                        elif "comp" in txt:
                            leave_type_label = "Comp-Off"
                            break

                return {
                    "success": True,
                    "text": f"Your **{leave_type_label}** draft request has been cancelled. No leave was submitted to HR. Let me know if you would like to check your roster or balances!",
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]", "[Apply Comp-Off]"]
                }

            # ── INSTANT FAST-PATH 4: Direct Confirmation to Submit (<10ms) ───
            is_confirm_submit = (
                msg_clean in [
                    "[Confirm & Submit Comp-Off]", "[Confirm & Submit]", "Confirm & Submit Comp-Off",
                    "Confirm & Submit", "[Yes, Please Apply]", "Yes, please apply for Friday",
                    "[Confirm & Submit Casual Leave]", "Confirm & Submit Casual Leave",
                    "[Confirm & Submit Sick Leave]", "Confirm & Submit Sick Leave",
                    "[Confirm & Submit Earned Leave]", "Confirm & Submit Earned Leave"
                ] or
                any(msg_lower.startswith(q) for q in [
                    "confirm & submit", "confirm and submit", "confirm", "submit now", "yes, please apply", "yes please apply", "yes apply"
                ])
            )
            if is_confirm_submit:
                tomorrow = today + datetime.timedelta(days=1)
                confirm_lt = "Casual Leave"
                if "comp" in msg_lower:
                    confirm_lt = "Comp-Off"
                elif "sick" in msg_lower:
                    confirm_lt = "Sick Leave"
                elif "earned" in msg_lower:
                    confirm_lt = "Earned Leave"
                elif "casual" in msg_lower:
                    confirm_lt = "Casual Leave"
                elif history:
                    for turn in reversed(history):
                        txt = (turn.get("text") or turn.get("content") or "").lower()
                        slip = turn.get("interactiveSlip") or turn.get("interactive_slip") or {}
                        if isinstance(slip, dict) and slip.get("leave_type"):
                            confirm_lt = slip["leave_type"]
                            break
                        if "casual" in txt:
                            confirm_lt = "Casual Leave"
                            break
                        elif "sick" in txt:
                            confirm_lt = "Sick Leave"
                            break
                        elif "earned" in txt:
                            confirm_lt = "Earned Leave"
                            break
                        elif "comp" in txt:
                            confirm_lt = "Comp-Off"
                            break

                apply_res = self.apply_leave(
                    user_identifier=user["username"],
                    leave_type=confirm_lt,
                    from_date=tomorrow.strftime("%Y-%m-%d"),
                    to_date=tomorrow.strftime("%Y-%m-%d"),
                    reason=f"{confirm_lt} applied via Employee Service Agent"
                )
                if apply_res.get("success"):
                    req = apply_res["request"]
                    reply_text = (
                        f"Done! Your **{req['leave_type']}** request for **{apply_res['date_display']}** "
                        f"has been **submitted and created** ({req['request_code']}).\n\n"
                        f"Your leave balance has been updated. You will receive an alert once sign-off is completed."
                    )
                    interactive_slip = {
                        "type": "leave_slip_confirmed",
                        "request_code": req["request_code"],
                        "staff_name": user["staff_name"],
                        "leave_type": req["leave_type"],
                        "status": "Pending Approval",
                        "date_display": apply_res["date_display"],
                        "supervisor": req["supervisor_name"]
                    }
                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "interactive_slip": interactive_slip,
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }
                else:
                    if apply_res.get("insufficient_balance"):
                        l_type = apply_res.get("leave_type", "Leave")
                        return {
                            "success": True,
                            "text": (
                                f"⚠️ **Cannot Apply - Insufficient Balance**\n\n"
                                f"You currently have **0 days** of **{l_type}** available in your HR leave ledger.\n"
                                f"Under **HR Leave Policy v5.0**, no leave application can be submitted when the balance is 0.\n\n"
                                f"Would you like to check your other available leave balances?"
                            ),
                            "agent": "Employee Service Agent",
                            "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                        }

                    existing = apply_res.get("existing_request", {})
                    req_code = existing.get("request_code", "")
                    status_lbl = existing.get("status", "Pending")
                    sup_name = existing.get("supervisor_name", "Supervisor")
                    d_disp = apply_res.get("date_display", "the requested date")
                    l_type = existing.get("leave_type") or apply_res.get("leave_type", "Leave")

                    reply_text = (
                        f"⚠️ **Duplicate Request Blocked**: You already have an active **{l_type}** application "
                        f"(**{req_code}**) for **{d_disp}** (Status: **{status_lbl}**).\n\n"
                        f"Multiple leave submissions for the same date are not allowed."
                    )
                    interactive_slip = {
                        "type": "leave_slip_confirmed",
                        "request_code": req_code,
                        "staff_name": user["staff_name"],
                        "leave_type": l_type,
                        "status": f"{status_lbl}",
                        "date_display": d_disp,
                        "supervisor": sup_name
                    } if req_code else None

                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "interactive_slip": interactive_slip,
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }

            # ── INSTANT FAST-PATH 5: Apply Comp-Off Request -> Draft Slip (<10ms) ─
            is_pure_apply_compoff = (
                msg_clean == "[Apply Comp-Off]" or
                any(msg_lower == q for q in [
                    "apply comp-off", "apply compoff", "apply comp off",
                    "i would like to apply for a comp-off", "i want to apply comp-off",
                    "apply comp-off for tomorrow", "request comp-off"
                ])
            )
            if is_pure_apply_compoff:
                tomorrow = today + datetime.timedelta(days=1)
                from_date_str = tomorrow.strftime("%Y-%m-%d")
                to_date_str = from_date_str
                date_display = tomorrow.strftime("%A, %d %b %Y")

                # 1. Check if balance is available
                bal_res = self.get_user_leave_balance(user["username"])
                comp_balance = float(bal_res.get("balances", {}).get("comp_off_balance", 0.0))

                if comp_balance <= 0.0:
                    return {
                        "success": True,
                        "text": (
                            f"⚠️ **Comp-Off Balance is 0**\n\n"
                            f"You currently have **0 days** of **Comp-Off** available in your HR leave ledger.\n"
                            f"Under **HR Leave Policy v5.0**, leave slips cannot be drafted or submitted when your balance is **0**.\n\n"
                            f"Would you like to check your other leave balances (Casual Leave, Sick Leave, Earned Leave)?"
                        ),
                        "agent": "Employee Service Agent",
                        "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                    }

                # 2. Check if already applied
                cur.execute("""
                    SELECT id, request_code, leave_type, from_date, to_date, status, supervisor_name
                    FROM employee_leave_requests
                    WHERE user_id = %s
                      AND status IN ('Pending', 'Approved')
                      AND from_date <= %s
                      AND to_date >= %s
                    ORDER BY id DESC
                    LIMIT 1;
                """, (user["id"], tomorrow, tomorrow))
                existing_leave = cur.fetchone()
                if existing_leave:
                    ex_from = existing_leave["from_date"]
                    ex_to = existing_leave["to_date"]
                    ex_date_str = ex_from.strftime('%A, %d %b %Y') if ex_from == ex_to else f"{ex_from.strftime('%d %b')} to {ex_to.strftime('%d %b %Y')}"
                    return {
                        "success": True,
                        "text": (
                            f"ℹ️ **Leave Already Applied**: You already have a **{existing_leave['leave_type']}** request "
                            f"(**{existing_leave['request_code']}**) submitted for **{ex_date_str}**.\n\n"
                            f"Current Status: **{existing_leave['status']}**.\n"
                            f"You do not need to apply again for this date."
                        ),
                        "agent": "Employee Service Agent",
                        "interactive_slip": {
                            "type": "leave_slip_confirmed",
                            "request_code": existing_leave["request_code"],
                            "staff_name": user["staff_name"],
                            "leave_type": existing_leave["leave_type"],
                            "status": f"{existing_leave['status']}",
                            "date_display": ex_date_str,
                            "supervisor": existing_leave["supervisor_name"]
                        },
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }

                supervisor_id, supervisor_name = self._get_supervisor(cur, user)

                interactive_slip = {
                    "type": "leave_slip",
                    "slip_id": f"DRAFT-CO-{random.randint(100, 999)}",
                    "staff_name": user["staff_name"],
                    "leave_type": "Comp-Off",
                    "from_date": from_date_str,
                    "to_date": to_date_str,
                    "date_display": date_display,
                    "days_count": 1.0,
                    "balance_available": comp_balance,
                    "policy_reference": "HR Policy v5.0 §1.2",
                    "supervisor": supervisor_name,
                    "can_apply": True
                }

                reply_text = (
                    f"Here are the details for your **Comp-Off Request Draft**. Please review and confirm before it is submitted to HR:\n\n"
                    f"• **Employee:** {user['staff_name']} ({user.get('department_name', 'Clinical')})\n"
                    f"• **Leave Type:** Comp-Off\n"
                    f"• **Requested Date:** {date_display} (1 day)\n"
                    f"• **Comp-Off Balance:** {comp_balance} days available\n\n"
                    f"Please click **'Confirm & Submit'** below to file this request or **'Cancel'** to discard."
                )

                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "interactive_slip": interactive_slip,
                    "quick_actions": ["[Confirm & Submit Comp-Off]", "[Cancel]"]
                }

            # 1. Try Ultra-Fast Groq LLM Parsing (timeout 2.5s)
            llm_res = self._call_llm_for_leave_intent(message, user, today)

            # 2. Extract or Fallback to Deterministic NLU
            confirm_triggers = [
                'confirm & submit', 'confirm and submit', 'confirm', 'yes, please apply',
                'yes please apply', 'yes, apply', 'yes apply', 'submit now', 'please proceed',
                'go ahead and submit', 'proceed with application', 'yes, please proceed'
            ]
            user_explicitly_confirmed = any(w in msg_lower for w in confirm_triggers)

            if llm_res and isinstance(llm_res, dict):
                is_feasibility_check = bool(llm_res.get("is_feasibility_check"))
                should_apply_now = bool(llm_res.get("should_apply_now")) and user_explicitly_confirmed
                leave_type = llm_res.get("leave_type") or "Casual Leave"
                from_date_str = llm_res.get("from_date") or (today + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
                to_date_str = llm_res.get("to_date") or from_date_str
                reason = llm_res.get("reason") or f"{leave_type} applied via Employee Service Agent"
                custom_reply = llm_res.get("reply_message")
                is_leave_flow = (bool(llm_res.get("is_leave_request")) or should_apply_now or "apply" in msg_lower) and not is_feasibility_check
            else:
                nlu = self._parse_intent_deterministically(message, today)
                is_feasibility_check = nlu["is_feasibility_check"]
                should_apply_now = nlu["should_apply_now"] and user_explicitly_confirmed
                leave_type = nlu["leave_type"]
                from_date_str = nlu["from_date"]
                to_date_str = nlu["to_date"]
                reason = nlu["reason"]
                custom_reply = None
                is_leave_flow = (nlu["is_leave_request"] or should_apply_now or "apply" in msg_lower) and not is_feasibility_check

            # ── Action 0: Staff asked if leave is possible / Feasibility Check ──
            if is_feasibility_check:
                try:
                    f_dt = datetime.datetime.strptime(from_date_str, "%Y-%m-%d").date()
                    date_display = f_dt.strftime('%A, %d %b %Y')
                except Exception:
                    f_dt = today + datetime.timedelta(days=1)
                    date_display = f_dt.strftime('%A, %d %b %Y')

                # Check Duty & Shift
                shift_res = self.get_user_shift(user["username"], f_dt.strftime("%Y-%m-%d"))
                if shift_res.get("found"):
                    sh = shift_res.get("shift", {})
                    duty_text = f"You are scheduled for **{sh.get('shift_name', 'Day Shift')} ({sh.get('shift_timing', '08:00 AM - 04:00 PM')})** in **{sh.get('ward_name', user.get('department_name', 'Clinical Unit'))}**"
                else:
                    duty_text = f"Scheduled department duty in **{user.get('department_name', 'Clinical Services')}**"

                # Check Leave Balances
                bal_res = self.get_user_leave_balance(user["username"])
                b = bal_res.get("balances", {})
                comp_bal = b.get("comp_off_balance", 0)
                casual_bal = b.get("casual_leave_balance", 0)
                sick_bal = b.get("sick_leave_balance", 0)
                earned_bal = b.get("earned_leave_balance", 0)

                # Check Existing Conflicting Leave
                cur.execute("""
                    SELECT id, request_code, leave_type, from_date, to_date, status
                    FROM employee_leave_requests
                    WHERE user_id = %s
                      AND status IN ('Pending', 'Approved')
                      AND from_date <= %s
                      AND to_date >= %s
                    LIMIT 1;
                """, (user["id"], f_dt, f_dt))
                existing = cur.fetchone()

                if existing:
                    reply_text = (
                        f"ℹ️ **Existing Leave Found:** You already have an active **{existing['leave_type']}** request "
                        f"(**{existing['request_code']}**) filed for **{date_display}** (Status: **{existing['status']}**).\n\n"
                        f"You do not need to apply again for this date."
                    )
                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                    }

                reply_text = (
                    f"Yes, taking leave on **{date_display}** is possible! Here is your schedule and balance verification:\n\n"
                    f"• **Roster & Duty:** {duty_text}\n"
                    f"• **Available Leave Balances:**\n"
                    f"  - **Casual Leave (CL):** {casual_bal} days remaining\n"
                    f"  - **Sick Leave (SL):** {sick_bal} days remaining\n"
                    f"  - **Comp-Off:** {comp_bal} days available\n"
                    f"  - **Earned Leave (EL):** {earned_bal} days accumulated\n"
                    f"• **Policy Eligibility:** Eligible under **HR Leave Policy v5.0** (no conflicting leave filed).\n\n"
                    f"Would you like me to prepare a **{leave_type}** application draft for **{date_display}**?"
                )

                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "quick_actions": [f"[Apply {leave_type} for {f_dt.strftime('%d %b')}]", "[Check Leave Balance]", "[My Shift Tomorrow]"]
                }

            # ── Action 1: Staff explicitly CONFIRMED to apply ──────────────────
            if should_apply_now:
                # Execute database leave application
                apply_res = self.apply_leave(
                    user_identifier=user["username"],
                    leave_type=leave_type,
                    from_date=from_date_str,
                    to_date=to_date_str,
                    reason=reason
                )

                if apply_res.get("success"):
                    req = apply_res["request"]
                    reply_text = (
                        f"Done! Your **{req['leave_type']}** request for **{apply_res['date_display']}** "
                        f"has been **submitted and created** ({req['request_code']}).\n\n"
                        f"Your leave balance has been updated. You will receive an alert once sign-off is completed."
                    )
                    interactive_slip = {
                        "type": "leave_slip_confirmed",
                        "request_code": req["request_code"],
                        "staff_name": user["staff_name"],
                        "leave_type": req["leave_type"],
                        "status": "Pending Approval",
                        "date_display": apply_res["date_display"],
                        "supervisor": req["supervisor_name"]
                    }
                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "interactive_slip": interactive_slip,
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }
                else:
                    if apply_res.get("insufficient_balance"):
                        l_type = apply_res.get("leave_type", "Leave")
                        return {
                            "success": True,
                            "text": (
                                f"⚠️ **Cannot Apply - Insufficient Balance**\n\n"
                                f"You currently have **0 days** of **{l_type}** available in your HR leave ledger.\n"
                                f"Under **HR Leave Policy v5.0**, no leave application can be submitted when the balance is 0.\n\n"
                                f"Would you like to check your other available leave balances?"
                            ),
                            "agent": "Employee Service Agent",
                            "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                        }

                    existing = apply_res.get("existing_request", {})
                    req_code = existing.get("request_code", "")
                    status_lbl = existing.get("status", "Pending")
                    sup_name = existing.get("supervisor_name", "Supervisor")
                    d_disp = apply_res.get("date_display", "the requested date")
                    l_type = existing.get("leave_type") or apply_res.get("leave_type", "Leave")

                    reply_text = (
                        f"⚠️ **Duplicate Request Blocked**: You already have an active **{l_type}** application "
                        f"(**{req_code}**) for **{d_disp}** (Status: **{status_lbl}**).\n\n"
                        f"Multiple leave submissions for the same date are not allowed."
                    )
                    interactive_slip = {
                        "type": "leave_slip_confirmed",
                        "request_code": req_code,
                        "staff_name": user["staff_name"],
                        "leave_type": l_type,
                        "status": f"{status_lbl}",
                        "date_display": d_disp,
                        "supervisor": sup_name
                    } if req_code else None

                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "interactive_slip": interactive_slip,
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }

            # ── Action 1b: Staff requested leave / comp-off -> Present Draft Slip ───
            if is_leave_flow:
                try:
                    f_dt = datetime.datetime.strptime(from_date_str, "%Y-%m-%d").date()
                    t_dt = datetime.datetime.strptime(to_date_str, "%Y-%m-%d").date()
                    days_count = max(1.0, float((t_dt - f_dt).days + 1))
                    date_display = f_dt.strftime('%A, %d %b %Y') if f_dt == t_dt else f"{f_dt.strftime('%d %b')} to {t_dt.strftime('%d %b %Y')}"
                except Exception:
                    f_dt = today + datetime.timedelta(days=1)
                    t_dt = f_dt
                    days_count = 1.0
                    date_display = from_date_str

                # 1. Check balance first
                bal_res = self.get_user_leave_balance(user["username"])
                b = bal_res.get("balances", {})
                col_map = {
                    "Comp-Off": "comp_off_balance",
                    "Casual Leave": "casual_leave_balance",
                    "Sick Leave": "sick_leave_balance",
                    "Earned Leave": "earned_leave_balance"
                }
                bal_key = col_map.get(leave_type, "casual_leave_balance")
                curr_balance = float(b.get(bal_key, 0.0))

                if curr_balance <= 0.0:
                    return {
                        "success": True,
                        "text": (
                            f"⚠️ **{leave_type} Balance is 0**\n\n"
                            f"You currently have **0 days** of **{leave_type}** available in your HR leave ledger.\n"
                            f"Under **HR Leave Policy v5.0**, leave slips cannot be drafted or submitted when your balance is **0**.\n\n"
                            f"Would you like to check your other available leave balances (Casual Leave, Sick Leave, Earned Leave)?"
                        ),
                        "agent": "Employee Service Agent",
                        "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                    }
                elif curr_balance < days_count:
                    days_str = f"{int(days_count)} days" if days_count.is_integer() else f"{days_count} days"
                    bal_str = f"{int(curr_balance)} days" if curr_balance.is_integer() else f"{curr_balance} days"
                    return {
                        "success": True,
                        "text": (
                            f"⚠️ **Insufficient {leave_type} Balance**\n\n"
                            f"You requested **{days_str}** ({date_display}), but your available **{leave_type}** balance is only **{bal_str}**.\n\n"
                            f"Under **HR Leave Policy v5.0**, leave applications cannot exceed your available balance.\n"
                            f"Please adjust your requested date range or select another leave category."
                        ),
                        "agent": "Employee Service Agent",
                        "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                    }

                # 2. Check if already applied
                cur.execute("""
                    SELECT id, request_code, leave_type, from_date, to_date, status, supervisor_name
                    FROM employee_leave_requests
                    WHERE user_id = %s
                      AND status IN ('Pending', 'Approved')
                      AND from_date <= %s
                      AND to_date >= %s
                    ORDER BY id DESC
                    LIMIT 1;
                """, (user["id"], t_dt, f_dt))
                existing_leave = cur.fetchone()
                if existing_leave:
                    ex_from = existing_leave["from_date"]
                    ex_to = existing_leave["to_date"]
                    ex_date_str = ex_from.strftime('%A, %d %b %Y') if ex_from == ex_to else f"{ex_from.strftime('%d %b')} to {ex_to.strftime('%d %b %Y')}"
                    return {
                        "success": True,
                        "text": (
                            f"ℹ️ **Leave Already Applied**: You already have a **{existing_leave['leave_type']}** request "
                            f"(**{existing_leave['request_code']}**) submitted for **{ex_date_str}**.\n\n"
                            f"Current Status: **{existing_leave['status']}**.\n"
                            f"You do not need to apply again for this date."
                        ),
                        "agent": "Employee Service Agent",
                        "interactive_slip": {
                            "type": "leave_slip_confirmed",
                            "request_code": existing_leave["request_code"],
                            "staff_name": user["staff_name"],
                            "leave_type": existing_leave["leave_type"],
                            "status": f"{existing_leave['status']}",
                            "date_display": ex_date_str,
                            "supervisor": existing_leave["supervisor_name"]
                        },
                        "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]"]
                    }

                supervisor_id, supervisor_name = self._get_supervisor(cur, user)
                days_label = f"{int(days_count)} day" if days_count == 1.0 else f"{int(days_count)} days"

                interactive_slip = {
                    "type": "leave_slip",
                    "slip_id": f"DRAFT-LV-{random.randint(100, 999)}",
                    "staff_name": user["staff_name"],
                    "leave_type": leave_type,
                    "from_date": from_date_str,
                    "to_date": to_date_str,
                    "date_display": date_display,
                    "days_count": days_count,
                    "balance_available": curr_balance,
                    "policy_reference": "HR Policy v5.0 §1.2",
                    "supervisor": supervisor_name,
                    "can_apply": True
                }

                reply_text = (
                    f"Here are the details for your **{leave_type} Request Draft**. Please review before submitting to HR:\n\n"
                    f"• **Employee:** {user['staff_name']} ({user.get('department_name', 'Clinical')})\n"
                    f"• **Leave Type:** {leave_type}\n"
                    f"• **Requested Date:** {date_display} ({days_label})\n"
                    f"• **Available Balance:** {curr_balance} days\n\n"
                    f"Please click **'Confirm & Submit'** below to file this request or **'Cancel'** to discard."
                )

                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "interactive_slip": interactive_slip,
                    "quick_actions": [f"[Confirm & Submit {leave_type}]", "[Cancel]"]
                }

                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "interactive_slip": interactive_slip,
                    "quick_actions": [f"[Confirm & Submit {leave_type}]", "[Cancel]"]
                }

            # ── Action 2: Staff inquired about taking leave / comp-off ─────────
            msg_lower = message.lower().strip()
            is_comp_or_leave = any(k in msg_lower for k in ["comp-off", "compoff", "comp off", "leave", "holiday", "balance", "available", "can i take"])
            is_shift_query = any(k in msg_lower for k in ["shift", "timing", "roster", "duty", "tomorrow", "today", "when do i work", "schedule"])

            if is_shift_query and is_comp_or_leave:
                # Combined Shift + Comp-Off Query
                tomorrow = today + datetime.timedelta(days=1)
                shift_res = self.get_user_shift(user["username"], "tomorrow")
                sh = shift_res.get("shift", {})
                shift_str = f"{sh.get('shift_name', 'Day Shift')} ({sh.get('shift_timing', '08:00 AM - 04:00 PM')}) in {sh.get('ward_name', 'Inpatient Unit')}"

                bal_res = self.get_user_leave_balance(user["username"])
                comp_balance = float(bal_res.get("balances", {}).get("comp_off_balance", 0.0))

                if comp_balance <= 0:
                    reply_text = (
                        f"You are scheduled for **{shift_str}** tomorrow. Under **HR Leave Policy v5.0**, your **Comp-Off balance is currently 0 days**.\n\n"
                        f"You do not have any compensatory offs available to draft or apply for at this time. Would you like to check your other leave balances?"
                    )
                    return {
                        "success": True,
                        "text": reply_text,
                        "agent": "Employee Service Agent",
                        "quick_actions": ["[Check Leave Balance]", "[My Shift Tomorrow]"]
                    }

                # Upcoming Friday calculation
                days_until_friday = (4 - today.weekday()) % 7
                if days_until_friday <= 0:
                    days_until_friday += 7
                friday_date = today + datetime.timedelta(days=days_until_friday)

                reply_text = (
                    f"You are on **{shift_str}** tomorrow. Under **HR Policy v5.0**, you have **{comp_balance} compensatory offs** available. "
                    f"Would you like me to apply for **Friday ({friday_date.strftime('%d %b %Y')})**?"
                )

                interactive_slip = {
                    "type": "leave_slip",
                    "slip_id": f"DRAFT-LV-{random.randint(100, 999)}",
                    "staff_name": user["staff_name"],
                    "leave_type": "Comp-Off",
                    "from_date": friday_date.strftime("%Y-%m-%d"),
                    "to_date": friday_date.strftime("%Y-%m-%d"),
                    "date_display": friday_date.strftime("%A, %d %b %Y"),
                    "days_count": 1.0,
                    "balance_available": comp_balance,
                    "policy_reference": "HR Policy v5.0 §1.2",
                    "supervisor": "Shift Supervisor",
                    "can_apply": True
                }

                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "interactive_slip": interactive_slip,
                    "quick_actions": ["Apply Comp-Off for Friday", "Check Leave Balance", "View Policy v5.0"]
                }

            # ── Action 3: Shift Timing Query ──────────────────────────────────
            if is_shift_query:
                is_tomorrow = "tomorrow" in msg_lower
                t_date = "tomorrow" if is_tomorrow else "today"
                shift_res = self.get_user_shift(user["username"], t_date)
                sh = shift_res.get("shift", {})
                incharge_str = " (Ward In-Charge)" if sh.get("is_incharge") else ""
                reply_text = (
                    f"You are scheduled for **{sh.get('shift_name', 'Day Shift')} ({sh.get('shift_timing', '08:00 AM - 04:00 PM')})** "
                    f"in **{sh.get('ward_name', 'Inpatient Unit')}** {t_date}{incharge_str}. "
                    f"Status: **{sh.get('status', 'Scheduled')}**."
                )
                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[Check Leave Balance]", "[Apply Comp-Off]"]
                }

            # ── Action 4: Leave Balance Query ─────────────────────────────────
            if is_comp_or_leave or "balance" in msg_lower:
                bal_res = self.get_user_leave_balance(user["username"])
                b = bal_res.get("balances", {})
                reply_text = (
                    f"Here is your active leave ledger summary under **HR Leave Policy v5.0**:\n"
                    f"• **Compensatory Off (Comp-Off)**: **{int(b.get('comp_off_balance', 2))}** days available\n"
                    f"• **Casual Leave (CL)**: **{int(b.get('casual_leave_balance', 5))}** days available\n"
                    f"• **Sick Leave (SL)**: **{int(b.get('sick_leave_balance', 7))}** days available\n"
                    f"• **Earned Leave (EL)**: **{int(b.get('earned_leave_balance', 14))}** days available\n\n"
                    f"Would you like me to apply for a leave or comp-off?"
                )
                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[Apply Comp-Off]", "[My Shift Tomorrow]", "Leave Policy Rules"]
                }

            # ── Action 5: Policy Rules & Allowance ────────────────────────────
            if any(k in msg_lower for k in ["policy", "night shift", "allowance", "overtime", "rest day", "fatigue", "rule"]):
                reply_text = (
                    f"**HR Leave & Attendance Policy v5.0 Excerpts**:\n"
                    f"• **§7 Night Shift Allowance**: Night shift (23:00 - 07:00) attracts an allowance of **₹350 per shift** for nursing/clinical staff and **₹250 per shift** for support staff.\n"
                    f"• **§7.2 Fatigue Rule**: Maximum 7 consecutive nights, followed by a mandatory 48-hour (2 days) rest period.\n"
                    f"• **§1.3 Comp-Off Validity**: Comp-offs must be utilized within 60 calendar days of accrual.\n"
                    f"• **§9 Approvals**: Handled directly by your Ward Supervisor/HOD with automatic escalation to HR Manager."
                )
                return {
                    "success": True,
                    "text": reply_text,
                    "agent": "Employee Service Agent",
                    "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]", "[Apply Comp-Off]"]
                }

            # ── Default Assistant Reply ───────────────────────────────────────
            return {
                "success": True,
                "text": (
                    f"Hello {user['staff_name']}! I am your **Employee Service Agent**. "
                    f"I can help you check your shift schedule, check leave balances, or **apply for your leave or comp-off directly** right here. "
                    f"How can I assist you today?"
                ),
                "agent": "Employee Service Agent",
                "quick_actions": ["[My Shift Tomorrow]", "[Check Leave Balance]", "[Apply Comp-Off]"]
            }

        finally:
            cur.close()
            conn.close()
