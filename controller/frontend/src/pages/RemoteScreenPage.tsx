import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MonitorPlay,
  Maximize2,
  Minimize2,
  MousePointer,
  Eye,
  Power,
  AlertCircle,
  Wifi,
  Keyboard,
  Send,
  CornerDownLeft,
  Delete,
  Command,
} from 'lucide-react';
import { ConnectionStatus } from '../types';

interface RemoteScreenPageProps {
  connection: ConnectionStatus;
  onDisconnect: () => void;
}

export const RemoteScreenPage: React.FC<RemoteScreenPageProps> = ({
  connection,
  onDisconnect,
}) => {
  const [isInteractive, setIsInteractive] = useState(
    connection.mode === 'interactive'
  );
  const [controlActive, setControlActive] = useState(true);
  const [fps, setFps] = useState<number>(0);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [quickText, setQuickText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenWsRef = useRef<WebSocket | null>(null);
  const controlWsRef = useRef<WebSocket | null>(null);

  // FPS calculation
  const frameCountRef = useRef(0);
  const lastFpsCalcRef = useRef(Date.now());

  // WebSocket connections for Screen and Control
  useEffect(() => {
    if (!connection.is_connected) {
      setStreamStatus('disconnected');
      return;
    }

    setStreamStatus('connecting');

    // 1. Screen Stream WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const screenWsUrl = `${protocol}//${window.location.host}/ws/screen`;
    const screenWs = new WebSocket(screenWsUrl);
    screenWs.binaryType = 'arraybuffer';
    screenWsRef.current = screenWs;

    screenWs.onopen = () => {
      setStreamStatus('live');
      // Auto-focus container so keyboard is immediately active
      setTimeout(() => {
        containerRef.current?.focus();
        setIsKeyboardFocused(true);
      }, 300);
    };

    screenWs.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        try {
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          const imgBitmap = await createImageBitmap(blob);

          const canvas = canvasRef.current;
          if (canvas) {
            if (canvas.width !== imgBitmap.width || canvas.height !== imgBitmap.height) {
              canvas.width = imgBitmap.width;
              canvas.height = imgBitmap.height;
              setResolution({ width: imgBitmap.width, height: imgBitmap.height });
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(imgBitmap, 0, 0);
            }
          }
          imgBitmap.close();

          frameCountRef.current += 1;
          const now = Date.now();
          if (now - lastFpsCalcRef.current >= 1000) {
            setFps(
              Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcRef.current))
            );
            frameCountRef.current = 0;
            lastFpsCalcRef.current = now;
          }
        } catch (e) {
          console.error('Frame decode error:', e);
        }
      }
    };

    screenWs.onerror = () => {
      setStreamStatus('disconnected');
    };

    screenWs.onclose = () => {
      setStreamStatus('disconnected');
    };

    // 2. Control Events WebSocket
    const controlWsUrl = `${protocol}//${window.location.host}/ws/control`;
    const controlWs = new WebSocket(controlWsUrl);
    controlWsRef.current = controlWs;

    return () => {
      screenWs.close();
      controlWs.close();
    };
  }, [connection.is_connected]);

  // Send input event to backend
  const sendControlEvent = useCallback((event: any) => {
    if (
      controlActive &&
      isInteractive &&
      controlWsRef.current &&
      controlWsRef.current.readyState === WebSocket.OPEN
    ) {
      controlWsRef.current.send(JSON.stringify(event));
    }
  }, [controlActive, isInteractive]);

  // Mouse Handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    sendControlEvent({
      event_type: 'mouse_move',
      x,
      y,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Focus the keyboard container on canvas click
    containerRef.current?.focus();
    setIsKeyboardFocused(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let button = 'left';
    if (e.button === 2) button = 'right';
    else if (e.button === 1) button = 'middle';

    sendControlEvent({
      event_type: 'mouse_down',
      x,
      y,
      button,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let button = 'left';
    if (e.button === 2) button = 'right';
    else if (e.button === 1) button = 'middle';

    sendControlEvent({
      event_type: 'mouse_up',
      x,
      y,
      button,
    });
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    sendControlEvent({
      event_type: 'mouse_double_click',
      x,
      y,
      button: 'left',
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const dy = e.deltaY < 0 ? 1 : -1;
    sendControlEvent({
      event_type: 'mouse_scroll',
      dx: 0,
      dy,
    });
  };

  // Keyboard Handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !controlActive) return;
    // Prevent default browser shortcuts when focused on the screen (e.g. Backspace, Tab, Space)
    if (['Tab', 'Backspace', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    sendControlEvent({
      event_type: 'key_down',
      key: e.key,
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !controlActive) return;
    if (['Tab', 'Backspace', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    sendControlEvent({
      event_type: 'key_up',
      key: e.key,
    });
  };

  // Quick Text & Hotkey Send Handlers
  const handleSendQuickText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickText) return;
    sendControlEvent({
      event_type: 'type_text',
      text: quickText,
    });
    setQuickText('');
    containerRef.current?.focus();
  };

  const handleSendHotkey = (hotkey: string) => {
    sendControlEvent({
      event_type: 'hotkey',
      hotkey,
    });
    containerRef.current?.focus();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  if (!connection.is_connected) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-200">No Active Remote Desktop Session</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Connect to an agent in the Devices tab first to start live desktop viewing and authorized input control.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col space-y-3 ${
        isFullscreen ? 'p-4 bg-slate-950 fixed inset-0 z-50 overflow-hidden' : 'max-w-7xl mx-auto'
      }`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onFocus={() => setIsKeyboardFocused(true)}
      onBlur={() => setIsKeyboardFocused(false)}
      style={{ outline: 'none' }}
    >
      {/* Top Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Left: Device & Stream Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                streamStatus === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-semibold text-slate-200">
              {connection.device_name}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono border-l border-slate-800 pl-3">
            <span>{resolution.width}x{resolution.height}</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">{fps} FPS</span>
          </div>

          {/* Mode Pill */}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
              isInteractive && controlActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            {isInteractive && controlActive ? (
              <>
                <MousePointer className="w-3 h-3" /> Interactive Control
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" /> View Only
              </>
            )}
          </span>

          {/* Keyboard Focus Pill */}
          {isInteractive && controlActive && (
            <button
              onClick={() => containerRef.current?.focus()}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 transition ${
                isKeyboardFocused
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
              title="Click to focus keyboard input"
            >
              <Keyboard className="w-3 h-3" />
              {isKeyboardFocused ? 'Keyboard Active' : 'Click Screen to Type'}
            </button>
          )}
        </div>

        {/* Right: Actions & Controls */}
        <div className="flex items-center gap-2">
          {isInteractive && (
            <button
              onClick={() => setControlActive(!controlActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                controlActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {controlActive ? 'Pause Control' : 'Resume Control'}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700/60"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 flex items-center gap-1.5 transition"
          >
            <Power className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Screen Canvas Container */}
      <div
        onClick={() => {
          containerRef.current?.focus();
          setIsKeyboardFocused(true);
        }}
        className={`relative flex-1 min-h-[480px] flex items-center justify-center rounded-2xl bg-slate-950 border overflow-hidden shadow-2xl transition ${
          isKeyboardFocused
            ? 'border-blue-500/50 ring-1 ring-blue-500/30'
            : 'border-slate-800/80'
        }`}
      >
        {streamStatus === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Connecting to remote desktop feed...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className={`max-w-full max-h-[76vh] object-contain cursor-${
            isInteractive && controlActive ? 'crosshair' : 'default'
          }`}
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Keyboard & Quick Text Bar */}
      {isInteractive && controlActive && (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Quick String Type Form */}
          <form
            onSubmit={handleSendQuickText}
            className="flex items-center gap-2 flex-1 max-w-lg"
          >
            <input
              type="text"
              placeholder="Type or paste text to send to remote computer..."
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
            <button
              type="submit"
              disabled={!quickText}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Type Text
            </button>
          </form>

          {/* Quick Virtual Key Shortcuts */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <span className="text-[11px] text-slate-500 mr-1 hidden md:inline">Hotkeys:</span>

            <button
              onClick={() => handleSendHotkey('win')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition"
              title="Windows Key"
            >
              ⊞ Win
            </button>

            <button
              onClick={() => handleSendHotkey('alt+tab')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition"
              title="Alt + Tab"
            >
              Alt+Tab
            </button>

            <button
              onClick={() => handleSendHotkey('ctrl+c')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition"
              title="Copy"
            >
              Ctrl+C
            </button>

            <button
              onClick={() => handleSendHotkey('ctrl+v')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition"
              title="Paste"
            >
              Ctrl+V
            </button>

            <button
              onClick={() => handleSendHotkey('escape')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition"
              title="Escape"
            >
              Esc
            </button>

            <button
              onClick={() => handleSendHotkey('enter')}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700/60 transition flex items-center gap-1"
              title="Enter"
            >
              <CornerDownLeft className="w-3 h-3" /> Enter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
