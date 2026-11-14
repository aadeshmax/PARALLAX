import os
import pytest
from app.auth.earthdata import auth_manager
from app.config import settings

def test_earthdata_credential_security():
    """Validates that Earthdata authentication never leaks raw secrets or passwords."""
    status = auth_manager.authenticate()
    status_str = str(status)

    # Strictly assert that password is not present in output
    if settings.EARTHDATA_PASSWORD:
        assert settings.EARTHDATA_PASSWORD not in status_str

    assert "authenticated" in status
    assert "status" in status
    assert "error_message" in status

    # Verify masking
    masked = status.get("username_masked")
    if masked:
        assert "***" in masked

def test_earthdata_mask_utility():
    assert auth_manager.mask_string(None) == "none"
    assert auth_manager.mask_string("") == "none"
    assert auth_manager.mask_string("abc") == "***"
    assert auth_manager.mask_string("secretuser") == "se***r"

def test_earthdata_invalid_credential_handling():
    """Verifies that invalid credentials result in structured status without crashing."""
    status = auth_manager.authenticate(force_refresh=True)
    assert status["status"] in ["authenticated", "credentials_failed", "unconfigured"]
    assert "demo_fallback_active" in status
