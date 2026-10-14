import React, { useState } from 'react';
import {
  Laptop,
  Wifi,
  Search,
  RefreshCw,
  Plus,
  Shield,
  MonitorPlay,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { Device, ConnectionStatus } from '../types';

interface DevicesPageProps {
  devices: Device[];
  connection: ConnectionStatus;
  controllerIp: string;
  onRefreshDevices: () => void;
  onConnectClick: (device: Device) => void;
  onDisconnect: () => void;
  onAddManualDevice: (ip: string, port: number) => Promise<void>;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  devices,
  connection,
  controllerIp,
  onRefreshDevices,
  onConnectClick,
  onDisconnect,
  onAddManualDevice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState(8000);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ip.includes(searchTerm) ||
      d.os_info.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp) return;
    setManualLoading(true);
    setManualError(null);
    try {
      await onAddManualDevice(manualIp, manualPort);
      setShowManualModal(false);
      setManualIp('');
    } catch (err: any) {
      setManualError(err.message || 'Failed to add manual device');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Laptop className="w-5 h-5 text-blue-400" />
            LAN Devices
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Controller bound to LAN IP: <span className="font-mono text-blue-400">{controllerIp}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700/60 transition"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            Manual IP Connect
          </button>

          <button
            onClick={onRefreshDevices}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Scan LAN
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, IP, or OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          {(['all', 'online', 'offline'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setStatusFilter(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition ${
                statusFilter === mode
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Devices List Table */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Device</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">OS / Platform</th>
                <th className="py-3 px-4">Capabilities</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching devices discovered on the network.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => {
                  const isCurrent =
                    connection.is_connected && connection.device_id === device.device_id;
                  const isOnline = device.status === 'online';

                  return (
                    <tr
                      key={device.device_id}
                      className={`hover:bg-slate-800/30 transition ${
                        isCurrent ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-blue-400" />
                          {device.device_name}
                          {device.is_manual && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              Manual
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {device.ip}:{device.port}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">{device.os_info}</td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {device.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                          />
                          {device.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {device.seconds_since_seen}s ago
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isCurrent ? (
                          <button
                            onClick={onDisconnect}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => onConnectClick(device)}
                            disabled={!isOnline}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              isOnline
                                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            Connect
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Device Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                Add Device by IP Address
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Machine LAN IP Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.105"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500/50"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use this if UDP broadcast discovery is disabled on your router.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Agent Port
                </label>
                <input
                  type="number"
                  value={manualPort}
                  onChange={(e) => setManualPort(parseInt(e.target.value) || 8000)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {manualError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition shadow-sm disabled:opacity-50"
                >
                  {manualLoading ? 'Testing...' : 'Add & Discover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
