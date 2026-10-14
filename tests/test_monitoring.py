"""
Tests for System Resource Monitoring using psutil.
"""

import time
import pytest
from remote_agent.monitoring import SystemMonitor

def test_system_metrics_structure():
    monitor = SystemMonitor()
    time.sleep(0.1)
    metrics = monitor.get_metrics()

    assert metrics.hostname != ""
    assert metrics.os_info != ""
    assert metrics.uptime_seconds >= 0

    # CPU
    assert 0.0 <= metrics.cpu_percent <= 100.0
    assert metrics.cpu_count >= 1

    # RAM
    assert metrics.ram_total_gb > 0.0
    assert metrics.ram_used_gb >= 0.0
    assert 0.0 <= metrics.ram_percent <= 100.0

    # Disk
    assert metrics.disk_total_gb >= 0.0
    assert 0.0 <= metrics.disk_percent <= 100.0

    # Network throughput
    assert metrics.net_download_speed_kbps >= 0.0
    assert metrics.net_upload_speed_kbps >= 0.0
