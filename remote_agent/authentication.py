"""
Authentication and session management for Remote Agent.
"""

import time
import secrets
from typing import Dict, Optional
from shared.schemas import SessionInfo, DeviceConnectRequest
from shared.protocol import SESSION_TIMEOUT, APPROVAL_TIMEOUT, MODE_INTERACTIVE, MODE_VIEW_ONLY
from remote_agent.approval_ui import ApprovalUI

class AuthManager:
    def __init__(self, config):
        self.config = config
        self.approval_ui = ApprovalUI()
        # session_id -> SessionInfo
        self.sessions: Dict[str, SessionInfo] = {}
        # token -> session_id
        self.token_to_session: Dict[str, str] = {}
        self.active_session_id: Optional[str] = None
        self.on_session_revoked = None

    def authenticate_and_request_approval(self, req: DeviceConnectRequest) -> Optional[SessionInfo]:
        """
        Verify PIN and prompt remote user for explicit interactive approval.
        """
        # 1. Verify PIN
        if req.pin != self.config.pin:
            print(f"[Auth] Rejected: Invalid PIN from {req.controller_name} ({req.controller_ip})")
            return None

        # 2. Check local approval if configured
        if self.config.require_local_approval:
            print(f"[Auth] Prompting remote user for approval: {req.controller_name} ({req.controller_ip}) - Mode: {req.requested_mode}")
            approved = self.approval_ui.prompt_approval(
                controller_name=req.controller_name,
                controller_ip=req.controller_ip,
                mode=req.requested_mode,
                timeout_seconds=int(APPROVAL_TIMEOUT)
            )
            if not approved:
                print(f"[Auth] Rejected by remote user: {req.controller_name}")
                return None

        # If there's an existing active session, revoke it cleanly
        if self.active_session_id:
            self.revoke_session(self.active_session_id)

        # 3. Create session
        session_id = secrets.token_hex(16)
        token = secrets.token_hex(32)
        now = time.time()
        session = SessionInfo(
            session_id=session_id,
            token=token,
            device_id=self.config.device_id,
            device_name=self.config.device_name,
            controller_name=req.controller_name,
            controller_ip=req.controller_ip,
            mode=req.requested_mode,
            created_at=now,
            expires_at=now + SESSION_TIMEOUT,
            is_active=True
        )

        self.sessions[session_id] = session
        self.token_to_session[token] = session_id
        self.active_session_id = session_id

        # Show on-screen floating banner on Computer B
        self.approval_ui.show_active_banner(
            controller_name=req.controller_name,
            controller_ip=req.controller_ip,
            on_disconnect=lambda: self.revoke_session(session_id)
        )

        print(f"[Auth] Session granted: ID={session_id} to {req.controller_name}")
        return session

    def validate_token(self, token: Optional[str]) -> Optional[SessionInfo]:
        """Validate token and check expiration."""
        if not token:
            return None
        session_id = self.token_to_session.get(token)
        if not session_id:
            return None
        session = self.sessions.get(session_id)
        if not session or not session.is_active:
            return None
        if time.time() > session.expires_at:
            self.revoke_session(session_id)
            return None
        return session

    def revoke_session(self, session_id: str):
        """Terminate an active session."""
        session = self.sessions.get(session_id)
        if session:
            session.is_active = False
            token = session.token
            if token in self.token_to_session:
                del self.token_to_session[token]
            if self.active_session_id == session_id:
                self.active_session_id = None
            self.approval_ui.hide_active_banner()
            print(f"[Auth] Revoked session ID={session_id}")
            if self.on_session_revoked:
                try:
                    self.on_session_revoked(session_id)
                except Exception as e:
                    print(f"[Auth] Error in on_session_revoked callback: {e}")
