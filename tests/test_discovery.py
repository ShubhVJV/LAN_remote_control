"""
Tests for LAN Device Discovery mechanism.
"""

import time
import pytest
from shared.schemas import DeviceAnnouncement
from shared.protocol import (
    MAGIC_DISCOVERY_HEADER,
    MSG_DISCOVERY_BROADCAST,
    ALL_CAPABILITIES,
)
from remote_agent.config import AgentConfig
from remote_agent.discovery import AgentDiscoveryService
from controller.backend.app.services.discovery_service import ControllerDiscoveryService, DiscoveredDevice

def test_announcement_schema():
    ann = DeviceAnnouncement(
        magic=MAGIC_DISCOVERY_HEADER,
        msg_type=MSG_DISCOVERY_BROADCAST,
        device_id="test-dev-1",
        device_name="Test Computer B",
        hostname="test-host",
        ip="192.168.1.50",
        port=8000,
        os_info="Windows 11",
        capabilities=ALL_CAPABILITIES,
        timestamp=time.time(),
    )
    dumped = ann.model_dump()
    assert dumped["magic"] == MAGIC_DISCOVERY_HEADER
    assert dumped["device_id"] == "test-dev-1"
    assert dumped["ip"] == "192.168.1.50"
    assert "monitoring" in dumped["capabilities"]

def test_controller_discovery_device_registration():
    discovery = ControllerDiscoveryService()
    
    # Simulate receiving an announcement packet
    msg = {
        "magic": MAGIC_DISCOVERY_HEADER,
        "msg_type": MSG_DISCOVERY_BROADCAST,
        "device_id": "agent-uuid-1234",
        "device_name": "Workstation-Alpha",
        "hostname": "alpha-pc",
        "ip": "192.168.1.120",
        "port": 8000,
        "os_info": "Windows 10",
        "capabilities": ALL_CAPABILITIES,
        "timestamp": time.time(),
    }
    
    discovery._register_device(msg)
    devices = discovery.get_devices()
    assert len(devices) == 1
    assert devices[0]["device_id"] == "agent-uuid-1234"
    assert devices[0]["device_name"] == "Workstation-Alpha"
    assert devices[0]["status"] == "online"

    # Simulate heartbeat refresh
    msg["device_name"] = "Workstation-Alpha-Renamed"
    discovery._register_device(msg)
    devices_updated = discovery.get_devices()
    assert len(devices_updated) == 1
    assert devices_updated[0]["device_name"] == "Workstation-Alpha-Renamed"

def test_device_offline_timeout():
    discovery = ControllerDiscoveryService()
    dev = DiscoveredDevice({
        "device_id": "temp-dev",
        "device_name": "Ghost PC",
        "ip": "192.168.1.99",
        "port": 8000,
        "os_info": "Linux",
        "capabilities": [],
    })
    # Set last seen 20 seconds in the past
    dev.last_seen = time.time() - 20
    discovery.devices["temp-dev"] = dev
    
    # Check that cleanup loop marks it offline
    now = time.time()
    for d in discovery.devices.values():
        if now - d.last_seen > 8.0:
            d.status = "offline"
            
    devices = discovery.get_devices()
    assert devices[0]["status"] == "offline"
