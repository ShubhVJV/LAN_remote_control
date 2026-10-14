"""
Main FastAPI server for Controller application (Computer A).
"""

import os
import sys
import asyncio
import aiohttp
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from shared.protocol import DEFAULT_CONTROLLER_PORT
from shared.schemas import FileUploadInitRequest, FileUploadCompleteRequest
from controller.backend.app.config import ControllerConfig
from controller.backend.app.services.discovery_service import ControllerDiscoveryService
from controller.backend.app.services.agent_client import AgentClient

config = ControllerConfig()
discovery = ControllerDiscoveryService()
agent_client = AgentClient(config)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Controller] Starting LAN discovery service...")
    discovery.start()
    yield
    print("[Controller] Stopping LAN discovery service...")
    discovery.stop()
    agent_client.disconnect()

app = FastAPI(title="LAN Remote Controller Backend", lifespan=lifespan)

app.add_middleware(
    CORSMSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectPayload(BaseModel):
    ip: str
    port: int = 8000
    pin: str
    requested_mode: str = "interactive"

class ManualDevicePayload(BaseModel):
    ip: str
    port: int = 8000

# --- Discovery Endpoints ---

@app.get("/api/devices")
def get_devices():
    return {
        "devices": discovery.get_devices(),
        "controller_ip": config.controller_ip,
    }

@app.post("/api/devices/discover")
def trigger_discovery():
    discovery.send_discovery_probe()
    return {"message": "Discovery probe broadcast sent"}

@app.post("/api/devices/manual")
def add_manual_device(payload: ManualDevicePayload):
    res = discovery.add_manual_device(payload.ip, payload.port)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res

# --- Session & Connection Management ---

@app.post("/api/connection/connect")
def connect_to_device(payload: ConnectPayload):
    success, message, session = agent_client.connect(
        ip=payload.ip,
        port=payload.port,
        pin=payload.pin,
        requested_mode=payload.requested_mode,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "success": True,
        "message": message,
        "session": session.model_dump() if session else None,
        "connection": agent_client.get_connection_status(),
    }

@app.post("/api/connection/disconnect")
def disconnect_device():
    success, message = agent_client.disconnect()
    return {"success": success, "message": message}

@app.get("/api/connection/status")
def get_connection_status():
    return agent_client.get_connection_status()

# --- Monitoring ---

@app.get("/api/monitoring/metrics")
def get_metrics():
    metrics = agent_client.get_metrics()
    if metrics is None:
        raise HTTPException(status_code=400, detail="Not connected or agent unreachable.")
    return metrics

# --- WebSockets: Screen Stream Proxy ---

@app.websocket("/ws/screen")
async def ws_screen_proxy(websocket: WebSocket):
    """
    Proxies binary screen JPEG stream from Remote Agent to Frontend.
    """
    if not agent_client.is_connected:
        await websocket.close(code=1008, reason="No active agent session")
        return

    await websocket.accept()

    agent_ws_url = f"ws://{agent_client.active_ip}:{agent_client.active_port}/ws/screen?token={agent_client.session.token}"
    import websockets

    try:
        async with websockets.connect(agent_ws_url, max_size=10 * 1024 * 1024) as agent_ws:
            while agent_client.is_connected:
                # Receive JPEG frame from agent and forward to frontend
                frame_data = await agent_ws.recv()
                if isinstance(frame_data, bytes):
                    await websocket.send_bytes(frame_data)
                else:
                    await websocket.send_text(frame_data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Screen Proxy] Stream ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# --- WebSockets: Control Events Proxy ---

@app.websocket("/ws/control")
async def ws_control_proxy(websocket: WebSocket):
    """
    Proxies mouse/keyboard control events from Frontend to Remote Agent.
    """
    if not agent_client.is_connected:
        await websocket.close(code=1008, reason="No active agent session")
        return

    await websocket.accept()

    agent_ws_url = f"ws://{agent_client.active_ip}:{agent_client.active_port}/ws/control?token={agent_client.session.token}"
    import websockets

    try:
        async with websockets.connect(agent_ws_url) as agent_ws:
            while agent_client.is_connected:
                # Receive input event JSON from frontend and forward to agent
                data = await websocket.receive_text()
                await agent_ws.send(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Control Proxy] Stream ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# --- WebSockets: Real-time Metrics Stream Proxy ---

@app.websocket("/ws/metrics")
async def ws_metrics_proxy(websocket: WebSocket):
    """
    Proxies live system metrics stream from Remote Agent to Frontend.
    """
    if not agent_client.is_connected:
        await websocket.close(code=1008, reason="No active agent session")
        return

    await websocket.accept()

    agent_ws_url = f"ws://{agent_client.active_ip}:{agent_client.active_port}/ws/metrics?token={agent_client.session.token}"
    import websockets

    try:
        async with websockets.connect(agent_ws_url) as agent_ws:
            while agent_client.is_connected:
                data = await agent_ws.recv()
                await websocket.send_text(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS Metrics Proxy] Stream ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# --- File Transfer Proxy Endpoints ---

@app.get("/api/files/list")
def list_files(path: str = ""):
    files = agent_client.list_files(path)
    if files is None:
        raise HTTPException(status_code=400, detail="Failed to list files from agent.")
    return files

@app.post("/api/files/upload/init")
def proxy_upload_init(req: FileUploadInitRequest):
    if not agent_client.is_connected:
        raise HTTPException(status_code=400, detail="Not connected")
    import requests
    resp = requests.post(
        f"{agent_client.base_url}/api/files/upload/init",
        json=req.model_dump(),
        headers=agent_client.auth_headers,
        timeout=10.0
    )
    if resp.status_code == 200:
        return resp.json()
    raise HTTPException(status_code=resp.status_code, detail=resp.text)

@app.post("/api/files/upload/chunk")
async def proxy_upload_chunk(
    transfer_id: str = Form(...),
    chunk_offset: int = Form(...),
    file: UploadFile = File(...)
):
    if not agent_client.is_connected:
        raise HTTPException(status_code=400, detail="Not connected")
    import requests
    data = await file.read()
    files = {"file": (file.filename, data, file.content_type)}
    form_data = {"transfer_id": transfer_id, "chunk_offset": chunk_offset}

    resp = requests.post(
        f"{agent_client.base_url}/api/files/upload/chunk",
        data=form_data,
        files=files,
        headers=agent_client.auth_headers,
        timeout=30.0
    )
    if resp.status_code == 200:
        return resp.json()
    raise HTTPException(status_code=resp.status_code, detail=resp.text)

@app.get("/api/files/upload/status/{transfer_id}")
def proxy_upload_status(transfer_id: str):
    if not agent_client.is_connected:
        raise HTTPException(status_code=400, detail="Not connected")
    import requests
    resp = requests.get(
        f"{agent_client.base_url}/api/files/upload/status/{transfer_id}",
        headers=agent_client.auth_headers,
        timeout=5.0
    )
    if resp.status_code == 200:
        return resp.json()
    raise HTTPException(status_code=resp.status_code, detail=resp.text)

@app.post("/api/files/upload/complete")
def proxy_upload_complete(req: FileUploadCompleteRequest):
    if not agent_client.is_connected:
        raise HTTPException(status_code=400, detail="Not connected")
    import requests
    resp = requests.post(
        f"{agent_client.base_url}/api/files/upload/complete",
        json=req.model_dump(),
        headers=agent_client.auth_headers,
        timeout=15.0
    )
    if resp.status_code == 200:
        return resp.json()
    raise HTTPException(status_code=resp.status_code, detail=resp.text)

@app.get("/api/files/download")
def proxy_download(path: str = Query(...)):
    if not agent_client.is_connected:
        raise HTTPException(status_code=400, detail="Not connected")
    import requests
    url = f"{agent_client.base_url}/api/files/download"
    resp = requests.get(url, params={"path": path}, headers=agent_client.auth_headers, stream=True, timeout=30.0)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Download failed from agent.")

    def stream_content():
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                yield chunk

    filename = os.path.basename(path)
    return StreamingResponse(
        stream_content(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.delete("/api/files/delete")
def delete_file(path: str = Query(...)):
    success, msg = agent_client.delete_file(path)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

# --- Applications Proxy Endpoints ---

@app.get("/api/apps")
def list_apps():
    apps = agent_client.list_apps()
    if apps is None:
        raise HTTPException(status_code=400, detail="Failed to fetch apps from agent.")
    return apps

@app.post("/api/apps/launch/{app_id}")
def launch_app(app_id: str):
    success, msg = agent_client.launch_app(app_id)
    return {"success": success, "message": msg}

# --- Static Frontend Serving ---

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

def main():
    import uvicorn
    import argparse
    parser = argparse.ArgumentParser(description="LAN Remote Controller Backend (Computer A)")
    parser.add_argument("--port", type=int, default=DEFAULT_CONTROLLER_PORT, help="Port to run controller backend on")
    parser.add_argument("--ssl-cert", type=str, default=None, help="Path to TLS certificate file")
    parser.add_argument("--ssl-key", type=str, default=None, help="Path to TLS private key file")
    args = parser.parse_args()

    print("=" * 60)
    print(" LAN REMOTE CONTROL CONTROLLER (Computer A)")
    print(f" Controller LAN IP: {config.controller_ip}")
    print(f" Backend Port     : {args.port}")
    print(f" Dashboard URL    : http://localhost:{args.port} or http://{config.controller_ip}:{args.port}")
    print("=" * 60)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=args.port,
        ssl_certfile=args.ssl_cert,
        ssl_keyfile=args.ssl_key,
        log_level="info",
    )

if __name__ == "__main__":
    main()
