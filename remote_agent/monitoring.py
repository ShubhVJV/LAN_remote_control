"""
System resource monitoring using psutil.
"""

import time
import socket
import platform
import psutil
from shared.schemas import SystemMetrics

class SystemMonitor:
    def __init__(self):
        self.last_net_time = time.time()
        net = psutil.net_io_counters()
        self.last_bytes_recv = net.bytes_recv
        self.last_bytes_sent = net.bytes_sent
        self.hostname = socket.gethostname()
        self.os_info = f"{platform.system()} {platform.release()}"
        # Prime psutil cpu_percent
        psutil.cpu_percent(interval=None)

    def get_metrics(self) -> SystemMetrics:
        now = time.time()
        dt = max(now - self.last_net_time, 0.001)

        # CPU
        cpu_pct = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True) or 1
        cpu_freq = psutil.cpu_freq()
        cpu_freq_mhz = cpu_freq.current if cpu_freq else None

        # RAM
        ram = psutil.virtual_memory()
        ram_total_gb = round(ram.total / (1024 ** 3), 2)
        ram_used_gb = round(ram.used / (1024 ** 3), 2)
        ram_pct = ram.percent

        # Disk
        try:
            # Check root or system volume
            disk_path = "C:\\" if platform.system() == "Windows" else "/"
            disk = psutil.disk_usage(disk_path)
            disk_total_gb = round(disk.total / (1024 ** 3), 2)
            disk_used_gb = round(disk.used / (1024 ** 3), 2)
            disk_pct = disk.percent
        except Exception:
            disk_total_gb = 0.0
            disk_used_gb = 0.0
            disk_pct = 0.0

        # Network Throughput
        net = psutil.net_io_counters()
        bytes_recv = net.bytes_recv
        bytes_sent = net.bytes_sent

        down_speed_kbps = max(0.0, (bytes_recv - self.last_bytes_recv) / dt / 1024)
        up_speed_kbps = max(0.0, (bytes_sent - self.last_bytes_sent) / dt / 1024)

        self.last_net_time = now
        self.last_bytes_recv = bytes_recv
        self.last_bytes_sent = bytes_sent

        # Uptime
        uptime_seconds = int(now - psutil.boot_time())

        return SystemMetrics(
            timestamp=now,
            uptime_seconds=uptime_seconds,
            hostname=self.hostname,
            os_info=self.os_info,
            cpu_percent=cpu_pct,
            cpu_count=cpu_count,
            cpu_freq_mhz=cpu_freq_mhz,
            ram_total_gb=ram_total_gb,
            ram_used_gb=ram_used_gb,
            ram_percent=ram_pct,
            disk_total_gb=disk_total_gb,
            disk_used_gb=disk_used_gb,
            disk_percent=disk_pct,
            net_download_speed_kbps=round(down_speed_kbps, 2),
            net_upload_speed_kbps=round(up_speed_kbps, 2),
        )
