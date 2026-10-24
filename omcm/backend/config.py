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

def require_admin(credentials: HTTPBasicCredentials | None = Depends(security)):
    username, password = os.getenv("OMCM_ADMIN_USERNAME", ""), os.getenv("OMCM_ADMIN_PASSWORD", "")
    if os.getenv("OMCM_DEMO_AUTH", "false").lower() != "true" or not username or len(password) < 12:
        raise HTTPException(503, "Demo administrator access is disabled. Configure server-side credentials (password at least 12 characters).")
    if credentials is None:
        raise HTTPException(401, "Administrator sign-in required.", headers={"WWW-Authenticate": "Basic"})
    correct_user = secrets.compare_digest(credentials.username.encode(), username.encode())
    correct_password = secrets.compare_digest(credentials.password.encode(), password.encode())
    if not (correct_user and correct_password):
        raise HTTPException(401, "Invalid administrator credentials.", headers={"WWW-Authenticate": "Basic"})
    return username
