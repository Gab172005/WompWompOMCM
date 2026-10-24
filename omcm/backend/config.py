"""Environment and shared authentication dependencies."""
import os
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import dotenv_values
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials

def load_environment(paths=None):
    """Process settings win; nonempty backend settings precede project settings.

    Empty placeholders in backend/.env must not hide the key in omcm/.env.
    """
    root = Path(__file__).resolve().parent
    for path in paths or (root / ".env", root.parent / ".env"):
        for key, value in dotenv_values(path, encoding="utf-8-sig").items():
            if value and not os.getenv(key):
                os.environ[key] = value


load_environment()
MANILA = timezone(timedelta(hours=8))
security = HTTPBasic(auto_error=False)
def today():
    return datetime.now(MANILA).date()


def admin_configuration():
    """Public readiness checks only. Never return credential values or length."""
    enabled = os.getenv("OMCM_DEMO_AUTH", "false").strip().lower() == "true"
    username_set = bool(os.getenv("OMCM_ADMIN_USERNAME", "").strip())
    password = os.getenv("OMCM_ADMIN_PASSWORD", "")
    password_set = bool(password)
    password_valid = len(password) >= 12
    issues = []
    if not enabled:
        issues.append("Set OMCM_DEMO_AUTH to true in the backend environment (without quotes).")
    if not username_set:
        issues.append("Set a nonempty OMCM_ADMIN_USERNAME in the backend environment.")
    if not password_set:
        issues.append("Set OMCM_ADMIN_PASSWORD in the backend environment.")
    elif not password_valid:
        issues.append("OMCM_ADMIN_PASSWORD must contain at least 12 characters.")
    return {
        "configured": not issues,
        "demo_auth_enabled": enabled,
        "username_configured": username_set,
        "password_configured": password_set,
        "password_minimum_met": password_valid,
        "issues": issues,
    }


def require_admin(credentials: HTTPBasicCredentials | None = Depends(security)):
    configuration = admin_configuration()
    username, password = os.getenv("OMCM_ADMIN_USERNAME", "").strip(), os.getenv("OMCM_ADMIN_PASSWORD", "")
    if not configuration["configured"]:
        raise HTTPException(503, "Demo administrator access is disabled. " + " ".join(configuration["issues"]))
    if credentials is None:
        raise HTTPException(401, "Administrator sign-in required.", headers={"WWW-Authenticate": "Basic"})
    correct_user = secrets.compare_digest(credentials.username.encode(), username.encode())
    correct_password = secrets.compare_digest(credentials.password.encode(), password.encode())
    if not (correct_user and correct_password):
        raise HTTPException(401, "Invalid administrator credentials.", headers={"WWW-Authenticate": "Basic"})
    return username
