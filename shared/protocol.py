"""
Shared protocol constants and message types for LAN Remote Control System.
"""

# Default networking ports
DISCOVERY_BROADCAST_PORT = 50050
DEFAULT_AGENT_PORT = 8000
DEFAULT_CONTROLLER_PORT = 8080

# Discovery protocol
MAGIC_DISCOVERY_HEADER = "LAN_REMOTE_CTRL_V1"
MSG_DISCOVERY_BROADCAST = "DISCOVERY_BROADCAST"
MSG_DISCOVERY_PROBE = "DISCOVERY_PROBE"
MSG_DISCOVERY_RESPONSE = "DISCOVERY_RESPONSE"

# Heartbeat interval & timeouts (seconds)
HEARTBEAT_INTERVAL = 2.0
DEVICE_OFFLINE_TIMEOUT = 8.0
SESSION_TIMEOUT = 3600  # 1 hour
APPROVAL_TIMEOUT = 30.0  # 30 seconds for remote user to approve

# Capabilities
CAP_MONITORING = "monitoring"
CAP_SCREEN_VIEW = "screen_view"
CAP_INPUT_CONTROL = "input_control"
CAP_FILE_TRANSFER = "file_transfer"
CAP_APP_LAUNCHER = "app_launcher"

ALL_CAPABILITIES = [
    CAP_MONITORING,
    CAP_SCREEN_VIEW,
    CAP_INPUT_CONTROL,
    CAP_FILE_TRANSFER,
    CAP_APP_LAUNCHER,
]

# Session Modes
MODE_VIEW_ONLY = "view_only"
MODE_INTERACTIVE = "interactive"

# Approval States
APPROVAL_PENDING = "pending"
APPROVAL_APPROVED = "approved"
APPROVAL_REJECTED = "rejected"
APPROVAL_EXPIRED = "expired"
APPROVAL_REVOKED = "revoked"

# Input Event Types
EVENT_MOUSE_MOVE = "mouse_move"
EVENT_MOUSE_DOWN = "mouse_down"
EVENT_MOUSE_UP = "mouse_up"
EVENT_MOUSE_CLICK = "mouse_click"
EVENT_MOUSE_DOUBLE_CLICK = "mouse_double_click"
EVENT_MOUSE_SCROLL = "mouse_scroll"
EVENT_KEY_DOWN = "key_down"
EVENT_KEY_UP = "key_up"
EVENT_TYPE_TEXT = "type_text"
EVENT_HOTKEY = "hotkey"

# Screen Capture Settings
DEFAULT_FPS = 15
DEFAULT_QUALITY = 70
DEFAULT_SCALE = 0.75  # 75% scaling to optimize LAN bandwidth and latency
