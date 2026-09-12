import React, { useEffect, useState } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, Plus, Search, 
  CheckCircle2, AlertTriangle, Clock, Server, 
  CalendarDays, Zap, Trash2, Edit3, Users, 
  ArrowUpDown, ExternalLink, X, Shield, Activity, Power
} from 'lucide-react';
import api from '../api/client';

interface DeviceItem {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  communication_password?: string | null;
  enabled: boolean;
  location?: string | null;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  connection_status: string;
  last_error?: string | null;
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  enabled: number;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_inserted?: number;
}

interface SyncLogItem {
  id: number;
  device_id: number;
  device_name: string;
  device_ip: string;
  status: string;
  logs_found: number;
  logs_inserted: number;
  logs_skipped: number;
  started_at: string;
  completed_at?: string | null;
  error_message?: string | null;
}

interface DeviceUser {
  uid: number;
  user_id: string;
  name: string;
  privilege: number;
}

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [logs, setLogs] = useState<SyncLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  
  // Actions state
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);
  const [testResultModal, setTestResultModal] = useState<{ device: string; connected: boolean; message: string; details?: any } | null>(null);
  const [deviceUsersModal, setDeviceUsersModal] = useState<{ deviceName: string; users: DeviceUser[]; loading: boolean } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: 4370,
    communication_password: '',
    location: '',
    enabled: true,
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [devRes, statsRes, logsRes] = await Promise.all([
        api.get('/devices?page_size=100'),
        api.get('/devices/stats'),
        api.get('/devices/logs?limit=15')
      ]);

      setDevices(devRes.data.data || []);
      setStats(statsRes.data.data || null);
      setLogs(logsRes.data.data || []);
    } catch (err) {
      console.error('Failed to load device information', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll stats and logs every 15s
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Test single device connection
  const handleTestConnection = async (device: DeviceItem) => {
    setTestingId(device.id);
    try {
      const res = await api.post(`/devices/${device.id}/test`);
      const data = res.data.data;
      setTestResultModal({
        device: device.name,
        connected: !!data?.connected,
        message: data?.connected ? 'Device reached successfully via LAN' : (data?.error || 'Connection timed out'),
        details: data
      });
      fetchData();
    } catch (err: any) {
      setTestResultModal({
        device: device.name,
        connected: false,
        message: err.response?.data?.message || err.message || 'Connection failed'
      });
    } finally {
      setTestingId(null);
    }
  };

  // Sync single device now
  const handleSyncDevice = async (device: DeviceItem) => {
    setSyncingId(device.id);
    try {
      const res = await api.post(`/devices/${device.id}/sync`);
      if (res.data.success) {
        showToast(`Sync complete for ${device.name}: ${res.data.data.logs_inserted} new logs ingested`);
        fetchData();
      } else {
        showToast(res.data.message || 'Sync failed', 'error');
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Sync failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  // Sync all devices
  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await api.post('/devices/sync-all');
      showToast(`Batch sync finished: ${res.data.data.success} of ${res.data.data.total} devices synced successfully`);
      fetchData();
    } catch (err: any) {
      showToast('Batch sync failed', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Toggle enable/disable
  const handleToggleEnable = async (device: DeviceItem) => {
    try {
      const endpoint = device.enabled ? `/devices/${device.id}/disable` : `/devices/${device.id}/enable`;
      await api.patch(endpoint);
      showToast(`Terminal ${device.name} ${device.enabled ? 'disabled' : 'enabled'}`);
      fetchData();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  // Fetch users on device
  const handleFetchUsers = async (device: DeviceItem) => {
    setDeviceUsersModal({ deviceName: device.name, users: [], loading: true });
    try {
      const res = await api.post(`/devices/${device.id}/users`);
      setDeviceUsersModal({
        deviceName: device.name,
        users: res.data.data || [],
        loading: false
      });
    } catch (err: any) {
      showToast(`Could not fetch users: ${err.response?.data?.detail || 'Terminal offline'}`, 'error');
      setDeviceUsersModal(null);
    }
  };

  // Create or update device
  const handleSubmitDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await api.put(`/devices/${editingDevice.id}`, formData);
        showToast(`Device ${formData.name} updated successfully`);
      } else {
        await api.post('/devices', formData);
        showToast(`Device ${formData.name} registered successfully`);
      }
      setIsAddModalOpen(false);
      setEditingDevice(null);
      setFormData({
        name: '',
        ip_address: '',
        port: 4370,
        communication_password: '',
        location: '',
        enabled: true,
      });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save device', 'error');
    }
  };

  // Delete device
  const handleDeleteDevice = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove terminal "${name}"?`)) return;
    try {
      await api.delete(`/devices/${id}`);
      showToast(`Device ${name} deleted`, 'info');
      fetchData();
    } catch (err: any) {
      showToast('Failed to delete device', 'error');
    }
  };

  // Open edit modal
  const openEditModal = (dev: DeviceItem) => {
    setEditingDevice(dev);
    setFormData({
      name: dev.name,
      ip_address: dev.ip_address,
      port: dev.port || 4370,
      communication_password: dev.communication_password || '',
      location: dev.location || '',
      enabled: dev.enabled,
    });
    setIsAddModalOpen(true);
  };

  const filteredDevices = devices.filter(d => {
    const matchesSearch = 
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'ONLINE') return matchesSearch && d.connection_status === 'ONLINE';
    if (statusFilter === 'OFFLINE') return matchesSearch && d.connection_status !== 'ONLINE';
    return matchesSearch;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-bottom-5 ${
          toastMessage.type === 'error' 
            ? 'bg-rose-900 text-white border-rose-700' 
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit mb-3 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="text-slate-400 font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Connection & Terminals</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            ZKTeco hardware management on local LAN, communication ports, and automated sync engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            disabled={isSyncingAll}
            onClick={handleSyncAll}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isSyncingAll ? 'animate-spin' : ''}`} />
            Sync all devices
          </button>
          
          <button 
            onClick={() => {
              setEditingDevice(null);
              setFormData({
                name: '',
                ip_address: '',
                port: 4370,
                communication_password: '',
                location: '',
                enabled: true,
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add terminal
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL TERMINALS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              REGISTERED TERMINALS
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {stats?.total ?? devices.length}
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              {stats?.enabled ?? devices.filter(d => d.enabled).length} enabled for sync
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
        </div>

        {/* ONLINE */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              ONLINE & REACHABLE
            </div>
            <div className="text-3xl font-black text-emerald-600 tracking-tight flex items-center gap-2">
              {stats?.online ?? devices.filter(d => d.connection_status === 'ONLINE').length}
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-[10px] font-medium text-emerald-600/80">Active LAN heartbeats</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        {/* OFFLINE */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              OFFLINE / UNREACHABLE
            </div>
            <div className="text-3xl font-black text-rose-500 tracking-tight">
              {stats?.offline ?? devices.filter(d => d.connection_status !== 'ONLINE').length}
            </div>
            <div className="text-[10px] font-medium text-slate-400">Requires physical check</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <WifiOff className="w-5 h-5" />
          </div>
        </div>

        {/* AUTO-SYNC ENGINE */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              BACKGROUND SYNC LOOP
            </div>
            <div className="text-2xl font-black text-indigo-600 tracking-tight">
              Every 30s
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              Last ingest: {stats?.last_sync_inserted ?? 0} logs inserted
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Terminals Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Terminals ({devices.length})
            </button>
            <button
              onClick={() => setStatusFilter('ONLINE')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ONLINE' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setStatusFilter('OFFLINE')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'OFFLINE' 
                  ? 'bg-white text-rose-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Offline
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search terminal, IP, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Terminals Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">TERMINAL NAME</th>
                <th className="pb-3 px-3">IP ADDRESS : PORT</th>
                <th className="pb-3 px-3">LOCATION</th>
                <th className="pb-3 px-3">STATUS</th>
                <th className="pb-3 px-3">LAST SYNC</th>
                <th className="pb-3 px-3">ENABLED</th>
                <th className="pb-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <div className="mt-2 text-xs font-semibold">Loading terminals...</div>
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                    No terminals match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => {
                  const isOnline = device.connection_status === 'ONLINE';
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 uppercase tracking-tight text-xs">
                              {device.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Protocol: ZKTeco UDP/TCP
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP Address & Port */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                          {device.ip_address}:{device.port}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {device.location || 'General Station'}
                      </td>

                      {/* Connection Status */}
                      <td className="py-3.5 px-3">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ONLINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            OFFLINE
                          </span>
                        )}
                      </td>

                      {/* Last Sync */}
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {device.last_sync_at ? (
                          <span>{new Date(device.last_sync_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                        ) : (
                          <span className="text-slate-400 italic">Not synced yet</span>
                        )}
                      </td>

                      {/* Enabled Switch */}
                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleEnable(device)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            device.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              device.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Connection Button */}
                          <button
                            disabled={testingId === device.id}
                            onClick={() => handleTestConnection(device)}
                            title="Ping and test terminal connection"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-amber-500 hover:text-amber-600 text-[11px] font-bold text-slate-600 transition-colors bg-white shadow-2xs hover:bg-amber-50/40"
                          >
                            <Zap className={`w-3 h-3 ${testingId === device.id ? 'animate-bounce text-amber-500' : 'text-amber-500'}`} />
                            Test
                          </button>

                          {/* Sync Now Button */}
                          <button
                            disabled={syncingId === device.id}
                            onClick={() => handleSyncDevice(device)}
                            title="Pull attendance logs now"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-[11px] font-bold text-slate-600 transition-colors bg-white shadow-2xs hover:bg-indigo-50/40"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === device.id ? 'animate-spin text-indigo-500' : 'text-indigo-500'}`} />
                            Sync
                          </button>

                          {/* View Users on Device */}
                          <button
                            onClick={() => handleFetchUsers(device)}
                            title="List biometric enrolled users on device"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-700 transition-colors bg-white"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(device)}
                            title="Edit configuration"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-700 transition-colors bg-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteDevice(device.id, device.name)}
                            title="Delete terminal"
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 text-slate-400 hover:text-rose-600 transition-colors bg-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Synchronization Audit Logs Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Recent Terminal Synchronization History</h2>
            <p className="text-xs text-slate-400">Idempotent audit logs generated by the scheduler and manual sync events</p>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">TERMINAL</th>
                <th className="pb-3 px-3">SYNC TIMESTAMP</th>
                <th className="pb-3 px-3">STATUS</th>
                <th className="pb-3 px-3">LOGS FOUND</th>
                <th className="pb-3 px-3">NEW INSERTED</th>
                <th className="pb-3 px-3">SKIPPED (DEDUPED)</th>
                <th className="pb-3 px-3">DURATION / NOTES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No sync logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-700">{log.device_name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{log.device_ip}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(log.started_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" /> SUCCESS
                        </span>
                      ) : log.status === 'RUNNING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> RUNNING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                          <AlertTriangle className="w-2.5 h-2.5" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {log.logs_found}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">
                      +{log.logs_inserted}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {log.logs_skipped}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {log.error_message ? (
                        <span className="text-rose-500 font-medium">{log.error_message}</span>
                      ) : (
                        <span className="text-slate-400">Clean sync</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Terminal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingDevice ? 'Edit Terminal' : 'Register New Terminal'}
                </h3>
                <p className="text-xs text-slate-400">Configure ZKTeco device LAN parameters</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDevice} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Terminal Display Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Main Gate Terminal (MB460)"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-600 mb-1">IP Address</label>
                  <input 
                    type="text" 
                    required
                    placeholder="192.168.1.201"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Port</label>
                  <input 
                    type="number" 
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({...formData, port: parseInt(e.target.value) || 4370})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Comm Password (Key)</label>
                  <input 
                    type="password" 
                    placeholder="Leave 0 or blank"
                    value={formData.communication_password}
                    onChange={(e) => setFormData({...formData, communication_password: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Physical Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Barrack 2 Entrance"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="dev-enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="dev-enabled" className="font-bold text-slate-700 cursor-pointer">
                  Enable automated sync for this terminal
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                >
                  {editingDevice ? 'Save Changes' : 'Register Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Result Modal */}
      {testResultModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${testResultModal.connected ? 'text-emerald-500' : 'text-rose-500'}`} />
                <h3 className="text-sm font-bold text-slate-900">Diagnostic Ping: {testResultModal.device}</h3>
              </div>
              <button 
                onClick={() => setTestResultModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-2xl flex items-center gap-3 ${
                testResultModal.connected ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
              }`}>
                {testResultModal.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold">{testResultModal.connected ? 'Connection Established' : 'Connection Failed'}</div>
                  <div className="text-[11px] opacity-90">{testResultModal.message}</div>
                </div>
              </div>

              {testResultModal.details && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-slate-600">
                  {testResultModal.details.firmware_version && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Firmware Version</span>
                      <span className="font-mono font-bold">{testResultModal.details.firmware_version}</span>
                    </div>
                  )}
                  {testResultModal.details.serial_number && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Serial Number</span>
                      <span className="font-mono font-bold">{testResultModal.details.serial_number}</span>
                    </div>
                  )}
                  {testResultModal.details.device_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Device Model</span>
                      <span className="font-bold">{testResultModal.details.device_name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setTestResultModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Enrolled Users Modal */}
      {deviceUsersModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Enrolled Users on Terminal</h3>
                <p className="text-xs text-slate-400">{deviceUsersModal.deviceName} (Internal Memory Dump)</p>
              </div>
              <button 
                onClick={() => setDeviceUsersModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto pr-1">
              {deviceUsersModal.loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                  <div className="mt-2 font-semibold">Reading terminal memory over LAN...</div>
                </div>
              ) : deviceUsersModal.users.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-medium">
                  No users currently enrolled in this terminal's local database.
                </div>
              ) : (
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="pb-2">PIN / USER ID</th>
                      <th className="pb-2">ENROLLED NAME</th>
                      <th className="pb-2 text-right">PRIVILEGE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {deviceUsersModal.users.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-bold text-slate-700">{u.user_id}</td>
                        <td className="py-2 font-medium text-slate-800 uppercase">{u.name || `User #${u.user_id}`}</td>
                        <td className="py-2 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.privilege === 14 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.privilege === 14 ? 'Admin' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeviceUsersModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Devices;
