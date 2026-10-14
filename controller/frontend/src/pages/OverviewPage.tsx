import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Wifi,
  Activity,
  MonitorPlay,
  ArrowLeftRight,
  Boxes,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Power,
  Clock,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { Device, ConnectionStatus, SystemMetrics } from '../types';
import { api } from '../services/api';

interface OverviewPageProps {
  devices: Device[];
  connection: ConnectionStatus;
  metrics: SystemMetrics | null;
  onNavigate: (tab: string) => void;
  onConnectClick: (device: Device) => void;
  onDisconnect: () => void;
  onRefreshDevices: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  devices,
  connection,
  metrics,
  onNavigate,
  onConnectClick,
  onDisconnect,
  onRefreshDevices,
}) => {
  const onlineDevices = devices.filter((d) => d.status === 'online');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome / Status Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-slate-900/60 to-slate-900/40 border border-blue-500/20 backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            LAN Remote Control Dashboard
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time local network remote desktop administration, telemetry monitoring, and file transfer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefreshDevices}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/60 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Scan LAN
          </button>
          {!connection.is_connected && devices.length > 0 && (
            <button
              onClick={() => onNavigate('devices')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition"
            >
              Connect Device
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{devices.length}</div>
            <div className="text-xs text-slate-400">Total Devices Found</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{onlineDevices.length}</div>
            <div className="text-xs text-slate-400">Online on LAN</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">
              {connection.is_connected ? `${metrics?.cpu_percent ?? '--'}%` : 'Idle'}
            </div>
            <div className="text-xs text-slate-400">Remote CPU Load</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">
              {connection.is_connected ? connection.mode?.toUpperCase() : 'Inactive'}
            </div>
            <div className="text-xs text-slate-400">Session Mode</div>
          </div>
        </div>
      </div>

      {/* Active Session Card (If Connected) */}
      {connection.is_connected && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base font-semibold text-slate-100">
                  Active Session: {connection.device_name}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target IP: {connection.ip}:{connection.port} | Mode: {connection.mode}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('screen')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition flex items-center gap-1.5"
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                View Screen
              </button>
              <button
                onClick={onDisconnect}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> CPU Usage
                  </span>
                  <span className="font-semibold text-slate-200">{metrics.cpu_percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.cpu_percent)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-purple-400" /> RAM Usage
                  </span>
                  <span className="font-semibold text-slate-200">
                    {metrics.ram_percent}% ({metrics.ram_used_gb} / {metrics.ram_total_gb} GB)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.ram_percent)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Disk Usage
                  </span>
                  <span className="font-semibold text-slate-200">
                    {metrics.disk_percent}% ({metrics.disk_used_gb} / {metrics.disk_total_gb} GB)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics.disk_percent)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Discovered Devices Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Discovered LAN Devices ({devices.length})
          </h3>
          <button
            onClick={() => onNavigate('devices')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            View all & manual connect &rarr;
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-base font-semibold text-slate-300">No Remote Agents Found on LAN</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Start the Remote Agent on Computer B by opening a terminal and running:
            </p>
            <div className="inline-block px-4 py-2 rounded-lg bg-slate-950 font-mono text-xs text-blue-400 border border-slate-800">
              python -m remote_agent.agent
            </div>
            <p className="text-xs text-slate-500">
              Ensure both computers are on the same Wi-Fi / LAN network or use Manual IP connect in the Devices tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => {
              const isOnline = device.status === 'online';
              const isCurrent = connection.is_connected && connection.device_id === device.device_id;
              return (
                <div
                  key={device.device_id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-blue-950/20 border-blue-500/40 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        <h4 className="font-semibold text-sm text-slate-100">{device.device_name}</h4>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {device.ip}:{device.port}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {device.status}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-400 space-y-1">
                    <div>OS: {device.os_info}</div>
                    <div className="text-[11px] text-slate-500">
                      Last seen: {device.seconds_since_seen}s ago
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {device.capabilities.length} capabilities
                    </span>
                    {isCurrent ? (
                      <button
                        onClick={onDisconnect}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => onConnectClick(device)}
                        disabled={!isOnline}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          isOnline
                            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
