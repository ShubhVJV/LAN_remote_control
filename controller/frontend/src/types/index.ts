export interface Device {
  device_id: string;
  device_name: string;
  hostname: string;
  ip: string;
  port: number;
  os_info: string;
  capabilities: string[];
  last_seen: number;
  status: 'online' | 'offline';
  is_manual?: boolean;
  seconds_since_seen: number;
}

export interface ConnectionStatus {
  is_connected: boolean;
  device_id: string | null;
  device_name: string | null;
  ip: string | null;
  port: number | null;
  mode: 'interactive' | 'view_only' | null;
  duration_seconds: number;
  connected_at: number | null;
  token?: string;
}

export interface SystemMetrics {
  timestamp: number;
  uptime_seconds: number;
  hostname: string;
  os_info: string;
  cpu_percent: number;
  cpu_count: number;
  cpu_freq_mhz?: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  net_download_speed_kbps: number;
  net_upload_speed_kbps: number;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export interface DirectoryListing {
  current_path: string;
  items: FileItem[];
}

export interface AppInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_available: boolean;
}

export interface AppLaunchHistory {
  app_id: string;
  controller: string;
  success: boolean;
  message: string;
  pid?: number;
  timestamp: number;
}

export interface FileTransferProgress {
  id: string;
  filename: string;
  direction: 'upload' | 'download';
  totalBytes: number;
  transferredBytes: number;
  speedKbps: number;
  progressPercent: number;
  status: 'queued' | 'transferring' | 'paused' | 'completed' | 'failed' | 'verifying';
  error?: string;
  sha256?: string;
}
