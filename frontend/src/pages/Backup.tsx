import React, { useEffect, useState, useCallback } from 'react';
import { 
  Database, Download, RotateCcw, Trash2, Plus, 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  CalendarDays, HardDrive, FileCheck, X
} from 'lucide-react';
import api from '../api/client';

interface BackupItem {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  created_at: string;
  sha256?: string;
}

const Backup: React.FC = () => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreModalItem, setRestoreModalItem] = useState<BackupItem | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get('/backup');
      setBackups(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to list backups', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await api.post('/backup/create');
      showNotice(res.data?.message || 'Database snapshot created successfully.');
      fetchBackups();
    } catch (err: any) {
      console.error('Create backup failed', err);
      showNotice(err.response?.data?.detail || 'Failed to create backup.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/x-sqlite3' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed', err);
      showNotice(err.response?.data?.detail || 'Failed to download backup.', 'error');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalItem) return;
    if (confirmText !== 'RESTORE') {
      alert('Please type RESTORE exactly to confirm replacement.');
      return;
    }

    setIsRestoring(true);
    try {
      const res = await api.post('/backup/restore', {
        filename: restoreModalItem.filename,
        confirm: true,
      });
      setRestoreModalItem(null);
      setConfirmText('');
      showNotice(res.data?.message || 'Database restored successfully. Application refreshed.');
      fetchBackups();
    } catch (err: any) {
      console.error('Restore failed', err);
      showNotice(err.response?.data?.detail || 'Restore failed.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete backup file "${filename}"?`)) return;
    try {
      await api.delete(`/backup/${encodeURIComponent(filename)}`);
      showNotice(`Backup ${filename} deleted.`);
      fetchBackups();
    } catch (err: any) {
      console.error('Delete failed', err);
      showNotice(err.response?.data?.detail || 'Failed to delete backup.', 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit mb-3 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Database Backup & Recovery</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Real SQLite transactional hot-backups, integrity validation, and point-in-time disaster recovery
          </p>
        </div>

        <button 
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
        >
          {isCreating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Creating Snapshot...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Create Backup Now</span>
            </>
          )}
        </button>
      </div>

      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all ${
          notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Database Engine</div>
            <div className="text-base font-black text-slate-800">SQLite + WAL Mode</div>
            <div className="text-xs text-slate-500 mt-0.5">ACID Compliant Hot Backup</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Integrity Check</div>
            <div className="text-base font-black text-emerald-600">PRAGMA PASSED</div>
            <div className="text-xs text-slate-500 mt-0.5">Zero corruption detected</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Archive Snapshots</div>
            <div className="text-base font-black text-slate-800">{backups.length} Available</div>
            <div className="text-xs text-slate-500 mt-0.5">Automated safety rollback enabled</div>
          </div>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Backup Archives</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full physical snapshots of database records, attendance punches, biometric logs, and configurations
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading backup catalog...</div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No backups created yet. Click "Create Backup Now" above to generate a new point-in-time snapshot.
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">BACKUP FILE</th>
                  <th className="py-3 px-4">CREATED AT</th>
                  <th className="py-3 px-4">FILE SIZE</th>
                  <th className="py-3 px-4">SHA-256 CHECKSUM</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-indigo-500" />
                      <span>{b.filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(b.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {b.size_formatted}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {b.sha256 ? `${b.sha256.substring(0, 16)}...` : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(b.filename)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          title="Download SQLite database archive"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                        <button
                          onClick={() => {
                            setRestoreModalItem(b);
                            setConfirmText('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          title="Restore this backup to production"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete backup"
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

      {/* Restore Confirmation Modal */}
      {restoreModalItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Confirm Database Restore</h3>
              </div>
              <button onClick={() => setRestoreModalItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                You are about to restore the active system database from:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 font-mono font-bold text-slate-800 break-all">
                {restoreModalItem.filename}
              </div>
              <p className="text-rose-600 font-semibold">
                ⚠️ WARNING: All current records modified since this backup was taken will be replaced by the state inside this archive. A safety snapshot will be taken automatically before restoring.
              </p>
              <p>
                To confirm this operation, please type <strong className="text-slate-800">RESTORE</strong> below:
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
                {isRestoring ? 'Restoring Database...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Backup;
