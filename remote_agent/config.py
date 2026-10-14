"""
Configuration for Remote Agent.
"""

import os
import json
import uuid
import socket
import platform
from typing import List, Dict, Any

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "agent_config.json")

def get_default_shared_dir() -> str:
    shared_dir = os.path.join(os.path.dirname(__file__), "shared_storage")
    os.makedirs(shared_dir, exist_ok=True)
    return os.path.abspath(shared_dir)

def get_default_apps() -> List[Dict[str, Any]]:
    system = platform.system()
    if system == "Windows":
        return [
            {
                "id": "notepad",
                "name": "Notepad",
                "description": "Windows Text Editor",
                "icon": "FileText",
                "executable": "notepad.exe",
                "args": []
            },
            {
                "id": "calculator",
                "name": "Calculator",
                "description": "Windows Calculator",
                "icon": "Calculator",
                "executable": "calc.exe",
                "args": []
            },
            {
                "id": "paint",
                "name": "Paint",
                "description": "Windows Paint Graphics Tool",
                "icon": "Palette",
                "executable": "mspaint.exe",
                "args": []
            },
            {
                "id": "taskmgr",
                "name": "Task Manager",
                "description": "System Resource and Task Monitor",
                "icon": "Activity",
                "executable": "taskmgr.exe",
                "args": []
            },
            {
                "id": "cmd",
                "name": "Command Prompt",
                "description": "Standard Command Prompt",
                "icon": "Terminal",
                "executable": "cmd.exe",
                "args": ["/k", "echo LAN Remote Control Session"]
            }
        ]
    else:
        return [
            {
                "id": "text_editor",
                "name": "Text Editor",
                "description": "Default Text Editor",
                "icon": "FileText",
                "executable": "nano",
                "args": []
            },
            {
                "id": "calculator",
                "name": "Calculator",
                "description": "Calculator",
                "icon": "Calculator",
                "executable": "bc",
                "args": []
            }
        ]

class AgentConfig:
    def __init__(self, config_path: str = DEFAULT_CONFIG_PATH):
        self.config_path = config_path
        self.device_id = str(uuid.uuid4())
        self.device_name = socket.gethostname()
        self.port = 8000
        self.discovery_port = 50050
        self.pin = "123456"  # Default pairing PIN, can be generated or customized
        self.require_local_approval = True
        self.shared_directories = [get_default_shared_dir()]
        self.screen_fps = 15
        self.screen_quality = 70
        self.screen_scale = 0.75
        self.allowlist_apps = get_default_apps()
        self.load()

    def load(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.device_id = data.get("device_id", self.device_id)
                    self.device_name = data.get("device_name", self.device_name)
                    self.port = data.get("port", self.port)
                    self.discovery_port = data.get("discovery_port", self.discovery_port)
                    self.pin = data.get("pin", self.pin)
                    self.require_local_approval = data.get("require_local_approval", self.require_local_approval)
                    self.shared_directories = data.get("shared_directories", self.shared_directories)
                    self.screen_fps = data.get("screen_fps", self.screen_fps)
                    self.screen_quality = data.get("screen_quality", self.screen_quality)
                    self.screen_scale = data.get("screen_scale", self.screen_scale)
                    self.allowlist_apps = data.get("allowlist_apps", self.allowlist_apps)
            except Exception as e:
                print(f"[Config] Error reading {self.config_path}: {e}")
        else:
            self.save()

    def save(self):
        data = {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "port": self.port,
            "discovery_port": self.discovery_port,
            "pin": self.pin,
            "require_local_approval": self.require_local_approval,
            "shared_directories": self.shared_directories,
            "screen_fps": self.screen_fps,
            "screen_quality": self.screen_quality,
            "screen_scale": self.screen_scale,
            "allowlist_apps": self.allowlist_apps
        }
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            print(f"[Config] Error saving config: {e}")
