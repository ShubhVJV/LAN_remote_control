import React, { useState, useEffect } from 'react';
import {
  Boxes,
  FileText,
  Calculator,
  Palette,
  Activity,
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  AppWindow,
} from 'lucide-react';
import { ConnectionStatus, AppInfo, AppLaunchHistory } from '../types';
import { api } from '../services/api';

interface ApplicationsPageProps {
  connection: ConnectionStatus;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({ connection }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [history, setHistory] = useState<AppLaunchHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [confirmApp, setConfirmApp] = useState<AppInfo | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadApps = async () => {
    if (!connection.is_connected) return;
    setLoading(true);
    try {
      const data = await api.listApps();
      setApps(data.apps);
      setHistory(data.history);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connection.is_connected) {
      loadApps();
    }
  }, [connection.is_connected]);

  const handleLaunch = async (app: AppInfo) => {
    setConfirmApp(null);
    setLaunchingId(app.id);
    try {
      const res = await api.launchApp(app.id);
      if (res.success) {
        setToast({ type: 'success', message: res.message });
      } else {
        setToast({ type: 'error', message: res.message });
      }
      loadApps();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to launch application' });
    } finally {
      setLaunchingId(null);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileText':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'Calculator':
        return <Calculator className="w-5 h-5 text-purple-400" />;
      case 'Palette':
        return <Palette className="w-5 h-5 text-amber-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'Terminal':
        return <Terminal className="w-5 h-5 text-slate-300" />;
      default:
        return <AppWindow className="w-5 h-5 text-blue-400" />;
    }
  };

  if (!connection.is_connected) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <Boxes className="w-12 h-12 text-slate-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-200">Application Launcher Disconnected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Connect to Computer B in the Devices tab to view and launch approved applications from the remote allowlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-200">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-400" />
            Approved Remote Applications
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Restricted to allowlisted executables configured locally on Computer B. Arbitrary shell access is disabled.
          </p>
        </div>

        <button
          onClick={loadApps}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700/60 transition"
          title="Refresh Applications"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Applications Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <div
            key={app.id}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                {getIcon(app.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-slate-100 truncate">{app.name}</h4>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      app.is_available
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {app.is_available ? 'Available' : 'Missing'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{app.description}</p>
              </div>
            </div>

            <button
              onClick={() => setConfirmApp(app)}
              disabled={!app.is_available || launchingId === app.id}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                app.is_available
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {launchingId === app.id ? 'Launching...' : 'Launch Application'}
            </button>
          </div>
        ))}
      </div>

      {/* Launch History Audit Table */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> Remote Launch Audit Record
        </h3>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Controller</th>
                <th className="py-3 px-4">PID</th>
                <th className="py-3 px-4">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No applications launched during this session.
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(item.timestamp * 1000).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{item.app_id}</td>
                    <td className="py-3 px-4 text-slate-300">{item.controller}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.pid ? item.pid : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          item.success ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {item.message}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-400" />
              Launch Application?
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to request launching <strong>{confirmApp.name}</strong> on Computer B?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmApp(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLaunch(confirmApp)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
              >
                Confirm Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
