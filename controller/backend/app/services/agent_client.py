"""
Agent Client and Proxy Service for Controller.
Communicates with the active Remote Agent on the LAN.
"""

import time
import requests
from typing import Optional, Dict, Any, Tuple
from shared.schemas import SessionInfo

class AgentClient:
    def __init__(self, config):
        self.config = config
        self.active_ip: Optional[str] = None
        self.active_port: Optional[int] = None
        self.session: Optional[SessionInfo] = None
        self.connected_at: Optional[float] = None
        self.last_heartbeat: Optional[float] = None

    @property
    def is_connected(self) -> bool:
        return self.session is not None and self.session.is_active

    @property
    def base_url(self) -> str:
        if not self.active_ip or not self.active_port:
            return ""
        return f"http://{self.active_ip}:{self.active_port}"

    @property
    def auth_headers(self) -> Dict[str, str]:
        if not self.session:
            return {}
        return {"Authorization": f"Bearer {self.session.token}"}

    def connect(self, ip: str, port: int, pin: str, requested_mode: str = "interactive") -> Tuple[bool, str, Optional[SessionInfo]]:
        url = f"http://{ip}:{port}/api/auth/connect"
        payload = {
            "controller_name": self.config.controller_name,
            "controller_ip": self.config.controller_ip,
            "pin": pin,
            "requested_mode": requested_mode,
        }

        try:
            # Allow up to 35 seconds for the remote user to click Accept on Computer B
            resp = requests.post(url, json=payload, timeout=35.0)
            if resp.status_code == 200:
                data = resp.json()
                self.session = SessionInfo(**data)
                self.active_ip = ip
                self.active_port = port
                self.connected_at = time.time()
                self.last_heartbeat = time.time()
                return True, "Connected successfully", self.session
            elif resp.status_code == 403:
                return False, "Connection rejected by remote user or invalid PIN.", None
            else:
                return False, f"Connection failed (HTTP {resp.status_code}): {resp.text}", None
        except requests.exceptions.Timeout:
            return False, "Connection request timed out waiting for remote user approval.", None
        except Exception as e:
            return False, f"Network error connecting to {ip}:{port}: {e}", None

    def disconnect(self) -> Tuple[bool, str]:
        if not self.is_connected:
            return True, "Not connected"

        url = f"{self.base_url}/api/auth/disconnect"
        try:
            requests.post(url, headers=self.auth_headers, timeout=3.0)
        except Exception:
            pass
        finally:
            self.session = None
            self.active_ip = None
            self.active_port = None
            self.connected_at = None

        return True, "Disconnected successfully"

    def get_connection_status(self) -> Dict[str, Any]:
        if not self.is_connected:
            return {
                "is_connected": False,
                "device_id": None,
                "device_name": None,
                "ip": None,
                "port": None,
                "mode": None,
                "duration_seconds": 0,
                "connected_at": None,
            }

        duration = int(time.time() - self.connected_at) if self.connected_at else 0
        return {
            "is_connected": True,
            "device_id": self.session.device_id,
            "device_name": self.session.device_name,
            "ip": self.active_ip,
            "port": self.active_port,
            "mode": self.session.mode,
            "duration_seconds": duration,
            "connected_at": self.connected_at,
            "token": self.session.token,
        }

    def get_metrics(self) -> Optional[dict]:
        if not self.is_connected:
            return None
        url = f"{self.base_url}/api/metrics"
        try:
            resp = requests.get(url, headers=self.auth_headers, timeout=2.5)
            if resp.status_code == 200:
                self.last_heartbeat = time.time()
                return resp.json()
            elif resp.status_code == 401:
                # Session expired on remote
                self.disconnect()
                return None
        except Exception:
            pass
        return None

    def list_files(self, path: str = "") -> Optional[dict]:
        if not self.is_connected:
            return None
        url = f"{self.base_url}/api/files/list"
        try:
            resp = requests.get(url, params={"path": path}, headers=self.auth_headers, timeout=5.0)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    def delete_file(self, path: str) -> Tuple[bool, str]:
        if not self.is_connected:
            return False, "Not connected"
        url = f"{self.base_url}/api/files/delete"
        try:
            resp = requests.delete(url, params={"path": path}, headers=self.auth_headers, timeout=5.0)
            if resp.status_code == 200:
                return True, "File deleted"
            return False, resp.text
        except Exception as e:
            return False, str(e)

    def list_apps(self) -> Optional[dict]:
        if not self.is_connected:
            return None
        url = f"{self.base_url}/api/apps"
        try:
            resp = requests.get(url, headers=self.auth_headers, timeout=3.0)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return None

    def launch_app(self, app_id: str) -> Tuple[bool, str]:
        if not self.is_connected:
            return False, "Not connected"
        url = f"{self.base_url}/api/apps/launch/{app_id}"
        try:
            resp = requests.post(url, headers=self.auth_headers, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("success", False), data.get("message", "")
            return False, resp.text
        except Exception as e:
            return False, str(e)
