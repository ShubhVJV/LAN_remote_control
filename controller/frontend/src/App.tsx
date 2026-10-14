import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DevicesPage } from './pages/DevicesPage';
import { RemoteScreenPage } from './pages/RemoteScreenPage';
import { FileTransferPage } from './pages/FileTransferPage';
import { SystemMonitorPage } from './pages/SystemMonitorPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Device, ConnectionStatus, SystemMetrics } from './types';
import { api } from './services/api';
import { Shield, Lock, MousePointer, Eye, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('overview');
  const [devices, setDevices] = useState<Device[]>([]);
  const [controllerIp, setControllerIp] = useState('127.0.0.1');
  const [connection, setConnection] = useState<ConnectionStatus>({
    is_connected: false,
    device_id: null,
    device_name: null,
    ip: null,
    port: null,
    mode: null,
    duration_seconds: 0,
    connected_at: null,
  });
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  // Connect Modal state
  const [connectModalDevice, setConnectModalDevice] = useState<Device | null>(null);
  const [connectPin, setConnectPin] = useState('123456');
  const [connectMode, setConnectMode] = useState<'interactive' | 'view_only'>('interactive');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const metricsWsRef = useRef<WebSocket | null>(null);

  // Poll for discovered devices and connection status
  const refreshDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data.devices);
      if (data.controller_ip) {
        setControllerIp(data.controller_ip);
      }
    } catch (e) {
      console.error('Failed to refresh devices:', e);
    }
  };

  const refreshConnectionStatus = async () => {
    try {
      const status = await api.getConnectionStatus();
      setConnection(status);
    } catch (e) {
      console.error('Failed to refresh connection status:', e);
    }
  };

  useEffect(() => {
    refreshDevices();
    refreshConnectionStatus();

    const devInterval = setInterval(refreshDevices, 3000);
    const connInterval = setInterval(refreshConnectionStatus, 3000);

    return () => {
      clearInterval(devInterval);
      clearInterval(connInterval);
    };
  }, []);

  // WebSocket for Live System Metrics
  useEffect(() => {
    if (connection.is_connected) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/metrics`;
      const ws = new WebSocket(wsUrl);
      metricsWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMetrics(data);
        } catch (e) {
          console.error('Error parsing metrics:', e);
        }
      };

      ws.onclose = () => {
        // Fallback polling
      };

      return () => {
        ws.close();
      };
    } else {
      setMetrics(null);
    }
  }, [connection.is_connected]);

  // Connect Handler
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectModalDevice) return;

    setConnecting(true);
    setConnectError(null);

    try {
      const res = await api.connect(
        connectModalDevice.ip,
        connectModalDevice.port,
        connectPin,
        connectMode
      );
      setConnection(res.connection);
      setConnectModalDevice(null);
      setCurrentTab('overview');
    } catch (err: any) {
      setConnectError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Handler
  const handleDisconnect = async () => {
    try {
      await api.disconnect();
      setConnection({
        is_connected: false,
        device_id: null,
        device_name: null,
        ip: null,
        port: null,
        mode: null,
        duration_seconds: 0,
        connected_at: null,
      });
      setMetrics(null);
      if (currentTab === 'screen') {
        setCurrentTab('overview');
      }
    } catch (e) {
      console.error('Disconnect error:', e);
    }
  };

  const handleAddManualDevice = async (ip: string, port: number) => {
    await api.addManualDevice(ip, port);
    await refreshDevices();
  };

  return (
    <AppLayout
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      connection={connection}
      onDisconnect={handleDisconnect}
    >
      {currentTab === 'overview' && (
        <OverviewPage
          devices={devices}
          connection={connection}
          metrics={metrics}
          onNavigate={(tab) => setCurrentTab(tab)}
          onConnectClick={(dev) => {
            setConnectModalDevice(dev);
            setConnectError(null);
          }}
          onDisconnect={handleDisconnect}
          onRefreshDevices={refreshDevices}
        />
      )}

      {currentTab === 'devices' && (
        <DevicesPage
          devices={devices}
          connection={connection}
          controllerIp={controllerIp}
          onRefreshDevices={refreshDevices}
          onConnectClick={(dev) => {
            setConnectModalDevice(dev);
            setConnectError(null);
          }}
          onDisconnect={handleDisconnect}
          onAddManualDevice={handleAddManualDevice}
        />
      )}

      {currentTab === 'screen' && (
        <RemoteScreenPage
          connection={connection}
          onDisconnect={handleDisconnect}
        />
      )}

      {currentTab === 'files' && (
        <FileTransferPage connection={connection} />
      )}

      {currentTab === 'monitor' && (
        <SystemMonitorPage connection={connection} metrics={metrics} />
      )}

      {currentTab === 'apps' && (
        <ApplicationsPage connection={connection} />
      )}

      {currentTab === 'settings' && (
        <SettingsPage connection={connection} controllerIp={controllerIp} />
      )}

      {/* Connect Modal */}
      {connectModalDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Connect to {connectModalDevice.device_name}
              </h3>
              <button
                onClick={() => setConnectModalDevice(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <div>IP Address: <span className="font-mono text-slate-200">{connectModalDevice.ip}:{connectModalDevice.port}</span></div>
                <div>OS: <span className="text-slate-200">{connectModalDevice.os_info}</span></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" /> Pairing PIN
                </label>
                <input
                  type="password"
                  placeholder="e.g. 123456"
                  value={connectPin}
                  onChange={(e) => setConnectPin(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono tracking-widest focus:outline-none focus:border-blue-500/50"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Configured PIN on Computer B (Default: 123456)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Requested Session Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectMode('interactive')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      connectMode === 'interactive'
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <MousePointer className="w-3.5 h-3.5" />
                      Interactive
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Screen, mouse, keyboard & app launch
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectMode('view_only')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      connectMode === 'view_only'
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      View Only
                    </div>
                    <span className="text-[10px] text-slate-400">
                      View screen & monitoring metrics only
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  After clicking Connect, an explicit approval prompt will pop up on Computer B's desktop. The remote user must click <strong>Accept</strong> within 30 seconds.
                </span>
              </div>

              {connectError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  {connectError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectModalDevice(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {connecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Awaiting Remote Approval...
                    </>
                  ) : (
                    'Request Session'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
