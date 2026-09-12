import React, { useEffect, useState } from 'react';
import { 
  CalendarDays, Monitor, Plus, Search, 
  Shield, ShieldAlert, Lock, Edit3, KeyRound, 
  Power, Trash2, X, CheckCircle2, AlertTriangle, ChevronDown 
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface UserItem {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resettingUser, setResettingUser] = useState<UserItem | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'VIEWER',
    email: '',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    role: 'VIEWER',
    email: '',
  });

  const [newPassword, setNewPassword] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      let url = '/users?';
      const params: string[] = [];
      if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`);
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (roleFilter) params.push(`role=${encodeURIComponent(roleFilter)}`);
      
      const res = await api.get(`/users?${params.join('&')}`);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, statusFilter, roleFilter]);

  // Format date helper: 2026-08-31 08:30
  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}`;
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', formData);
      if (res.data.success) {
        showToast(`User ${formData.username} created successfully`);
        setIsAddModalOpen(false);
        setFormData({
          full_name: '',
          username: '',
          password: '',
          role: 'VIEWER',
          email: '',
        });
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create user', 'error');
    }
  };

  // Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await api.put(`/users/${editingUser.id}`, editFormData);
      if (res.data.success) {
        showToast(`User ${editingUser.username} updated successfully`);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update user', 'error');
    }
  };

  // Toggle Active/Inactive status
  const handleToggleStatus = async (user: UserItem) => {
    try {
      const res = await api.patch(`/users/${user.id}/status`);
      showToast(res.data.message || `Status updated for ${user.username}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to toggle status', 'error');
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    try {
      const res = await api.post(`/users/${resettingUser.id}/reset-password`, {
        new_password: newPassword,
      });
      showToast(res.data.message || `Password reset for ${resettingUser.username}`);
      setResettingUser(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to reset password', 'error');
    }
  };

  // Delete User
  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return;
    try {
      const res = await api.delete(`/users/${user.id}`);
      showToast(res.data.message || `User deleted`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border animate-in slide-in-from-bottom-5 ${
          toast.type === 'error' ? 'bg-rose-900 text-white border-rose-700' : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
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
          <h1 className="text-2xl font-black tracking-tight text-slate-900">User Management</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Create accounts, set roles, enable/disable users and reset passwords.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add user
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search name or username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {/* Status Dropdown */}
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border-none text-slate-600 text-xs font-bold rounded-xl px-4 py-2.5 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Role Dropdown */}
          <div className="relative">
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border-none text-slate-600 text-xs font-bold rounded-xl px-4 py-2.5 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
            >
              <option value="">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Non-Admin">Non-Admin</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[420px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-4">USER</th>
                <th className="pb-3 px-4">ROLE</th>
                <th className="pb-3 px-4">STATUS</th>
                <th className="pb-3 px-4">LAST LOGIN</th>
                <th className="pb-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <div className="mt-2 text-xs font-semibold">Loading user accounts...</div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isAdmin = u.role.toUpperCase() === 'ADMIN';
                  const isCurrent = currentUser?.username === u.username || u.username === 'admin';
                  const isSelfManaged = u.username.toLowerCase() === 'admin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* User (Name + Username) */}
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{u.full_name || u.username}</span>
                            {currentUser?.username === u.username && (
                              <span className="text-[11px] font-medium text-slate-400">(you)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            @{u.username}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold border border-indigo-100">
                            <Shield className="w-3 h-3 text-indigo-500 fill-indigo-50" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-[11px] font-bold border border-slate-200/80">
                            <Shield className="w-3 h-3 text-slate-400" />
                            Non-Admin
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-4 px-4 text-slate-600 font-medium text-xs font-mono">
                        {formatLastLogin(u.last_login_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        {isSelfManaged ? (
                          <span className="text-[11px] font-semibold text-slate-400 inline-flex items-center gap-1.5 justify-end">
                            <Lock className="w-3.5 h-3.5 text-slate-300" /> Self-managed
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-3 text-slate-400">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setEditFormData({
                                  full_name: u.full_name || '',
                                  role: u.role,
                                  email: u.email || '',
                                });
                              }}
                              title="Edit user"
                              className="hover:text-indigo-600 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResettingUser(u);
                                setNewPassword('');
                              }}
                              title="Reset password"
                              className="hover:text-amber-600 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Power (Toggle active) */}
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.is_active ? 'Disable user' : 'Enable user'}
                              className={`transition-colors ${
                                u.is_active ? 'hover:text-amber-500' : 'text-emerald-500 hover:text-emerald-600'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Delete user"
                              className="hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New User</h3>
                <p className="text-xs text-slate-400">Create login credentials and assign privileges</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Training Directorate"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. training_dir"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="Enter secure password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Role</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white text-slate-700"
                >
                  <option value="VIEWER">Non-Admin (Viewer / Operator)</option>
                  <option value="ADMIN">Admin (Full System Privileges)</option>
                </select>
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
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit User</h3>
                <p className="text-xs text-slate-400">@{editingUser.username}</p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Role</label>
                <select 
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white text-slate-700"
                >
                  <option value="VIEWER">Non-Admin</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-400">Set a new password for @{resettingUser.username}</p>
              </div>
              <button 
                onClick={() => setResettingUser(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">New Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 shadow-md shadow-amber-200 transition-all"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
