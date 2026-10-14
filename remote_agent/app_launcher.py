"""
Approved Application Launcher for Remote Agent.
Strictly restricted to predefined allowlist without arbitrary command execution.
"""

import os
import time
import shutil
import subprocess
from typing import List, Dict, Any, Optional
from shared.schemas import AppInfo, AppLaunchResult

class AppLauncher:
    def __init__(self, allowlist: List[Dict[str, Any]]):
        self.allowlist: Dict[str, Dict[str, Any]] = {app["id"]: app for app in allowlist}
        self.launch_history: List[Dict[str, Any]] = []

    def get_allowed_apps(self) -> List[AppInfo]:
        results = []
        for app_id, app_data in self.allowlist.items():
            exe = app_data["executable"]
            # Check if executable exists or is in PATH
            available = bool(shutil.which(exe) or os.path.isfile(exe))
            results.append(
                AppInfo(
                    id=app_id,
                    name=app_data["name"],
                    description=app_data.get("description", ""),
                    icon=app_data.get("icon", "AppWindow"),
                    is_available=available,
                )
            )
        return results

    def launch_app(self, app_id: str, controller_info: str = "Unknown") -> AppLaunchResult:
        now = time.time()
        if app_id not in self.allowlist:
            res = AppLaunchResult(
                app_id=app_id,
                success=False,
                message=f"Application '{app_id}' is not in the approved allowlist.",
                timestamp=now,
            )
            self._record_history(app_id, controller_info, False, res.message)
            return res

        app_data = self.allowlist[app_id]
        executable = app_data["executable"]
        args = app_data.get("args", [])

        # Validate that the executable actually exists
        exe_path = shutil.which(executable) or (executable if os.path.isfile(executable) else None)
        if not exe_path:
            res = AppLaunchResult(
                app_id=app_id,
                success=False,
                message=f"Executable '{executable}' not found on this computer.",
                timestamp=now,
            )
            self._record_history(app_id, controller_info, False, res.message)
            return res

        try:
            # Launch without shell=True to avoid shell injection
            cmd = [exe_path] + args
            proc = subprocess.Popen(
                cmd,
                shell=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
            msg = f"Application '{app_data['name']}' launched successfully."
            res = AppLaunchResult(
                app_id=app_id,
                success=True,
                message=msg,
                pid=proc.pid,
                timestamp=now,
            )
            self._record_history(app_id, controller_info, True, msg, proc.pid)
            print(f"[AppLauncher] Launched {app_id} (PID: {proc.pid}) requested by {controller_info}")
            return res
        except Exception as e:
            msg = f"Failed to launch application: {e}"
            res = AppLaunchResult(
                app_id=app_id,
                success=False,
                message=msg,
                timestamp=now,
            )
            self._record_history(app_id, controller_info, False, msg)
            return res

    def _record_history(self, app_id: str, controller: str, success: bool, message: str, pid: Optional[int] = None):
        self.launch_history.append({
            "app_id": app_id,
            "controller": controller,
            "success": success,
            "message": message,
            "pid": pid,
            "timestamp": time.time(),
        })
        # Keep last 100 entries
        if len(self.launch_history) > 100:
            self.launch_history.pop(0)

    def get_history(self) -> List[Dict[str, Any]]:
        return list(reversed(self.launch_history))
