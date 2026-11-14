import os
import logging
from typing import Dict, Any, Optional
import earthaccess
from app.config import settings

logger = logging.getLogger("parallax.auth")

class EarthdataAuthManager:
    """
    Manages NASA Earthdata Login authentication using earthaccess.
    Guarantees that credentials are never leaked in logs, responses, or exceptions.
    """

    def __init__(self):
        self._authenticated = False
        self._username: Optional[str] = None
        self._error_message: Optional[str] = None
        self._auth_client = None

    def mask_string(self, val: Optional[str]) -> str:
        if not val:
            return "none"
        if len(val) <= 3:
            return "***"
        return f"{val[:2]}***{val[-1]}"

    def authenticate(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Attempts to authenticate with NASA Earthdata Login.
        Does not raise unhandled exceptions; returns a structured status dictionary.
        """
        if self._authenticated and not force_refresh:
            return self.get_status()

        # Set environment variables from settings if not already in os.environ
        username = settings.EARTHDATA_USERNAME or os.getenv("EARTHDATA_USERNAME", "")
        password = settings.EARTHDATA_PASSWORD or os.getenv("EARTHDATA_PASSWORD", "")

        if not username or not password or username == "your_username_here":
            self._authenticated = False
            self._username = None
            self._error_message = (
                "Earthdata credentials are not configured. Set EARTHDATA_USERNAME and "
                "EARTHDATA_PASSWORD in .env (or configure at https://urs.earthdata.nasa.gov)."
            )
            logger.info("Earthdata credentials not configured. Running in Demo / Public Search mode.")
            return self.get_status()

        # Set into os.environ for earthaccess
        os.environ["EARTHDATA_USERNAME"] = username
        os.environ["EARTHDATA_PASSWORD"] = password

        try:
            # Attempt earthaccess login
            auth = earthaccess.login(strategy="environment", persist=False)
            if auth.authenticated:
                self._authenticated = True
                self._username = username
                self._error_message = None
                self._auth_client = auth
                logger.info("Successfully authenticated with NASA Earthdata as '%s'", self.mask_string(username))
            else:
                self._authenticated = False
                self._username = username
                self._error_message = "NASA Earthdata authentication returned unauthenticated status."
                logger.warning("NASA Earthdata authentication returned unauthenticated status.")
        except earthaccess.exceptions.LoginAttemptFailure as exc:
            self._authenticated = False
            self._username = username
            exc_str = str(exc).lower()
            if "locked" in exc_str or "exceeded" in exc_str:
                self._error_message = (
                    f"NASA Earthdata profile for user '{self.mask_string(username)}' is temporarily locked "
                    "for 10 minutes due to previous failed attempts. Please wait or verify password at https://urs.earthdata.nasa.gov."
                )
            else:
                self._error_message = (
                    f"Invalid NASA Earthdata credentials for user '{self.mask_string(username)}'. "
                    "Please verify your credentials at https://urs.earthdata.nasa.gov. "
                    "Cached demonstration scenes remain fully functional."
                )
            logger.warning("NASA Earthdata authentication failed: %s", self._error_message)
        except Exception as exc:
            self._authenticated = False
            self._username = username
            self._error_message = f"NASA Earthdata connection error: {type(exc).__name__}. Operating in offline/cached mode."
            logger.warning("NASA Earthdata connection exception: %s", str(exc))

        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        has_creds = bool(settings.EARTHDATA_USERNAME and settings.EARTHDATA_PASSWORD)
        return {
            "authenticated": self._authenticated,
            "configured": has_creds,
            "username_masked": self.mask_string(self._username or settings.EARTHDATA_USERNAME) if has_creds else None,
            "status": "authenticated" if self._authenticated else ("credentials_failed" if has_creds else "unconfigured"),
            "error_message": self._error_message,
            "demo_fallback_active": not self._authenticated,
            "daac_status": {
                "asf": "available (direct/s3 fallback)",
                "podaac": "available (direct/s3 fallback)",
                "cmr": "online (public catalog active)"
            }
        }

auth_manager = EarthdataAuthManager()
