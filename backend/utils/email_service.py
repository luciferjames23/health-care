"""
email_service.py
================
Email notification service for appointment confirmations, OTP codes, and welcome emails.
Gracefully handles SMTP dispatch with console logging fallback.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", os.getenv("SMTP_PASS", ""))
SENDER_EMAIL = os.getenv("SMTP_FROM_EMAIL", os.getenv("SENDER_EMAIL", SMTP_USER or "noreply@meridianhospital.com"))

def send_email(to_email: str, subject: str, body_html: str) -> bool:
    """Dispatches HTML email via SMTP or logs to console if unconfigured."""
    if not to_email:
        return False
    print(f"[EMAIL_DISPATCH] To: {to_email} | Subject: {subject}")
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL_MOCK] SMTP credentials not set. Simulated email dispatch to {to_email}.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
        print(f"[EMAIL_SUCCESS] Sent email to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL_ERROR] Failed to send email to {to_email}: {e}")
        return False


def send_appointment_notification_email(doctor_email: str, appointment_details: dict) -> bool:
    subject = f"New Patient Appointment Notification - {appointment_details.get('patient_name', 'Patient')}"
    body = f"<h2>New Appointment Scheduled</h2><p>Patient: {appointment_details.get('patient_name')}</p><p>Date: {appointment_details.get('date')} at {appointment_details.get('time')}</p>"
    return send_email(doctor_email, subject, body)


def send_patient_appointment_confirmation_email(patient_email: str, appointment_details: dict) -> bool:
    subject = "Appointment Confirmation - Meridian Hospital"
    body = f"<h2>Your Appointment is Confirmed</h2><p>Doctor: {appointment_details.get('doctor_name')}</p><p>Date: {appointment_details.get('date')} at {appointment_details.get('time')}</p>"
    return send_email(patient_email, subject, body)


def send_otp_email(to_email: str, display_name: str, otp_code: str) -> bool:
    """Send OTP email for password reset. Accepts display_name for personalized greeting."""
    subject = "Your Authentication OTP Code — Meridian Hospital"
    body = (
        f"<h2>Meridian Hospital Verification</h2>"
        f"<p>Hello {display_name},</p>"
        f"<p>Your OTP code is: <strong>{otp_code}</strong></p>"
        f"<p>Valid for 10 minutes.</p>"
    )
    return send_email(to_email, subject, body)


def send_welcome_email(to_email: str, user_name: str) -> bool:
    subject = "Welcome to Meridian Hospital Management Portal"
    body = f"<h2>Welcome {user_name}!</h2><p>Your account has been activated on the Hospital Management Platform.</p>"
    return send_email(to_email, subject, body)
