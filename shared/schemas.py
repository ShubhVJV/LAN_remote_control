"""
Shared Pydantic schemas for LAN Remote Control System.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DeviceAnnouncement(BaseModel):
    """Broadcast announcement sent over UDP."""
    magic: str = "LAN_REMOTE_CTRL_V1"
    msg_type: str
    device_id: str
    device_name: str
    hostname: str
    ip: str
    port: int
    os_info: str
    capabilities: List[str]
    timestamp: float
    protocol_version: str = "1.0.0"

class DeviceConnectRequest(BaseModel):
    """Request from controller to initiate a session with an agent."""
    controller_name: str
    controller_ip: str
    pin: str
    requested_mode: str = "interactive"  # "view_only" or "interactive"

class SessionInfo(BaseModel):
    """Information about an active session."""
    session_id: str
    token: str
    device_id: str
    device_name: str
    controller_name: str
    controller_ip: str
    mode: str
    created_at: float
    expires_at: float
    is_active: bool

class ApprovalStatus(BaseModel):
    """Status of an approval request."""
    request_id: str
    controller_name: str
    controller_ip: str
    requested_mode: str
    status: str  # pending, approved, rejected, expired
    created_at: float

class SystemMetrics(BaseModel):
    """Real-time system resource metrics."""
    timestamp: float
    uptime_seconds: int
    hostname: str
    os_info: str
    cpu_percent: float
    cpu_count: int
    cpu_freq_mhz: Optional[float] = None
    ram_total_gb: float
    ram_used_gb: float
    ram_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float
    net_download_speed_kbps: float
    net_upload_speed_kbps: float

class FileItem(BaseModel):
    """Item in a directory listing."""
    name: str
    path: str
    is_dir: bool
    size: int
    modified: float

class DirectoryListing(BaseModel):
    """Directory contents response."""
    current_path: str
    items: List[FileItem]

class FileUploadInitRequest(BaseModel):
    """Initialize a chunked file upload."""
    filename: str
    relative_path: str = ""
    total_size: int
    sha256: Optional[str] = None

class FileUploadInitResponse(BaseModel):
    """Response to upload initialization."""
    transfer_id: str
    chunk_size: int
    already_received_bytes: int = 0
    status: str

class FileUploadStatusResponse(BaseModel):
    """Status of a file transfer for resuming."""
    transfer_id: str
    filename: str
    total_size: int
    received_bytes: int
    is_complete: bool
    status: str

class FileUploadCompleteRequest(BaseModel):
    """Finalize an upload and verify checksum."""
    transfer_id: str
    expected_sha256: Optional[str] = None

class AppInfo(BaseModel):
    """Details of an approved application."""
    id: str
    name: str
    description: str
    icon: str
    is_available: bool

class AppLaunchRequest(BaseModel):
    """Request to launch an application."""
    app_id: str

class AppLaunchResult(BaseModel):
    """Result of launching an application."""
    app_id: str
    success: bool
    message: str
    pid: Optional[int] = None
    timestamp: float

class InputEvent(BaseModel):
    """Mouse or keyboard input event."""
    event_type: str
    # Mouse fields:
    # x and y are normalized between 0.0 and 1.0 relative to the remote screen
    x: Optional[float] = None
    y: Optional[float] = None
    button: Optional[str] = None  # "left", "right", "middle"
    dx: Optional[int] = 0
    dy: Optional[int] = 0
    # Keyboard fields:
    key: Optional[str] = None
    modifiers: Optional[List[str]] = Field(default_factory=list)
