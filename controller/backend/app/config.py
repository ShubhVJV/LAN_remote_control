"""
Controller Backend Configuration.
"""

import os
import socket
import platform

def get_lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
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

class ControllerConfig:
    def __init__(self):
        self.port = 8080
        self.discovery_port = 50050
        self.controller_name = f"{socket.gethostname()} (Controller)"
        self.controller_ip = get_lan_ip()
        self.device_offline_timeout = 8.0  # seconds
