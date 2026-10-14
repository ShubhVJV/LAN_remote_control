import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Monitor,
  Wifi,
  Sliders,
  Terminal,
  Info,
  Lock,
  Save,
  Check,
} from 'lucide-react';
import { ConnectionStatus } from '../types';

interface SettingsPageProps {
  connection: ConnectionStatus;
  controllerIp: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  connection,
  controllerIp,
}) => {
  const [screenQuality, setScreenQuality] = useState(70);
  const [targetFps, setTargetFps] = useState(15);
  const [timeoutSecs, setTimeoutSecs] = useState(30);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Settings & Configuration
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure display stream parameters, connection timeouts, and view LAN security guidelines.
        </p>
      </div>

      {/* Screen & Performance Preferences */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-5">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          Desktop Streaming Preferences
        </h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">JPEG Frame Compression Quality</span>
              <span className="font-mono text-blue-400 font-bold">{screenQuality}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="95"
              step="5"
              value={screenQuality}
              onChange={(e) => setScreenQuality(parseInt(e.target.value))}
              className="w-full accent-blue-600 bg-slate-800 rounded-lg cursor-pointer h-2"
            />
            <span className="text-[11px] text-slate-500">
              Lower quality reduces LAN bandwidth; higher quality provides sharper text.
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Target Capture Frame Rate (FPS)</span>
              <span className="font-mono text-blue-400 font-bold">{targetFps} FPS</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={targetFps}
              onChange={(e) => setTargetFps(parseInt(e.target.value))}
              className="w-full accent-blue-600 bg-slate-800 rounded-lg cursor-pointer h-2"
            />
            <span className="text-[11px] text-slate-500">
              Recommended: 10–15 FPS on 2.4GHz Wi-Fi; 20–30 FPS on 5GHz / Gigabit Ethernet.
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Approval & Heartbeat Timeout</span>
              <span className="font-mono text-blue-400 font-bold">{timeoutSecs}s</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={timeoutSecs}
              onChange={(e) => setTimeoutSecs(parseInt(e.target.value))}
              className="w-full accent-blue-600 bg-slate-800 rounded-lg cursor-pointer h-2"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm flex items-center gap-1.5 transition"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Preferences Saved' : 'Save Preferences'}
        </button>
      </div>

      {/* Network & Ports Info */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-emerald-400" />
          Network Ports & Binding
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">Controller Binding</span>
            <span className="font-mono font-bold text-slate-200">{controllerIp}:8080</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">UDP Broadcast Discovery</span>
            <span className="font-mono font-bold text-slate-200">Port 50050 (UDP)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">Default Agent Port</span>
            <span className="font-mono font-bold text-slate-200">Port 8000 (TCP/WS)</span>
          </div>
        </div>
      </div>

      {/* Security Architecture & Windows Firewall Instructions */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          Security Architecture & Windows Firewall Rules
        </h3>

        <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-200 block">Windows Firewall Setup (One-time command):</span>
            <p className="text-[11px]">
              If Windows Firewall blocks discovery or remote connections between Computer A and Computer B, run this in PowerShell as Administrator:
            </p>
            <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-[11px] text-blue-300 border border-slate-800 select-all overflow-x-auto">
              New-NetFirewallRule -DisplayName "LAN Remote Control Agent" -Direction Inbound -LocalPort 8000,50050 -Protocol TCP,UDP -Action Allow
            </div>
          </div>

          <ul className="list-disc pl-5 space-y-1.5 text-[11px]">
            <li>
              <strong>Mutual Consent:</strong> Every connection requires correct pairing PIN and explicit on-screen approval on Computer B.
            </li>
            <li>
              <strong>Session Revocation:</strong> The remote user on Computer B can terminate the session at any time using the on-screen banner.
            </li>
            <li>
              <strong>Path Traversal Protection:</strong> File transfers are strictly sandboxed within the configured shared directory.
            </li>
            <li>
              <strong>Execution Allowlist:</strong> Only harmless, allowlisted applications configured in <code>agent_config.json</code> can be launched.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
