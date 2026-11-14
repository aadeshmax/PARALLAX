import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import earthaccess

# Resolve absolute path to root .env
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"

env_found = env_path.exists()
if env_found:
    load_dotenv(dotenv_path=str(env_path), override=True)

username = os.getenv("EARTHDATA_USERNAME", "").strip()
password = os.getenv("EARTHDATA_PASSWORD", "").strip()

username_configured = bool(username and username != "your_username_here")
password_configured = bool(password and password != "your_password_here")

# Mask username for sanitized output
masked_user = f"{username[:2]}***{username[-1]}" if len(username) >= 3 else "***"

auth_success = False
sanitized_error = "None"

if username_configured and password_configured:
    # Set explicit environment variables for earthaccess
    os.environ["EARTHDATA_USERNAME"] = username
    os.environ["EARTHDATA_PASSWORD"] = password
    try:
        auth = earthaccess.login(strategy="environment", persist=False)
        auth_success = bool(auth.authenticated)
        if not auth_success:
            sanitized_error = "earthaccess returned authenticated=False"
    except earthaccess.exceptions.LoginAttemptFailure as exc:
        auth_success = False
        # Sanitize error message to avoid printing passwords
        exc_msg = str(exc)
        if "invalid_credentials" in exc_msg.lower():
            sanitized_error = 'NASA EDL URS Error: {"error":"invalid_credentials","error_description":"Invalid user credentials"}'
        else:
            sanitized_error = f"LoginAttemptFailure: {type(exc).__name__}"
    except Exception as exc:
        auth_success = False
        sanitized_error = f"{type(exc).__name__}: Connection/protocol error"
else:
    sanitized_error = "Credentials missing or unpopulated in .env"

print("--- ISOLATED AUTHENTICATION REPORT ---")
print(f"Environment file found: {'YES' if env_found else 'NO'}")
print(f"Username configured: {'YES' if username_configured else 'NO'}")
print(f"Password configured: {'YES' if password_configured else 'NO'}")
print(f"Authentication successful: {'YES' if auth_success else 'NO'}")
print(f"Sanitized error response: {sanitized_error}")
print(f"Target .env path: {env_path}")
print(f"Masked user: {masked_user}")
print("---------------------------------------")
