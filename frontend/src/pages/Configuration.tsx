import React, { useEffect, useState, useRef } from 'react';
import { 
  CalendarDays, Sliders, Image as ImageIcon, Upload, 
  CheckCircle2, AlertTriangle, Shield, Award, Plus, 
  Trash2, Edit3, X, Save, Building2, GraduationCap, Calendar
} from 'lucide-react';
import api from '../api/client';

interface BrandingData {
  acronym: string;
  display_name: string;
  legal_name: string;
  system_name: string;
  tagline: string;
  logo_url: string;
}

interface RangesData {
  trainee_pin_min: number;
  trainee_pin_max: number;
  staff_pin_min: number;
}

interface RankItem {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  active: boolean;
}

interface DepartmentItem {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

interface CourseItem {
  id: number;
  name: string;
  code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
}

const Configuration: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<BrandingData>({
    acronym: 'PTS',
    display_name: 'Police Training School Rawat',
    legal_name: 'Police Training School, Rawat — Rawalpindi',
    system_name: 'Biometric Attendance Management System',
    tagline: 'Train to Serve',
    logo_url: '/pts_logo.png',
  });

  const [ranges, setRanges] = useState<RangesData>({
    trainee_pin_min: 1,
    trainee_pin_max: 2000,
    staff_pin_min: 2001,
  });

  const [designations, setDesignations] = useState<string[]>([]);
  const [ranks, setRanks] = useState<RankItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);

  // UI States
  const [newDesignation, setNewDesignation] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingRanges, setSavingRanges] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add / Edit Rank Modal
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);
  const [editingRank, setEditingRank] = useState<RankItem | null>(null);
  const [rankForm, setRankForm] = useState({ name: '', code: '', sort_order: 1 });

  // Add / Edit Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  // Add / Edit Course Modal
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseForm, setCourseForm] = useState({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAllConfig = async () => {
    try {
      const [settingsRes, ranksRes, deptsRes, coursesRes] = await Promise.all([
        api.get('/settings'),
        api.get('/ranks?page_size=100'),
        api.get('/departments?page_size=100'),
        api.get('/courses?page_size=100'),
      ]);

      if (settingsRes.data.success) {
        setBranding(settingsRes.data.data.branding);
        setRanges(settingsRes.data.data.ranges);
        setDesignations(settingsRes.data.data.designations || []);
      }

      setRanks(ranksRes.data.data || []);
      setDepartments(deptsRes.data.data || []);
      setCourses(coursesRes.data.data || []);
    } catch (err) {
      console.error('Failed to load configuration', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllConfig();
  }, []);

  // Save Branding
  const handleSaveBranding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingBranding(true);
    try {
      const res = await api.post('/settings/branding', branding);
      if (res.data.success) {
        showToast('Branding settings saved successfully');
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save branding', 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  // Save PIN Ranges
  const handleSaveRanges = async () => {
    setSavingRanges(true);
    try {
      const res = await api.post('/settings/ranges', {
        trainee_pin_max: Number(ranges.trainee_pin_max),
        staff_pin_min: Number(ranges.staff_pin_min),
      });
      if (res.data.success) {
        showToast('PIN ranges updated successfully');
        setRanges(res.data.data);
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save ranges', 'error');
    } finally {
      setSavingRanges(false);
    }
  };

  // Handle Trainee max change: auto-adjust staff min
  const handleTraineeMaxChange = (val: number) => {
    setRanges(prev => ({
      ...prev,
      trainee_pin_max: val,
      staff_pin_min: Math.max(prev.staff_pin_min, val + 1),
    }));
  };

  // Logo upload simulation
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBranding(prev => ({ ...prev, logo_url: reader.result as string }));
        showToast('Logo loaded. Click "Save branding" to apply permanently.');
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Designation
  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesignation.trim()) return;
    try {
      const res = await api.post('/settings/designations', { name: newDesignation.trim() });
      if (res.data.success) {
        setDesignations(res.data.data);
        setNewDesignation('');
        showToast(`Designation '${newDesignation.trim()}' added`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to add designation', 'error');
    }
  };

  // Remove Designation
  const handleRemoveDesignation = async (name: string) => {
    try {
      const res = await api.delete(`/settings/designations/${encodeURIComponent(name)}`);
      if (res.data.success) {
        setDesignations(res.data.data);
        showToast(`Designation '${name}' removed`);
      }
    } catch (err) {
      showToast('Failed to remove designation', 'error');
    }
  };

  // Create or update Rank
  const handleSaveRank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRank) {
        await api.put(`/ranks/${editingRank.id}`, rankForm);
        showToast(`Rank ${rankForm.name} updated`);
      } else {
        await api.post('/ranks', rankForm);
        showToast(`Rank ${rankForm.name} created`);
      }
      setIsRankModalOpen(false);
      setEditingRank(null);
      setRankForm({ name: '', code: '', sort_order: ranks.length + 1 });
      const res = await api.get('/ranks?page_size=100');
      setRanks(res.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save rank', 'error');
    }
  };

  // Delete Rank
  const handleDeleteRank = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete rank "${name}"?`)) return;
    try {
      await api.delete(`/ranks/${id}`);
      showToast(`Rank ${name} deleted`);
      const res = await api.get('/ranks?page_size=100');
      setRanks(res.data.data || []);
    } catch (err) {
      showToast('Failed to delete rank', 'error');
    }
  };

  // Save Department (Add or Update)
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, {
          name: deptForm.name.trim(),
          code: deptForm.code.trim().toUpperCase(),
        });
        showToast(`Department "${deptForm.name}" updated`);
      } else {
        await api.post('/departments', {
          name: deptForm.name.trim(),
          code: deptForm.code.trim().toUpperCase(),
          active: true,
        });
        showToast(`Department "${deptForm.name}" created`);
      }
      setIsDeptModalOpen(false);
      setEditingDept(null);
      setDeptForm({ name: '', code: '' });
      const deptsRes = await api.get('/departments?page_size=100');
      setDepartments(deptsRes.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save department', 'error');
    }
  };

  // Delete Department
  const handleDeleteDept = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      await api.delete(`/departments/${id}`);
      showToast(`Department "${name}" deleted`);
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete department', 'error');
    }
  };

  // Save Course (Add or Update)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: courseForm.name.trim(),
        code: courseForm.code ? courseForm.code.trim().toUpperCase() : null,
        start_date: courseForm.start_date || null,
        end_date: courseForm.end_date || null,
        active: true,
      };

      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, payload);
        showToast(`Course "${courseForm.name}" updated`);
      } else {
        await api.post('/courses', payload);
        showToast(`Course "${courseForm.name}" created`);
      }
      setIsCourseModalOpen(false);
      setEditingCourse(null);
      setCourseForm({ name: '', code: '', start_date: '', end_date: '' });
      const coursesRes = await api.get('/courses?page_size=100');
      setCourses(coursesRes.data.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save course', 'error');
    }
  };

  // Delete Course
  const handleDeleteCourse = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete course "${name}"?`)) return;
    try {
      await api.delete(`/courses/${id}`);
      showToast(`Course "${name}" deleted`);
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete course', 'error');
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
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Configuration</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Branding, ranks, fields, categories, departments & rules — all editable, no code change
          </p>
        </div>
      </div>

      {/* Blue Server Synchronization Banner */}
      {/* <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
        <Sliders className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <p className="text-xs text-indigo-950 font-medium leading-relaxed">
          Everything here is saved on the <strong className="font-bold text-indigo-900">server</strong>, so it's shared across every PC and included in backups. Changes appear immediately in the <span className="font-semibold">Add person</span> wizard, dashboards and live screen.
        </p>
      </div> */}

      {/* Card 1: Branding */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-indigo-600" /> Branding
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organisation name, system name, tagline & logo (white-label)
          </p>
        </div>

        {/* Logo preview and upload */}
        <div className="flex items-center gap-4 pt-1">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden p-1 shadow-2xs">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xl font-black text-slate-400">{branding.acronym || 'PTS'}</span>
            )}
          </div>
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLogoUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Upload logo
            </button>
            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG or SVG, square format recommended</p>
          </div>
        </div>

        {/* Branding Form Fields */}
        <form onSubmit={handleSaveBranding} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Acronym */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                ACRONYM (AVATAR CHIP)
              </label>
              <input 
                type="text" 
                value={branding.acronym}
                onChange={(e) => setBranding({ ...branding, acronym: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                DISPLAY NAME
              </label>
              <input 
                type="text" 
                value={branding.display_name}
                onChange={(e) => setBranding({ ...branding, display_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full / Legal Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                FULL / LEGAL NAME
              </label>
              <input 
                type="text" 
                value={branding.legal_name}
                onChange={(e) => setBranding({ ...branding, legal_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* System Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                SYSTEM NAME
              </label>
              <input 
                type="text" 
                value={branding.system_name}
                onChange={(e) => setBranding({ ...branding, system_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Tagline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                TAGLINE
              </label>
              <input 
                type="text" 
                value={branding.tagline}
                onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBranding}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingBranding ? 'Saving...' : 'Save branding'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Card 2: PIN / User-ID ranges */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" /> PIN / User-ID ranges
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The PIN entered on Add-person routes them automatically: Trainee vs Staff
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-1">
          {/* Trainee PINs range */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>TRAINEE PINS: 1 TO</span>
            <input 
              type="number" 
              value={ranges.trainee_pin_max}
              onChange={(e) => handleTraineeMaxChange(parseInt(e.target.value) || 2000)}
              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Staff PINs range */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>STAFF PINS: FROM</span>
            <input 
              type="number" 
              value={ranges.staff_pin_min}
              onChange={(e) => setRanges({ ...ranges, staff_pin_min: parseInt(e.target.value) || 2001 })}
              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="button"
            disabled={savingRanges}
            onClick={handleSaveRanges}
            className="sm:ml-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {savingRanges ? 'Saving...' : 'Save ranges'}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          On <strong className="text-slate-600">Add person</strong>, a PIN ≤ <span className="font-bold text-slate-600">{ranges.trainee_pin_max}</span> becomes a <strong className="text-indigo-600">Trainee</strong>; ≥ <span className="font-bold text-slate-600">{ranges.staff_pin_min}</span> becomes <strong className="text-indigo-600">Staff</strong>. Staff start auto-adjusts to stay above the trainee max.
        </p>
      </div>

      {/* Bottom Split Row: Uniform ranks & Non-uniform designations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Uniform ranks */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" /> Uniform ranks
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Police ranks for uniformed staff</p>
              </div>
              <button
                onClick={() => {
                  setEditingRank(null);
                  setRankForm({ name: '', code: '', sort_order: ranks.length + 1 });
                  setIsRankModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add rank
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {ranks.map((rank) => (
                <div key={rank.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center">
                      #{rank.sort_order}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">{rank.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Code: {rank.code}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRank(rank);
                        setRankForm({ name: rank.name, code: rank.code, sort_order: rank.sort_order });
                        setIsRankModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRank(rank.id, rank.name)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Non-uniform / civil designations */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" /> Non-uniform / civil designations
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Ministerial & menial designations</p>
              </div>
            </div>

            {/* Add designation input */}
            <form onSubmit={handleAddDesignation} className="flex gap-2 pt-1 pb-3">
              <input 
                type="text" 
                placeholder="Enter designation (e.g. Stenographer)"
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Designations tags */}
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pr-1 pt-1">
              {designations.map((item) => (
                <span 
                  key={item}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 text-slate-700 text-xs font-bold border border-slate-200/50 hover:bg-slate-200/60 transition-colors"
                >
                  {item}
                  <button 
                    onClick={() => handleRemoveDesignation(item)}
                    className="w-3.5 h-3.5 rounded-full hover:bg-slate-300 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Row 4: Departments & Trainee Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card: Departments & Branches */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" /> Departments & Wings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                School administrative wings, branches, and operational units
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDept(null);
                setDeptForm({ name: '', code: '' });
                setIsDeptModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add department
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {departments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No departments configured yet.
              </div>
            ) : (
              departments.map((dept) => (
                <div key={dept.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">{dept.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Code: {dept.code}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingDept(dept);
                        setDeptForm({ name: dept.name, code: dept.code });
                        setIsDeptModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Edit Department"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept.id, dept.name)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card: Trainee Courses & Batches */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" /> Trainee Courses & Batches
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Recruit classes, promotional courses, and instructor batches
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCourse(null);
                setCourseForm({ name: '', code: '', start_date: '', end_date: '' });
                setIsCourseModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add course
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {courses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No courses configured yet.
              </div>
            ) : (
              courses.map((course) => (
                <div key={course.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[10px] flex items-center justify-center">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="font-bold text-slate-800">{course.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {course.code ? `Code: ${course.code}` : 'Active Course'}
                        {course.start_date ? ` • Starts: ${course.start_date}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCourse(course);
                        setCourseForm({
                          name: course.name,
                          code: course.code || '',
                          start_date: course.start_date || '',
                          end_date: course.end_date || '',
                        });
                        setIsCourseModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Edit Course"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id, course.name)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Add / Edit Rank Modal */}
      {isRankModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingRank ? 'Edit Rank' : 'Add Uniform Rank'}
              </h3>
              <button 
                onClick={() => setIsRankModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRank} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Rank Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Assistant Sub-Inspector"
                  value={rankForm.name}
                  onChange={(e) => setRankForm({ ...rankForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Rank Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. ASI"
                    value={rankForm.code}
                    onChange={(e) => setRankForm({ ...rankForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Seniority Order</label>
                  <input 
                    type="number" 
                    required
                    value={rankForm.sort_order}
                    onChange={(e) => setRankForm({ ...rankForm, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRankModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                >
                  {editingRank ? 'Save Changes' : 'Create Rank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingDept ? 'Edit Department / Wing' : 'Add Department / Wing'}
              </h3>
              <button 
                onClick={() => setIsDeptModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Department / Branch Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Tactical Training Wing"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Branch Code / Acronym</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. TAC-WING"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                >
                  {editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Course Modal */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCourse ? 'Edit Trainee Course' : 'Add Trainee Course'}
              </h3>
              <button 
                onClick={() => setIsCourseModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Course Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Basic Recruit Class Course"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Course Code (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. BRCC-2026"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={courseForm.start_date}
                    onChange={(e) => setCourseForm({ ...courseForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={courseForm.end_date}
                    onChange={(e) => setCourseForm({ ...courseForm, end_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                >
                  {editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Configuration;
