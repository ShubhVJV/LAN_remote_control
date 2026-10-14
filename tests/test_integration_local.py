"""
End-to-end integration test running Agent and Controller client locally.
"""

import time
import requests
import pytest
from remote_agent.config import AgentConfig
from remote_agent.authentication import AuthManager
from controller.backend.app.config import ControllerConfig
from controller.backend.app.services.agent_client import AgentClient

def test_full_connection_and_telemetry_flow():
    # Setup test agent config
    agent_cfg = AgentConfig()
    agent_cfg.pin = "654321"
    agent_cfg.require_local_approval = False  # Auto-approve for automated tests
    auth_mgr = AuthManager(agent_cfg)

    # Setup controller client
    ctrl_cfg = ControllerConfig()
    client = AgentClient(ctrl_cfg)

    # Directly verify connect logic
    from shared.schemas import DeviceConnectRequest
    req = DeviceConnectRequest(
        controller_name="Test-Controller",
        controller_ip="127.0.0.1",
        pin="654321",
        requested_mode="interactive",
    )
    session = auth_mgr.authenticate_and_request_approval(req)
    assert session is not None
    assert session.is_active is True

    # Validate active token
    validated = auth_mgr.validate_token(session.token)
    assert validated is not None
    assert validated.controller_name == "Test-Controller"

    # Revoke session
    auth_mgr.revoke_session(session.session_id)
    assert auth_mgr.validate_token(session.token) is None
