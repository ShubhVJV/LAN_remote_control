import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  Laptop,
  ArrowDown,
  ArrowUp,
  AlertCircle,
} from 'lucide-react';
import { ConnectionStatus, SystemMetrics } from '../types';

interface SystemMonitorPageProps {
  connection: ConnectionStatus;
  metrics: SystemMetrics | null;
}

interface HistoryPoint {
  time: string;
  cpu: number;
  ram: number;
  downKbps: number;
  upKbps: number;
}

export const SystemMonitorPage: React.FC<SystemMonitorPageProps> = ({
  connection,
  metrics,
}) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (metrics) {
      const now = new Date(metrics.timestamp * 1000);
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: timeStr,
            cpu: metrics.cpu_percent,
            ram: metrics.ram_percent,
            downKbps: metrics.net_download_speed_kbps,
            upKbps: metrics.net_upload_speed_kbps,
          },
        ];
        // Keep last 30 data points for historical chart
        return next.slice(-30);
      });
    }
  }, [metrics]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m`;
  };

  if (!connection.is_connected || !metrics) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <Activity className="w-12 h-12 text-slate-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-200">System Telemetry Inactive</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Connect to a remote agent in the Devices tab to stream live CPU, RAM, disk, and network throughput telemetry.
        </p>
      </div>
    );
  }

  // Helper to render an SVG sparkline / line chart
  const renderLineChart = (data: number[], color: string, height: number = 120, maxVal: number = 100) => {
    if (data.length < 2) {
      return (
        <div className="h-[120px] flex items-center justify-center text-xs text-slate-500">
          Gathering historical data points...
        </div>
      );
    }
    const width = 500;
    const step = width / (data.length - 1);
    const points = data
      .map((val, i) => {
        const x = i * step;
        const normalized = Math.min(val / maxVal, 1.0);
        const y = height - normalized * (height - 10) - 5;
        return `${x},${y}`;
      })
      .join(' ');

    const areaPoints = `${points} ${width},${height} 0,${height}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px] overflow-visible">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        {/* Fill area */}
        <polygon points={areaPoints} fill={`url(#grad-${color})`} />
        {/* Stroke line */}
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top System Specs Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {metrics.hostname}
              <span className="text-xs font-mono font-normal text-slate-400">
                ({connection.ip})
              </span>
            </h2>
            <p className="text-xs text-slate-400">{metrics.os_info}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div>
            <span className="text-slate-500 block text-[11px]">CPU Cores</span>
            <span className="font-semibold text-slate-200">
              {metrics.cpu_count} Logical Cores
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">System Uptime</span>
            <span className="font-semibold text-slate-200 font-mono">
              {formatUptime(metrics.uptime_seconds)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Last Updated</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {new Date(metrics.timestamp * 1000).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Utilization */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-400" /> CPU Load
            </span>
            <span className="text-xl font-bold text-slate-100 font-mono">
              {metrics.cpu_percent}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.cpu_percent)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>{metrics.cpu_count} Cores</span>
            {metrics.cpu_freq_mhz && <span>{Math.round(metrics.cpu_freq_mhz)} MHz</span>}
          </div>
        </div>

        {/* RAM Utilization */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-400" /> Memory
            </span>
            <span className="text-xl font-bold text-slate-100 font-mono">
              {metrics.ram_percent}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.ram_percent)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>{metrics.ram_used_gb} GB used</span>
            <span>{metrics.ram_total_gb} GB total</span>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-400" /> Storage
            </span>
            <span className="text-xl font-bold text-slate-100 font-mono">
              {metrics.disk_percent}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.disk_percent)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>{metrics.disk_used_gb} GB used</span>
            <span>{metrics.disk_total_gb} GB total</span>
          </div>
        </div>

        {/* Network Throughput */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-amber-400" /> Network
            </span>
            <span className="text-xs font-bold text-slate-300">LAN Traffic</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <ArrowDown className="w-3 h-3" /> Down
              </div>
              <div className="font-mono text-sm font-bold text-slate-100 mt-0.5">
                {metrics.net_download_speed_kbps > 1024
                  ? `${(metrics.net_download_speed_kbps / 1024).toFixed(1)} MB/s`
                  : `${metrics.net_download_speed_kbps.toFixed(0)} KB/s`}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                <ArrowUp className="w-3 h-3" /> Up
              </div>
              <div className="font-mono text-sm font-bold text-slate-100 mt-0.5">
                {metrics.net_upload_speed_kbps > 1024
                  ? `${(metrics.net_upload_speed_kbps / 1024).toFixed(1)} MB/s`
                  : `${metrics.net_upload_speed_kbps.toFixed(0)} KB/s`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Time-Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" /> CPU Load History (Last 30 intervals)
            </h3>
            <span className="text-xs font-mono font-bold text-blue-400">
              {metrics.cpu_percent}%
            </span>
          </div>
          <div className="pt-2">
            {renderLineChart(history.map((h) => h.cpu), '#3b82f6', 130, 100)}
          </div>
        </div>

        {/* RAM Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" /> Memory Load History
            </h3>
            <span className="text-xs font-mono font-bold text-purple-400">
              {metrics.ram_percent}%
            </span>
          </div>
          <div className="pt-2">
            {renderLineChart(history.map((h) => h.ram), '#a855f7', 130, 100)}
          </div>
        </div>
      </div>
    </div>
  );
};
