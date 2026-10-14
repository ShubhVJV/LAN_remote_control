"""
UDP Broadcast Discovery Service for Remote Agent.
"""

import socket
import json
import time
import threading
import platform
from typing import Optional
from shared.protocol import (
    DISCOVERY_BROADCAST_PORT,
    MAGIC_DISCOVERY_HEADER,
    MSG_DISCOVERY_BROADCAST,
    MSG_DISCOVERY_PROBE,
    MSG_DISCOVERY_RESPONSE,
    HEARTBEAT_INTERVAL,
    ALL_CAPABILITIES,
)
from shared.schemas import DeviceAnnouncement

def get_lan_ip() -> str:
    """Detect the local machine's primary LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connecting to a public IP doesn't actually send packets for UDP,
        # but allows the OS to determine the outgoing interface IP.
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = "127.0.0.1"
    finally:
        s.close()
    return ip

class AgentDiscoveryService:
    def __init__(self, config):
        self.config = config
        self.running = False
        self.broadcast_thread: Optional[threading.Thread] = None
        self.listen_thread: Optional[threading.Thread] = None
        self.lan_ip = get_lan_ip()
        self.broadcast_socket: Optional[socket.socket] = None
        self.listen_socket: Optional[socket.socket] = None

    def create_announcement(self, msg_type: str = MSG_DISCOVERY_BROADCAST) -> dict:
        self.lan_ip = get_lan_ip()
        announcement = DeviceAnnouncement(
            magic=MAGIC_DISCOVERY_HEADER,
            msg_type=msg_type,
            device_id=self.config.device_id,
            device_name=self.config.device_name,
            hostname=socket.gethostname(),
            ip=self.lan_ip,
            port=self.config.port,
            os_info=f"{platform.system()} {platform.release()}",
            capabilities=ALL_CAPABILITIES,
            timestamp=time.time(),
        )
        return announcement.model_dump()

    def start(self):
        if self.running:
            return
        self.running = True

        # Socket for sending broadcasts
        self.broadcast_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.broadcast_socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        # Socket for listening to discovery probes
        try:
            self.listen_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            # On Windows, bind to 0.0.0.0 and discovery port
            self.listen_socket.bind(("", self.config.discovery_port))
            self.listen_socket.settimeout(1.0)
        except Exception as e:
            print(f"[Discovery] Could not bind discovery listener on port {self.config.discovery_port}: {e}")
            self.listen_socket = None

        self.broadcast_thread = threading.Thread(target=self._broadcast_loop, daemon=True)
        self.broadcast_thread.start()

        if self.listen_socket:
            self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.listen_thread.start()

        print(f"[Discovery] Agent advertising on LAN IP {self.lan_ip}:{self.config.port} (Broadcast port {self.config.discovery_port})")

    def _broadcast_loop(self):
        while self.running:
            try:
                payload = json.dumps(self.create_announcement(MSG_DISCOVERY_BROADCAST)).encode("utf-8")
                # Broadcast to LAN broadcast address
                self.broadcast_socket.sendto(payload, ("<broadcast>", self.config.discovery_port))
            except Exception as e:
                # Sockets may briefly fail if network switches
                pass
            time.sleep(HEARTBEAT_INTERVAL)

    def _listen_loop(self):
        while self.running and self.listen_socket:
            try:
                data, addr = self.listen_socket.recvfrom(4096)
                msg = json.loads(data.decode("utf-8"))
                if msg.get("magic") == MAGIC_DISCOVERY_HEADER and msg.get("msg_type") == MSG_DISCOVERY_PROBE:
                    # Reply with DISCOVERY_RESPONSE directly to the probe sender
                    response_payload = json.dumps(self.create_announcement(MSG_DISCOVERY_RESPONSE)).encode("utf-8")
                    self.broadcast_socket.sendto(response_payload, addr)
            except socket.timeout:
                continue
            except Exception:
                continue

    def stop(self):
        self.running = False
        if self.broadcast_socket:
            try:
                self.broadcast_socket.close()
            except Exception:
                pass
        if self.listen_socket:
            try:
                self.listen_socket.close()
            except Exception:
                pass
