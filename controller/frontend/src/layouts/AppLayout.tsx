import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Laptop,
  MonitorPlay,
  ArrowLeftRight,
  Activity,
  Boxes,
  Settings,
  Shield,
  Wifi,
  WifiOff,
  Power,
  Sun,
  Moon,
  Clock,
} from 'lucide-react';
import { ConnectionStatus } from '../types';

interface AppLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  connection: ConnectionStatus;
  onDisconnect: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  setCurrentTab,
  connection,
  onDisconnect,
  children,
}) => {
  const [isDark, setIsDark] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (connection.is_connected && connection.connected_at) {
      setElapsed(connection.duration_seconds || 0);
      const timer = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsed(0);
    }
  }, [connection.is_connected, connection.connected_at]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Laptop },
    { id: 'screen', label: 'Remote Screen', icon: MonitorPlay, badge: connection.is_connected ? 'LIVE' : undefined },
    { id: 'files', label: 'File Transfer', icon: ArrowLeftRight },
    { id: 'monitor', label: 'System Monitor', icon: Activity },
    { id: 'apps', label: 'Applications', icon: Boxes },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={`min-h-screen flex ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-wide text-slate-100">LAN REMOTE</h1>
            <p className="text-xs text-slate-400">Control & Monitoring</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Widget in Sidebar Bottom */}
        <div className="p-3 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Session Status</span>
              {connection.is_connected ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  Idle
                </span>
              )}
            </div>

            {connection.is_connected ? (
              <>
                <div className="text-xs text-slate-300 font-medium truncate">
                  {connection.device_name || 'Remote PC'}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{connection.ip}</span>
                  <span className="font-mono text-emerald-400">{formatDuration(elapsed)}</span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 flex items-center justify-center gap-1.5 transition"
                >
                  <Power className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </>
            ) : (
              <p className="text-[11px] text-slate-500">No active remote session</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-slate-200 capitalize">
              {currentTab.replace('-', ' ')}
            </div>
            {connection.is_connected && (
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>{connection.device_name}</span>
                <span className="text-slate-500 font-mono">({connection.ip})</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-300">
                  {connection.mode}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsDark(!isDark);
                document.documentElement.classList.toggle('dark');
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent hover:border-slate-700/60 transition"
              title="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
