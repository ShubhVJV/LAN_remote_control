"""
Main FastAPI application and server for Remote Agent (Computer B).
"""

import os
import sys
import asyncio
import argparse
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.protocol import (
    DEFAULT_AGENT_PORT,
    MODE_INTERACTIVE,
    CAP_MONITORING,
    CAP_SCREEN_VIEW,
    CAP_INPUT_CONTROL,
    CAP_FILE_TRANSFER,
    CAP_APP_LAUNCHER,
)
from shared.schemas import (
    DeviceConnectRequest,
    SessionInfo,
    SystemMetrics,
    FileUploadInitRequest,
    FileUploadInitResponse,
    FileUploadStatusResponse,
    FileUploadCompleteRequest,
    AppLaunchResult,
    InputEvent,
)
from remote_agent.config import AgentConfig
from remote_agent.discovery import AgentDiscoveryService, get_lan_ip
from remote_agent.authentication import AuthManager
from remote_agent.monitoring import SystemMonitor
from remote_agent.screen_capture import ScreenCaptureService
from remote_agent.input_control import InputController
from remote_agent.file_transfer import FileTransferManager
from remote_agent.app_launcher import AppLauncher

config = AgentConfig()
auth_manager = AuthManager(config)
discovery_service = AgentDiscoveryService(config)
monitor = SystemMonitor()
screen_service = ScreenCaptureService(
    fps=config.screen_fps,
    quality=config.screen_quality,
    scale=config.screen_scale,
)
input_controller = InputController(screen_service)
file_manager = FileTransferManager(config.shared_directories)
app_launcher = AppLauncher(config.allowlist_apps)

# When a session is revoked (e.g. from the remote machine's floating banner), release inputs
auth_manager.on_session_revoked = lambda sid: input_controller.release_all_keys()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[Agent] Starting background services...")
    discovery_service.start()
    yield
    # Shutdown
    print("[Agent] Shutting down services...")
    discovery_service.stop()
    screen_service.stop_streaming()
    input_controller.release_all_keys()

app = FastAPI(title="LAN Remote Control Agent", lifespan=lifespan)

# Allow CORS for controller frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_current_session(authorization: Optional[str] = Header(None)) -> SessionInfo:
    """Dependency to validate session token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token.")
    token = authorization.split("Bearer ", 1)[1].strip()
    session = auth_manager.validate_token(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or unauthorized.")
    return session

# --- Discovery and Info ---

@app.get("/api/info")
def get_agent_info():
    return {
        "device_id": config.device_id,
        "device_name": config.device_name,
        "ip": get_lan_ip(),
        "port": config.port,
        "require_local_approval": config.require_local_approval,
        "capabilities": [
            CAP_MONITORING,
            CAP_SCREEN_VIEW,
            CAP_INPUT_CONTROL,
            CAP_FILE_TRANSFER,
            CAP_APP_LAUNCHER,
        ]
    }

# --- Authentication & Pairing ---

@app.post("/api/auth/connect", response_model=SessionInfo)
def connect_session(req: DeviceConnectRequest):
    session = auth_manager.authenticate_and_request_approval(req)
    if not session:
        raise HTTPException(status_code=403, detail="Connection rejected, invalid PIN, or timed out.")
    return session

@app.post("/api/auth/disconnect")
def disconnect_session(session: SessionInfo = Depends(get_current_session)):
    auth_manager.revoke_session(session.session_id)
    return {"message": "Session disconnected successfully."}

@app.get("/api/session", response_model=SessionInfo)
def get_session_status(session: SessionInfo = Depends(get_current_session)):
    return session

# --- System Monitoring ---

@app.get("/api/metrics", response_model=SystemMetrics)
def get_metrics(session: SessionInfo = Depends(get_current_session)):
    return monitor.get_metrics()

@app.websocket("/ws/metrics")
async def ws_metrics(websocket: WebSocket, token: Optional[str] = Query(None)):
    session = auth_manager.validate_token(token)
    if not session:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        while True:
            # Check session still valid
            if not auth_manager.validate_token(token):
                break
            metrics = monitor.get_metrics()
            await websocket.send_json(metrics.model_dump())
            await asyncio.sleep(1.2)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Metrics] Disconnected: {e}")

# --- Screen Viewing ---

@app.websocket("/ws/screen")
async def ws_screen(websocket: WebSocket, token: Optional[str] = Query(None)):
    session = auth_manager.validate_token(token)
    if not session:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    screen_service.start_streaming()

    try:
        last_sent_time = 0.0
        while True:
            if not auth_manager.validate_token(token):
                break

            jpeg_data, frame_time, width, height, fps = screen_service.get_latest_frame()
            if jpeg_data and frame_time > last_sent_time:
                last_sent_time = frame_time
                # Frame metadata header: 16 bytes: width(4B), height(4B), fps(4B float), timestamp(4B or 8B)
                # Or send JSON metadata followed by binary or send as binary frame
                # Client easily receives binary JPEG Blob directly!
                await websocket.send_bytes(jpeg_data)

            # Sleep to match frame rate target
            await asyncio.sleep(1.0 / max(5, config.screen_fps))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Screen] Stream ended: {e}")
    finally:
        screen_service.stop_streaming()

# --- Input Control ---

@app.websocket("/ws/control")
async def ws_control(websocket: WebSocket, token: Optional[str] = Query(None)):
    session = auth_manager.validate_token(token)
    if not session:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        while True:
            current_session = auth_manager.validate_token(token)
            if not current_session:
                break

            data = await websocket.receive_json()
            event = InputEvent(**data)
            # Only allow interactive control if session mode is interactive
            is_interactive = (current_session.mode == MODE_INTERACTIVE)
            input_controller.handle_event(event, is_authorized=is_interactive)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Control] Input stream ended: {e}")
    finally:
        input_controller.release_all_keys()

# --- File Transfer ---

@app.get("/api/files/list")
def list_files(path: str = "", session: SessionInfo = Depends(get_current_session)):
    try:
        return file_manager.list_directory(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/files/upload/init", response_model=FileUploadInitResponse)
def init_upload(req: FileUploadInitRequest, session: SessionInfo = Depends(get_current_session)):
    try:
        return file_manager.init_upload(req.filename, req.relative_path, req.total_size, req.sha256)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/files/upload/chunk")
async def upload_chunk(
    transfer_id: str = Form(...),
    chunk_offset: int = Form(...),
    file: UploadFile = File(...),
    session: SessionInfo = Depends(get_current_session)
):
    try:
        data = await file.read()
        received = file_manager.write_chunk(transfer_id, chunk_offset, data)
        return {"transfer_id": transfer_id, "received_bytes": received}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/files/upload/status/{transfer_id}", response_model=FileUploadStatusResponse)
def get_upload_status(transfer_id: str, session: SessionInfo = Depends(get_current_session)):
    try:
        return file_manager.get_transfer_status(transfer_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/files/upload/complete")
def complete_upload(req: FileUploadCompleteRequest, session: SessionInfo = Depends(get_current_session)):
    success, result_or_err = file_manager.complete_upload(req.transfer_id, req.expected_sha256)
    if not success:
        raise HTTPException(status_code=400, detail=result_or_err)
    return {"message": "Upload completed successfully", "sha256": result_or_err}

@app.delete("/api/files/upload/cancel/{transfer_id}")
def cancel_upload(transfer_id: str, session: SessionInfo = Depends(get_current_session)):
    file_manager.cancel_upload(transfer_id)
    return {"message": "Upload cancelled."}

@app.get("/api/files/download")
def download_file(path: str = Query(...), session: SessionInfo = Depends(get_current_session)):
    try:
        safe_path = file_manager.resolve_safe_path(path)
        if not os.path.isfile(safe_path):
            raise HTTPException(status_code=404, detail="File not found.")
        filename = os.path.basename(safe_path)
        return FileResponse(
            safe_path,
            filename=filename,
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/files/delete")
def delete_file(path: str = Query(...), session: SessionInfo = Depends(get_current_session)):
    try:
        file_manager.delete_file(path)
        return {"message": f"Successfully deleted {path}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Approved App Launcher ---

@app.get("/api/apps")
def get_approved_apps(session: SessionInfo = Depends(get_current_session)):
    return {
        "apps": app_launcher.get_allowed_apps(),
        "history": app_launcher.get_history()
    }

@app.post("/api/apps/launch/{app_id}", response_model=AppLaunchResult)
def launch_application(app_id: str, session: SessionInfo = Depends(get_current_session)):
    controller_info = f"{session.controller_name} ({session.controller_ip})"
    return app_launcher.launch_app(app_id, controller_info)

def main():
    import uvicorn
    parser = argparse.ArgumentParser(description="LAN Remote Control Agent (Computer B)")
    parser.add_argument("--port", type=int, default=8000, help="Port to run agent on")
    parser.add_argument("--pin", type=str, default=None, help="Pairing PIN")
    parser.add_argument("--no-approval", action="store_true", help="Auto-approve connections without GUI popup")
    parser.add_argument("--ssl-cert", type=str, default=None, help="Path to TLS certificate file")
    parser.add_argument("--ssl-key", type=str, default=None, help="Path to TLS private key file")
    args = parser.parse_args()

    if args.port:
        config.port = args.port
    if args.pin:
        config.pin = args.pin
    if args.no_approval:
        config.require_local_approval = False

    lan_ip = get_lan_ip()
    print("=" * 60)
    print(" LAN REMOTE CONTROL AGENT (Computer B)")
    print(f" Device Name : {config.device_name}")
    print(f" LAN IP Address: {lan_ip}")
    print(f" Listening Port: {config.port}")
    print(f" Pairing PIN   : {config.pin}")
    print(f" Local Approval: {'Enabled (Tkinter Modal)' if config.require_local_approval else 'Auto-Approve (CLI)'}")
    print("=" * 60)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=config.port,
        ssl_certfile=args.ssl_cert,
        ssl_keyfile=args.ssl_key,
        log_level="info",
    )

if __name__ == "__main__":
    main()
