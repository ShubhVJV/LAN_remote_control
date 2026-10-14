import { Device, ConnectionStatus, SystemMetrics, DirectoryListing, AppInfo, AppLaunchHistory } from '../types';

const BASE_URL = '/api';

export const api = {
  // Discovery
  async getDevices(): Promise<{ devices: Device[]; controller_ip: string }> {
    const res = await fetch(`${BASE_URL}/devices`);
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  },

  async triggerDiscovery(): Promise<void> {
    await fetch(`${BASE_URL}/devices/discover`, { method: 'POST' });
  },

  async addManualDevice(ip: string, port: number = 8000): Promise<any> {
    const res = await fetch(`${BASE_URL}/devices/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to add device' }));
      throw new Error(err.detail || 'Failed to add manual device');
    }
    return res.json();
  },

  // Connection
  async connect(ip: string, port: number, pin: string, requested_mode: string = 'interactive'): Promise<any> {
    const res = await fetch(`${BASE_URL}/connection/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, pin, requested_mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Connection failed' }));
      throw new Error(err.detail || 'Connection failed');
    }
    return res.json();
  },

  async disconnect(): Promise<any> {
    const res = await fetch(`${BASE_URL}/connection/disconnect`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to disconnect');
    return res.json();
  },

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const res = await fetch(`${BASE_URL}/connection/status`);
    if (!res.ok) throw new Error('Failed to fetch connection status');
    return res.json();
  },

  // Monitoring
  async getMetrics(): Promise<SystemMetrics> {
    const res = await fetch(`${BASE_URL}/monitoring/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  // File Transfer
  async listFiles(path: string = ''): Promise<DirectoryListing> {
    const res = await fetch(`${BASE_URL}/files/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Failed to list files');
    return res.json();
  },

  async deleteFile(path: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/files/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Delete failed' }));
      throw new Error(err.detail || 'Failed to delete file');
    }
  },

  // Chunked Upload with pause/resume support
  async uploadFileChunked(
    file: File,
    relPath: string = '',
    onProgress: (transferred: number, total: number, speedKbps: number) => void,
    isCancelled: () => boolean
  ): Promise<{ sha256: string }> {
    const CHUNK_SIZE = 512 * 1024; // 512 KB

    // 1. Initialize upload
    const initRes = await fetch(`${BASE_URL}/files/upload/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        relative_path: relPath,
        total_size: file.size,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ detail: 'Failed to initialize upload' }));
      throw new Error(err.detail || 'Failed to initialize upload');
    }

    const { transfer_id, already_received_bytes = 0 } = await initRes.json();
    let offset = already_received_bytes;
    let lastTime = Date.now();
    let lastTransferred = offset;

    // 2. Upload chunks sequentially
    while (offset < file.size) {
      if (isCancelled()) {
        throw new Error('Upload cancelled by user');
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const formData = new FormData();
      formData.append('transfer_id', transfer_id);
      formData.append('chunk_offset', offset.toString());
      formData.append('file', chunk, file.name);

      const chunkRes = await fetch(`${BASE_URL}/files/upload/chunk`, {
        method: 'POST',
        body: formData,
      });

      if (!chunkRes.ok) {
        throw new Error(`Chunk upload failed at offset ${offset}`);
      }

      offset += chunk.size;
      const now = Date.now();
      const dt = Math.max((now - lastTime) / 1000, 0.01);
      const speed = (offset - lastTransferred) / dt / 1024; // KB/s
      lastTime = now;
      lastTransferred = offset;

      onProgress(offset, file.size, speed);
    }

    // 3. Finalize upload & verify SHA-256
    const compRes = await fetch(`${BASE_URL}/files/upload/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfer_id }),
    });

    if (!compRes.ok) {
      const err = await compRes.json().catch(() => ({ detail: 'Verification failed' }));
      throw new Error(err.detail || 'Upload completion failed');
    }

    return compRes.json();
  },

  // Applications
  async listApps(): Promise<{ apps: AppInfo[]; history: AppLaunchHistory[] }> {
    const res = await fetch(`${BASE_URL}/apps`);
    if (!res.ok) throw new Error('Failed to fetch applications');
    return res.json();
  },

  async launchApp(appId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/apps/launch/${encodeURIComponent(appId)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Launch failed' }));
      throw new Error(err.detail || 'Failed to launch application');
    }
    return res.json();
  },
};
