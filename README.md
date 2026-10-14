# LAN Remote Control System

A complete, secure, production-grade LAN Remote Control and Administration System built with **React**, **TypeScript**, **Tailwind CSS**, and **Python (FastAPI, WebSockets, psutil, mss, pynput)**.

The system allows a controller computer (**Computer A**) to discover, authenticate, monitor, transfer files, view the live desktop, control mouse & keyboard, and launch approved applications on a remote computer (**Computer B**) over a Local Area Network (Wi-Fi or wired Ethernet).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       COMPUTER A (Controller)         |
                      |                                       |
                      |   React + Vite Dashboard (Browser)   |
                      |                ^                      |
                      |                | HTTP / WS            |
                      |                v                      |
                      |   FastAPI Controller Backend (8080)   |
                      +-------------------+-------------------+
                                          |
                        LAN Network (Wi-Fi / Ethernet)
                        - UDP Broadcast Discovery (50050)
                        - REST API & WebSockets (8000)
                                          |
                      +-------------------+-------------------+
                      |        COMPUTER B (Remote Agent)      |
                      |                                       |
                      |   FastAPI Agent & Sockets (8000)      |
                      |   + Tkinter Approval Dialog & Banner  |
                      |   + psutil System Telemetry           |
                      |   + mss & Pillow Live Screen Capture  |
                      |   + pynput Mouse / Keyboard Control   |
                      |   + Resumable Chunked File Transfer   |
                      |   + Predefined Application Allowlist  |
                      +---------------------------------------+
```

### Components

1. **Controller Application (`controller/`) — Computer A**:
   - Discovers agents on the LAN via UDP broadcast and direct IP ping.
   - Handles pairing and mutual session establishment.
   - Displays real-time device status, system resource charts, and file explorer.
   - Streams live remote screen frames with low latency.
   - Forwards mouse clicks, movements, scroll, and keyboard events.
   - Serves the compiled React dashboard directly or proxies via Vite dev server.

2. **Remote Agent (`remote_agent/`) — Computer B**:
   - Standalone Python daemon.
   - Advertises presence on UDP port `50050`.
   - Requires valid pairing PIN **and** explicit on-screen local approval (Accept/Reject dialog) before interactive access is granted.
   - Features an on-screen floating session banner with an instant "Disconnect / Revoke" button on Computer B.
   - Captures primary desktop frames via `mss` and streams optimized JPEGs.
   - Receives authorized mouse and keyboard commands using `pynput` (with rate-limiting and stuck-key cleanup).
   - Sandboxed chunked file transfer with SHA-256 verification and resume support.
   - Launches applications strictly from a local allowlist (no arbitrary shell execution).

---

## Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React icons, Native WebSocket API.
- **Backend**: Python 3.12+, FastAPI, Uvicorn, Pydantic v2, WebSockets, `psutil`, `mss`, `Pillow`, `pynput`, `requests`, `cryptography`.
- **Testing**: `pytest`.

---

## Quick Start (Single Machine Testing)

You can run both the Controller and Agent on the same computer to test all functionality:

### 1. Install Dependencies

```powershell
# Install Python dependencies
python -m pip install -r requirements.txt

# (Optional) If developing frontend:
cd controller/frontend
npm install
npm run build
cd ../..
```

### 2. Start the Remote Agent (Computer B)

Open a terminal:
```powershell
python -m remote_agent.agent --port 8000
```
*The agent will start, display its LAN IP and default pairing PIN (`123456`), and begin advertising on UDP port 50050.*

### 3. Start the Controller (Computer A)

Open a second terminal:
```powershell
python -m controller.backend.app.main --port 8080
```
Open your browser to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## Setting Up on Two Separate Computers over LAN

### Step 1: Connect Both Computers to the Same Network
Ensure Computer A (Controller) and Computer B (Remote PC) are connected to the same Wi-Fi router or Ethernet switch.

### Step 2: Find Local LAN IP Addresses
On Windows, open PowerShell or Command Prompt and run:
```cmd
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g., `192.168.1.105` on Computer B and `192.168.1.100` on Computer A).

### Step 3: Configure Windows Firewall
If Windows Firewall prompts you when starting the agent or controller, click **Allow access for Private networks**.

Alternatively, configure the necessary ports using PowerShell (Run as Administrator):
```powershell
# On Computer B (Remote Agent):
New-NetFirewallRule -DisplayName "LAN Remote Control Agent" -Direction Inbound -LocalPort 8000,50050 -Protocol TCP,UDP -Action Allow

# On Computer A (Controller):
New-NetFirewallRule -DisplayName "LAN Remote Control Controller" -Direction Inbound -LocalPort 8080,50050 -Protocol TCP,UDP -Action Allow
```

### Step 4: Launch Remote Agent on Computer B
Copy or clone the repository to Computer B, install dependencies (`pip install -r requirements.txt`), and launch:
```powershell
# Using the shortcut batch script:
scripts\start_agent.bat

# Or directly in Python:
python -m remote_agent.agent --port 8000
```

### Step 5: Launch Controller on Computer A
On Computer A, launch:
```powershell
# Using the shortcut batch script:
scripts\start_controller.bat

# Or directly in Python:
python -m controller.backend.app.main --port 8080
```

Open your browser on Computer A to **`http://localhost:8080`**.

---

## Features & Usage Guide

### 1. LAN Device Discovery
- Navigate to the **Devices** tab.
- Click **Scan LAN** to broadcast a discovery probe. All active agents on your subnet will appear automatically.
- **Manual IP Connect**: If your router blocks UDP broadcast packets (common on some guest Wi-Fi networks), click **Manual IP Connect**, enter Computer B's LAN IP (e.g. `192.168.1.105`) and port `8000`, and click **Add & Discover**.

### 2. Authentication & Remote Approval
1. Click **Connect** next to Computer B in the Devices table.
2. Enter the Pairing PIN (Default: `123456`, configurable in `remote_agent/agent_config.json`).
3. Select your desired session mode:
   - **Interactive**: Allows live screen viewing, mouse clicks, keyboard input, and app launching.
   - **View Only**: Screen viewing and telemetry monitoring only.
4. Click **Request Session**.
5. An interactive modal window will immediately pop up on **Computer B's desktop**:
   - Shows Controller Name, Controller IP, and requested mode.
   - Click **Accept** on Computer B within 30 seconds.
6. Once accepted, the session is active. A non-intrusive floating status banner appears on Computer B's desktop displaying:
   `● Connected: Computer A (192.168.1.100) [Disconnect]`
   *The remote user on Computer B can revoke the session at any time with a single click.*

### 3. Remote Desktop Screen Viewing & Control
- Click **Remote Screen** in the sidebar.
- Displays live, responsive video frames from Computer B's primary monitor.
- Preserves natural aspect ratio.
- Displays live resolution, connection status, and current FPS.
- When in **Interactive Control** mode:
  - Moving your mouse inside the screen moves the cursor on Computer B.
  - Left click, right click, double click, and mouse wheel scrolling are forwarded.
  - Typing keys while focused forwards key presses to Computer B.
- Click **Pause Control** / **Resume Control** to temporarily disable input injection without closing the stream.
- Click **Fullscreen** for immersive remote desktop administration.

### 4. Resumable Bidirectional File Transfer
- Navigate to **File Transfer**.
- Browse directories inside Computer B's sandboxed storage (`remote_agent/shared_storage`).
- **Upload File**: Select local files from Computer A. Files are transferred in 512 KB chunks with live progress, speed meter, and automatic SHA-256 checksum verification upon completion.
- **Resumable Transfers**: If an upload is interrupted by a network disconnection, re-initiating the upload automatically resumes from the last confirmed byte offset.
- **Download File**: Click the download icon next to any file on Computer B.
- **Path Traversal Protection**: Enforces strict directory boundaries; attempts to access outside paths (`../`) are automatically rejected.

### 5. Real-Time System Telemetry
- Navigate to **System Monitor**.
- Displays live metrics streamed from Computer B every 1–2 seconds:
  - CPU utilization percentage and frequency.
  - RAM usage (used, total, percentage).
  - Storage usage for primary drive volumes.
  - LAN network throughput (Download KB/s and Upload KB/s calculated from socket byte deltas).
  - System uptime, hostname, and OS specifications.
  - Real-time updating historical charts for CPU and RAM load.

### 6. Approved Remote Applications
- Navigate to **Applications**.
- Shows predefined allowlisted applications configured on Computer B (e.g., Notepad, Calculator, Paint, Task Manager, Command Prompt).
- Click **Launch Application** and confirm.
- Computer B executes the executable safely with `subprocess.Popen` (without shell injection).
- View the complete audit record with timestamps, requesting controller, and process IDs.

---

## Generating and Enabling TLS / HTTPS (WSS)

To enable end-to-end TLS encryption across LAN connections:

1. Run the built-in certificate generator:
```powershell
python scripts/generate_certs.py
```
This automatically detects your LAN IP and generates a self-signed `cert.pem` and `key.pem` with matching Subject Alternative Names (SAN).

2. Start the Agent with TLS:
```powershell
python -m remote_agent.agent --port 8000 --ssl-cert cert.pem --ssl-key key.pem
```

3. Start the Controller with TLS:
```powershell
python -m controller.backend.app.main --port 8080 --ssl-cert cert.pem --ssl-key key.pem
```

---

## Running the Automated Test Suite

Run the full automated test suite covering discovery, authentication, monitoring, resumable file transfer with SHA-256 verification, and allowlist enforcement:

```powershell
python -m pytest tests -v
```

All 13 test cases run in under 2 seconds.

---

## Troubleshooting

- **Agent not appearing in Devices list**:
  - Verify both computers are on the same subnet (e.g. `192.168.1.x`).
  - Some routers disable UDP broadcast reflection between Wi-Fi clients. In this case, use **Manual IP Connect** in the dashboard and enter Computer B's IP address directly.
- **Connection rejected**:
  - Ensure the Pairing PIN matches the one set in Computer B's `agent_config.json` (Default: `123456`).
  - Ensure Computer B's user clicks **Accept** on the pop-up dialog within 30 seconds.
- **Screen capture shows black or missing permissions**:
  - On Windows, ensure you are running in an active graphical desktop session (not a locked lock screen).
- **Mouse/Keyboard input not responding**:
  - Ensure the session mode was set to **Interactive** and that the screen is not in "Pause Control" state.
