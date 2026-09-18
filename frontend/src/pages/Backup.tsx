import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Database, Download, RotateCcw, Trash2, Plus, Upload,
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  CalendarDays, HardDrive, FileCheck, X, Users,
} from 'lucide-react';
import api from '../api/client';

interface BackupItem {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string;
  sha256?: string;
  summary?: Record<string, number>;
  record_counts?: Record<string, number>;
}

interface LiveDatabase {
  engine?: string;
  path: string;
  exists: boolean;
  size_formatted: string;
  summary?: Record<string, number>;
}

const Backup: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [liveDb, setLiveDb] = useState<LiveDatabase | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreModalItem, setRestoreModalItem] = useState<BackupItem | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 6000);
  };

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get('/backup');
      const payload = res.data?.data;
      setLiveDb(payload?.live_database || null);
      setBackups(Array.isArray(payload?.backups) ? payload.backups : []);
    } catch (err: any) {
      console.error('Failed to list backups', err);
      showNotice(err.response?.data?.detail || 'Failed to load backups.', 'error');
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await api.post('/backup/create');
      showNotice(res.data?.message || 'Database snapshot created.');
      await fetchBackups();
    } catch (err: any) {
      showNotice(err.response?.data?.detail || 'Failed to create backup.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showNotice(err.response?.data?.detail || 'Failed to download backup.', 'error');
    }
  };

  const restoreFromFilename = async (filename: string) => {
    const res = await api.post(`/backup/restore?filename=${encodeURIComponent(filename)}`);
    return res.data;
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalItem) return;
    if (confirmText !== 'RESTORE') {
      showNotice('Type RESTORE exactly to confirm.', 'error');
      return;
    }
    setIsRestoring(true);
    try {
      const data = await restoreFromFilename(restoreModalItem.filename);
      setRestoreModalItem(null);
      setConfirmText('');
      showNotice(data?.message || 'Database restored. Reload the page to see updated records.');
      await fetchBackups();
    } catch (err: any) {
      showNotice(err.response?.data?.detail || 'Restore failed.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUploadRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.db') && !file.name.toLowerCase().endsWith('.zip')) {
      showNotice('Upload a .zip (PostgreSQL) or .db (SQLite) backup file.', 'error');
      return;
    }
    if (!window.confirm(`Restore the live database from uploaded file "${file.name}"? A safety copy will be saved first.`)) {
      return;
    }
    setIsRestoring(true);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await api.post('/backup/restore/upload', form);
      showNotice(res.data?.message || 'Database restored from upload.');
      await fetchBackups();
    } catch (err: any) {
      showNotice(err.response?.data?.detail || 'Upload restore failed.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/backup/${encodeURIComponent(filename)}`);
      showNotice(`Backup ${filename} deleted.`);
      await fetchBackups();
    } catch (err: any) {
      showNotice(err.response?.data?.detail || 'Failed to delete backup.', 'error');
    }
  };

  const livePersonnel = liveDb?.summary?.personnel ?? 0;
  const livePunches = liveDb?.summary?.attendance_punches ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit mb-3 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Backup & Restore</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Snapshot the live SQLite database, download copies, and restore with a safety copy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.zip"
            className="hidden"
            onChange={handleUploadRestore}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring || isCreating}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Restore from file
          </button>
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={isCreating || isRestoring}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating snapshot...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create backup
              </>
            )}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
          notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{notice.message}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live database</div>
            <div className="text-base font-black text-slate-800">
              {liveDb?.engine === 'postgresql' ? 'PostgreSQL' : liveDb?.path || 'attendance.db'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {liveDb?.size_formatted || '—'} · {liveDb?.exists ? 'online' : 'missing'}
              {liveDb?.path && liveDb?.engine === 'postgresql' ? ` · ${liveDb.path}` : ''}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current records</div>
            <div className="text-base font-black text-slate-800">{livePersonnel.toLocaleString()} personnel</div>
            <div className="text-xs text-slate-500 mt-0.5">{livePunches.toLocaleString()} punches stored</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Archives</div>
            <div className="text-base font-black text-slate-800">{backups.length} available</div>
            <div className="text-xs text-slate-500 mt-0.5">Safety copy is created before every restore</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Backup archives</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personnel, attendance, devices, and settings as a single .db file
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" /> Integrity checked on restore
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading backup catalog...</div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No backups yet. Click Create backup to take a snapshot of the live database.
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Backup file</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Personnel</th>
                  <th className="py-3 px-4">Checksum</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-indigo-500" />
                        <span>{b.filename}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(b.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">{b.size_formatted}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {(b.summary?.personnel ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {b.sha256 ? `${b.sha256.substring(0, 16)}…` : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(b.filename)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreModalItem(b);
                            setConfirmText('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBackup(b.filename)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {restoreModalItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Confirm restore</h3>
              </div>
              <button type="button" onClick={() => setRestoreModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>This replaces the live database with:</p>
              <div className="p-2.5 rounded-xl bg-slate-50 font-mono font-bold text-slate-800 break-all">
                {restoreModalItem.filename}
              </div>
              <p className="text-rose-600 font-semibold">
                Current data will be overwritten. A safety snapshot is saved first. Type RESTORE to continue.
              </p>
              <input
                type="text"
                placeholder="Type RESTORE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestoreModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmText !== 'RESTORE' || isRestoring}
                onClick={handleConfirmRestore}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-40 shadow-md"
              >
                {isRestoring ? 'Restoring...' : 'Confirm restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backup;
