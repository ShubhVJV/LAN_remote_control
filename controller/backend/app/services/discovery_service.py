"""
LAN Device Discovery Service for Controller.
Listens for agent heartbeats and sends discovery probes.
"""

import time
import json
import socket
import threading
import requests
from typing import Dict, List, Any, Optional
from shared.protocol import (
    MAGIC_DISCOVERY_HEADER,
    MSG_DISCOVERY_BROADCAST,
    MSG_DISCOVERY_PROBE,
    MSG_DISCOVERY_RESPONSE,
    DISCOVERY_BROADCAST_PORT,
    DEVICE_OFFLINE_TIMEOUT,
)

class DiscoveredDevice:
    def __init__(self, data: dict):
        self.device_id: str = data.get("device_id", "")
        self.device_name: str = data.get("device_name", "Unknown Device")
        self.hostname: str = data.get("hostname", "")
        self.ip: str = data.get("ip", "")
        self.port: int = data.get("port", 8000)
        self.os_info: str = data.get("os_info", "Unknown OS")
        self.capabilities: List[str] = data.get("capabilities", [])
        self.last_seen: float = time.time()
        self.status: str = "online"
        self.is_manual: bool = False

    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "hostname": self.hostname,
            "ip": self.ip,
            "port": self.port,
            "os_info": self.os_info,
            "capabilities": self.capabilities,
            "last_seen": self.last_seen,
            "status": self.status,
            "is_manual": self.is_manual,
            "seconds_since_seen": round(time.time() - self.last_seen, 1),
        }

class ControllerDiscoveryService:
    def __init__(self, discovery_port: int = DISCOVERY_BROADCAST_PORT):
        self.discovery_port = discovery_port
        self.devices: Dict[str, DiscoveredDevice] = {}
        self.running = False
        self.listen_thread: Optional[threading.Thread] = None
        self.cleanup_thread: Optional[threading.Thread] = None
        self.sock: Optional[socket.socket] = None
        self._lock = threading.Lock()

    def start(self):
        if self.running:
            return
        self.running = True

        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            # Bind to 0.0.0.0 and discovery port
            self.sock.bind(("", self.discovery_port))
            self.sock.settimeout(1.0)
        except Exception as e:
            print(f"[ControllerDiscovery] Could not bind UDP listener: {e}")
            self.sock = None

        if self.sock:
            self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.listen_thread.start()

        self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self.cleanup_thread.start()

        # Send initial probe to quickly find already running agents
        self.send_discovery_probe()
        print(f"[ControllerDiscovery] Listening on UDP port {self.discovery_port}")

    def send_discovery_probe(self):
        """Broadcast a discovery probe to prompt agents to reply immediately."""
        try:
            probe_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            probe_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            msg = {
                "magic": MAGIC_DISCOVERY_HEADER,
                "msg_type": MSG_DISCOVERY_PROBE,
                "timestamp": time.time(),
            }
            payload = json.dumps(msg).encode("utf-8")
            probe_sock.sendto(payload, ("<broadcast>", self.discovery_port))
            probe_sock.close()
        except Exception as e:
            print(f"[ControllerDiscovery] Error sending discovery probe: {e}")

    def _listen_loop(self):
        while self.running and self.sock:
            try:
                data, addr = self.sock.recvfrom(4096)
                msg = json.loads(data.decode("utf-8"))
                if msg.get("magic") == MAGIC_DISCOVERY_HEADER:
                    msg_type = msg.get("msg_type")
                    if msg_type in (MSG_DISCOVERY_BROADCAST, MSG_DISCOVERY_RESPONSE):
                        # Use reported IP or fallback to socket addr[0]
                        if not msg.get("ip") or msg.get("ip") == "127.0.0.1":
                            msg["ip"] = addr[0]
                        self._register_device(msg)
            except socket.timeout:
                continue
            except Exception:
                continue

    def _register_device(self, data: dict):
        device_id = data.get("device_id")
        if not device_id:
            return

        with self._lock:
            if device_id in self.devices:
                dev = self.devices[device_id]
                dev.device_name = data.get("device_name", dev.device_name)
                dev.ip = data.get("ip", dev.ip)
                dev.port = data.get("port", dev.port)
                dev.os_info = data.get("os_info", dev.os_info)
                dev.capabilities = data.get("capabilities", dev.capabilities)
                dev.last_seen = time.time()
                dev.status = "online"
            else:
                self.devices[device_id] = DiscoveredDevice(data)
                print(f"[ControllerDiscovery] Discovered new device: {data.get('device_name')} ({data.get('ip')}:{data.get('port')})")

    def _cleanup_loop(self):
        """Periodically check for devices that haven't sent heartbeats."""
        while self.running:
            time.sleep(2.0)
            now = time.time()
            with self._lock:
                for dev in self.devices.values():
                    if now - dev.last_seen > DEVICE_OFFLINE_TIMEOUT:
                        dev.status = "offline"

    def get_devices(self) -> List[dict]:
        with self._lock:
            # Sort online first, then by name
            device_list = [dev.to_dict() for dev in self.devices.values()]
            device_list.sort(key=lambda d: (d["status"] != "online", d["device_name"].lower()))
            return device_list

    def add_manual_device(self, ip: str, port: int) -> dict:
        """Query agent directly via HTTP and register it."""
        url = f"http://{ip}:{port}/api/info"
        try:
            resp = requests.get(url, timeout=3.0)
            if resp.status_code == 200:
                data = resp.json()
                data["ip"] = ip
                data["port"] = port
                dev_id = data.get("device_id", f"manual_{ip}_{port}")
                data["device_id"] = dev_id
                with self._lock:
                    dev = DiscoveredDevice(data)
                    dev.is_manual = True
                    self.devices[dev_id] = dev
                return {"success": True, "device": dev.to_dict()}
            else:
                return {"success": False, "error": f"Agent returned status code {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to connect to {ip}:{port}: {e}"}

    def stop(self):
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
