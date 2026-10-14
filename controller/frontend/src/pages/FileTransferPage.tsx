import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Home,
  HardDrive,
  FileCheck,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { ConnectionStatus, DirectoryListing, FileItem, FileTransferProgress } from '../types';
import { api } from '../services/api';

interface FileTransferPageProps {
  connection: ConnectionStatus;
}

export const FileTransferPage: React.FC<FileTransferPageProps> = ({ connection }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<FileTransferProgress[]>([]);
  const [deleteModalPath, setDeleteModalPath] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledTransfersRef = useRef<Set<string>>(new Set());

  const loadDirectory = async (path: string = '') => {
    if (!connection.is_connected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listFiles(path);
      setFiles(data.items);
      setCurrentPath(data.current_path);
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connection.is_connected) {
      loadDirectory('');
    }
  }, [connection.is_connected]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const handleFolderClick = (item: FileItem) => {
    if (item.is_dir) {
      loadDirectory(item.path);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      loadDirectory('');
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    const target = parts.slice(0, index + 1).join('/');
    loadDirectory(target);
  };

  // Upload Handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const transferId = `upload_${Date.now()}_${i}`;

      const newTransfer: FileTransferProgress = {
        id: transferId,
        filename: file.name,
        direction: 'upload',
        totalBytes: file.size,
        transferredBytes: 0,
        speedKbps: 0,
        progressPercent: 0,
        status: 'transferring',
      };

      setTransfers((prev) => [newTransfer, ...prev]);

      try {
        const res = await api.uploadFileChunked(
          file,
          currentPath,
          (transferred, total, speed) => {
            const pct = Math.round((transferred / total) * 100);
            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      transferredBytes: transferred,
                      progressPercent: pct,
                      speedKbps: Math.round(speed),
                    }
                  : t
              )
            );
          },
          () => cancelledTransfersRef.current.has(transferId)
        );

        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? { ...t, status: 'completed', sha256: res.sha256 }
              : t
          )
        );
        loadDirectory(currentPath);
      } catch (err: any) {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? { ...t, status: 'failed', error: err.message }
              : t
          )
        );
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download Handling
  const handleDownload = (item: FileItem) => {
    window.location.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
  };

  // Delete Handling
  const confirmDelete = async () => {
    if (!deleteModalPath) return;
    try {
      await api.deleteFile(deleteModalPath);
      setDeleteModalPath(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  if (!connection.is_connected) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <HardDrive className="w-12 h-12 text-slate-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-200">File Manager Disconnected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Establish an authenticated session with Computer B in the Devices tab to browse and transfer files.
        </p>
      </div>
    );
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Bar with Breadcrumbs & Actions */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono overflow-x-auto py-1">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className="flex items-center gap-1 hover:text-blue-400 text-slate-400 transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>shared_root</span>
          </button>
          {breadcrumbs.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="hover:text-blue-400 transition"
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700/60 transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Files Table */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Date Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Directory is empty or no files found.
                  </td>
                </tr>
              ) : (
                files.map((item) => (
                  <tr
                    key={item.path}
                    className="hover:bg-slate-800/30 transition group cursor-pointer"
                    onClick={() => item.is_dir && handleFolderClick(item)}
                  >
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      {item.is_dir ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : (
                        <File className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="font-medium text-slate-200">{item.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {item.is_dir ? '--' : formatBytes(item.size)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatDate(item.modified)}</td>
                    <td className="py-3 px-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!item.is_dir && (
                          <button
                            onClick={() => handleDownload(item)}
                            className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModalPath(item.path)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active & Recent Transfers Panel */}
      {transfers.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Transfers & Verification
          </h4>
          <div className="space-y-2">
            {transfers.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-slate-200">
                    {t.direction === 'upload' ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{t.filename}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span>{formatBytes(t.transferredBytes)} / {formatBytes(t.totalBytes)}</span>
                    {t.status === 'transferring' && <span>({t.speedKbps} KB/s)</span>}
                    {t.status === 'completed' && (
                      <span className="text-emerald-400 flex items-center gap-1 font-sans">
                        <CheckCircle2 className="w-3 h-3" /> Verified (SHA-256)
                      </span>
                    )}
                    {t.status === 'failed' && (
                      <span className="text-rose-400">{t.error || 'Failed'}</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      t.status === 'completed'
                        ? 'bg-emerald-500'
                        : t.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${t.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalPath && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-slate-100">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete:
              <br />
              <span className="font-mono text-slate-100 break-all">{deleteModalPath}</span>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalPath(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
