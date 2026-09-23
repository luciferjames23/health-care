import time
import random
import os
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
import db_config
import psycopg2.extras
from api.auth_helper import verify_password, get_hashed_password, encode_token, require_radiologist
from utils.email_service import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory store for OTPs: { username_or_phone: {"otp": "123456", "expires_at": timestamp, "user_id": int} }
OTP_STORE = {}

class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "doctor"

class RequestOTPRequest(BaseModel):
    identifier: str  # Username, Phone, or Email

class ResetPasswordWithOTPRequest(BaseModel):
    identifier: str
    otp: str
    new_password: str

@router.get("/users")
def get_auth_users():
    """
    Returns dynamic users and roles fetched directly from PostgreSQL database `users` table.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("""
            SELECT 
                u.id,
                u.username,
                r.name as role,
                COALESCE(d.display_name, u.staff_name, CONCAT(u.first_name, ' ', u.last_name)) as name,
                COALESCE(dept.department_name, u.staff_type, r.name) as dept,
                COALESCE(d.specialization, dept.department_name, u.staff_type, 'General Medicine') as specialization,
                COALESCE(d.specialization, u.staff_type, r.name) as title,
                u.email
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctors d ON d.user_id = u.id
            LEFT JOIN departments dept ON u.department_id = dept.id
            WHERE u.is_active = true
            ORDER BY 
                CASE 
                    WHEN LOWER(r.name) = 'admin' THEN 1
                    WHEN LOWER(r.name) = 'doctor' THEN 2
                    ELSE 3
                END,
                u.id ASC;
        """)
        rows = cur.fetchall()
        return {
            "success": True, 
            "count": len(rows),
            "users": [dict(r) for r in rows]
        }
    finally:
        cur.close()
        conn.close()

@router.post("/login")
def login(body: LoginRequest):
    """
    Authenticate username/password and return standard signed JWT token.
    Supports role matching for both ADMIN and DOCTOR accounts.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.password_hash, u.is_active, r.name as role_name, u.phone, u.email
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE LOWER(u.username) = LOWER(%s);
        """, (body.username,))
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=401, detail="Invalid username. Please check your credentials.")
            
        user_id, username, password_hash, is_active, role_name, phone, email = row
        
        if not is_active:
            raise HTTPException(status_code=401, detail="This account has been deactivated.")
            
        if not str(password_hash or "").startswith(("$2a$", "$2b$", "$2y$")):
            raise HTTPException(status_code=401, detail="This account needs a password reset. Contact your hospital administrator.")
        is_password_valid = verify_password(body.password, password_hash)
        if not is_password_valid:
            raise HTTPException(status_code=401, detail="Invalid password. Please try again.")
            
        actual_role = role_name.upper()
            
        doctor_id = None
        department_name = None
        display_name = "Administrator" if actual_role == "ADMIN" else "Doctor"
        
        if actual_role in {"DOCTOR", "RADIOLOGIST"}:
            cur.execute("""
                SELECT d.id, d.display_name, dept.department_name
                FROM doctors d
                JOIN departments dept ON d.department_id = dept.id
                WHERE d.user_id = %s;
            """, (user_id,))
            doc_row = cur.fetchone()
            if doc_row:
                doctor_id, display_name, department_name = doc_row
                
        token_payload = {
            "user_id": user_id,
            "username": username,
            "role": actual_role,
            "auth_method": "password",
            "doctor_id": doctor_id
        }
        token = encode_token(token_payload)
        
        cur.execute("""
            UPDATE users 
            SET last_login_at = CURRENT_TIMESTAMP 
            WHERE id = %s;
        """, (user_id,))
        conn.commit()
        
        return {
            "success": True,
            "token": token,
            "user": {
                "username": username,
                "role": role_name,
                "canAccessRadiology": actual_role == "RADIOLOGIST",
                "name": display_name,
                "department": department_name,
                "doctorId": doctor_id,
                "loginId": username
            }
        }
        
    finally:
        cur.close()
        conn.close()

@router.post("/forgot-password/request-otp")
def request_otp(body: RequestOTPRequest):
    """
    Generate & dispatch 6-digit OTP to Doctor's registered phone / email for password recovery.
    """
    ident = body.identifier.strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Username, Phone, or Email is required.")

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Search in doctors & users table
        cur.execute("""
            SELECT u.id, u.username, u.phone, u.email, d.display_name, d.email as doc_email, d.phone as doc_phone
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctors d ON d.user_id = u.id
            WHERE r.name = 'DOCTOR' AND (
                LOWER(u.username) = LOWER(%s) OR
                u.phone = %s OR
                LOWER(u.email) = LOWER(%s) OR
                d.phone = %s OR
                LOWER(d.email) = LOWER(%s)
            );
        """, (ident, ident, ident, ident, ident))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="No doctor account found with the provided details.")

        user_id, username, user_phone, user_email, doc_name, doc_email, doc_phone = row
        target_email = doc_email or user_email
        target_phone = doc_phone or user_phone
        display_name = doc_name or username

        # Generate 6-digit OTP
        otp_code = f"{random.randint(100000, 999999)}"
        expires_at = time.time() + 600  # 10 minutes

        OTP_STORE[username.lower()] = {
            "otp": otp_code,
            "expires_at": expires_at,
            "user_id": user_id,
            "phone": target_phone,
            "email": target_email
        }

        # Send via email (and print to console/log)
        if target_email:
            send_otp_email(target_email, display_name, otp_code)

        print(f"\n[OTP GENERATED] For {username} ({target_phone} / {target_email}): OTP = {otp_code}\n")

        masked_phone = f"******{target_phone[-4:]}" if target_phone and len(target_phone) >= 4 else "registered phone"
        masked_email = f"***@{target_email.split('@')[-1]}" if target_email and "@" in target_email else "registered email"

        return {
            "success": True,
            "message": f"OTP sent to registered phone ({masked_phone}) & email ({masked_email}). Valid for 10 minutes.",
            "username": username
        }

    finally:
        cur.close()
        conn.close()

@router.post("/forgot-password/reset-password")
def reset_password(body: ResetPasswordWithOTPRequest):
    """
    Verify OTP and update password for Doctor account.
    """
    ident = body.identifier.strip().lower()
    otp_code = body.otp.strip()
    new_password = body.new_password

    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    # Find matching OTP entry
    matched_key = None
    stored_data = None

    for key, data in OTP_STORE.items():
        if key == ident or data.get("phone") == ident or (data.get("email") and data.get("email").lower() == ident):
            matched_key = key
            stored_data = data
            break

    if not stored_data:
        raise HTTPException(status_code=400, detail="No active OTP request found. Please request a new OTP.")

    if time.time() > stored_data["expires_at"]:
        OTP_STORE.pop(matched_key, None)
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    if stored_data["otp"] != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please check and try again.")

    user_id = stored_data["user_id"]
    new_hash = get_hashed_password(new_password)

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE users
            SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (new_hash, user_id))
        conn.commit()

        # Clear used OTP
        OTP_STORE.pop(matched_key, None)

        return {"success": True, "message": "Password reset successfully. You can now log in with your new password."}
    finally:
        cur.close()
        conn.close()

@router.post("/logout")
def logout():
    """Logout endpoint. Clears token on client side."""
    return {"success": True, "detail": "Logged out successfully"}


@router.get("/radiology-access")
def radiology_access(user: dict = Depends(require_radiologist)):
    return {"allowed": True, "user": user}


class AccountSelectionRequest(BaseModel):
    username: str


@router.post("/select-account")
def select_account(body: AccountSelectionRequest, request: Request):
    """Password-free account selection for local or explicitly enabled test access."""
    client_is_local = bool(request.client and request.client.host in {"127.0.0.1", "::1"})
    origin = request.headers.get("origin", "") if "headers" in request.scope else ""
    origin_host = (urlparse(origin).hostname or "").lower()
    temporary_cloudflare_test = (
        os.getenv("ALLOW_TEMPORARY_CLOUDFLARE_LOGIN", "false").lower() == "true"
        and origin_host.endswith(".trycloudflare.com")
    )
    if not client_is_local and not temporary_cloudflare_test:
        raise HTTPException(status_code=403, detail="Account selection is available only on this computer.")
    with db_config.get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, r.name,
                       COALESCE(d.display_name, u.staff_name, u.username),
                       dept.department_name, d.id, d.specialization
                FROM users u JOIN roles r ON r.id=u.role_id
                LEFT JOIN doctors d ON d.user_id=u.id
                LEFT JOIN departments dept ON dept.id=COALESCE(d.department_id,u.department_id)
                WHERE lower(u.username)=lower(%s) AND u.is_active=true
            """, (body.username.strip(),))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=403, detail="This account is unavailable or inactive.")
            uid, username, role, name, department, doctor_id, specialization = row
            token = encode_token({"user_id":uid,"username":username,"role":role,"doctor_id":doctor_id,"auth_method":"account_selection"})
            cur.execute("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=%s", (uid,))
            conn.commit()
    return {"success":True,"token":token,"user":{
        "username":username,"role":role,"name":name,"department":department,
        "specialization":specialization,"doctorId":doctor_id,"loginId":username,
        "canAccessRadiology":role.strip().lower()=="radiologist",
    }}
