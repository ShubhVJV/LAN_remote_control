"""
Tests for Authentication and Session Approval.
"""

import time
import pytest
from remote_agent.config import AgentConfig
from remote_agent.authentication import AuthManager
from shared.schemas import DeviceConnectRequest

def test_auth_wrong_pin():
    config = AgentConfig()
    config.pin = "998877"
    config.require_local_approval = False
    auth = AuthManager(config)

    req = DeviceConnectRequest(
        controller_name="Controller-1",
        controller_ip="192.168.1.10",
        pin="000000",  # Incorrect PIN
        requested_mode="interactive",
    )
    session = auth.authenticate_and_request_approval(req)
    assert session is None

def test_auth_success_and_token_validation():
    config = AgentConfig()
    config.pin = "123456"
    config.require_local_approval = False
    auth = AuthManager(config)

    req = DeviceConnectRequest(
        controller_name="Controller-A",
        controller_ip="192.168.1.50",
        pin="123456",
        requested_mode="interactive",
    )
    session = auth.authenticate_and_request_approval(req)
    assert session is not None
    assert session.is_active is True
    assert session.controller_name == "Controller-A"
    assert len(session.token) == 64  # 32 bytes in hex

    # Validate valid token
    validated = auth.validate_token(session.token)
    assert validated is not None
    assert validated.session_id == session.session_id

    # Validate nonexistent token
    assert auth.validate_token("invalid-fake-token") is None

def test_session_revocation():
    config = AgentConfig()
    config.pin = "123456"
    config.require_local_approval = False
    auth = AuthManager(config)

    req = DeviceConnectRequest(
        controller_name="Controller-B",
        controller_ip="192.168.1.51",
        pin="123456",
        requested_mode="view_only",
    )
    session = auth.authenticate_and_request_approval(req)
    assert session is not None

    # Revoke session
    auth.revoke_session(session.session_id)
    assert auth.validate_token(session.token) is None
    assert session.is_active is False
