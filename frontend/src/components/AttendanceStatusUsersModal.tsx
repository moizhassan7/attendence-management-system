import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Search, Download, RefreshCw, Users, UserCheck, Clock, UserX, 
  Briefcase, Activity, CalendarDays, ShieldCheck, ArrowRightLeft,
  GraduationCap, Stethoscope
} from 'lucide-react';
import api from '../api/client';
import PaginationBar from './PaginationBar';

export interface AttendanceStatusUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  status: string; // Initial status filter, e.g. "LATE", "ABSENT", "PRESENT,LATE", "ALL"
  date?: string;
  isTrainee?: boolean; // true = Trainees only, false = Staff only, undefined = All
  courseId?: number;
  departmentId?: number;
  rankId?: number;
  dutyType?: string;
  category?: string;
}

interface AttendanceRecord {
  id: number;
  personnel_id: number;
  attendance_date: string;
  first_in: string | null;
  last_out: string | null;
  total_work_minutes: number | null;
  status: string;
  late_minutes: number;
  overtime_minutes: number;
  source: string;
  calculated_at: string;
  personnel_name: string | null;
  employee_code: string | null;
  biometric_user_id: string | null;
  department_name: string | null;
  rank_name: string | null;
  course_name: string | null;
  category: string | null;
  designation: string | null;
  gender: string | null;
  is_trainee: boolean | null;
  cnic: string | null;
  father_name: string | null;
  shift_name: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string; borderClass: string; icon: any }> = {
  ALL: { label: 'All', colorClass: 'text-slate-700', bgClass: 'bg-slate-100', borderClass: 'border-slate-300', icon: Users },
  'PRESENT,LATE': { label: 'Present & Late', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', icon: UserCheck },
  PRESENT: { label: 'Present', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', icon: UserCheck },
  LATE: { label: 'Late', colorClass: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', icon: Clock },
  ABSENT: { label: 'Absent', colorClass: 'text-rose-600', bgClass: 'bg-rose-50', borderClass: 'border-rose-200', icon: UserX },
  LEAVE: { label: 'Leave', colorClass: 'text-sky-600', bgClass: 'bg-sky-50', borderClass: 'border-sky-200', icon: Briefcase },
  OSD: { label: 'OSD', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200', icon: Activity },
  MEDICAL: { label: 'Medical', colorClass: 'text-orange-600', bgClass: 'bg-orange-50', borderClass: 'border-orange-200', icon: Stethoscope },
  DUTY_REST: { label: 'Duty Rest', colorClass: 'text-purple-600', bgClass: 'bg-purple-50', borderClass: 'border-purple-200', icon: ShieldCheck },
  WEEKEND: { label: 'Weekend', colorClass: 'text-slate-600', bgClass: 'bg-slate-100', borderClass: 'border-slate-300', icon: CalendarDays },
  EVIDENCE: { label: 'Evidence', colorClass: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', icon: GraduationCap },
  REPATRIATION: { label: 'Repatriation', colorClass: 'text-pink-600', bgClass: 'bg-pink-50', borderClass: 'border-pink-200', icon: ArrowRightLeft },
};

export const AttendanceStatusUsersModal: React.FC<AttendanceStatusUsersModalProps> = ({
  isOpen,
  onClose,
  title,
  status: initialStatus,
  date,
  isTrainee,
  courseId,
  departmentId,
  rankId,
  dutyType,
  category,
}) => {
  const [activeStatus, setActiveStatus] = useState<string>(initialStatus || 'ALL');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Sync initial status when modal opens or initialStatus changes
  useEffect(() => {
    if (isOpen) {
      setActiveStatus(initialStatus || 'ALL');
      setPage(1);
      setSearch('');
      setDebouncedSearch('');
    }
  }, [isOpen, initialStatus]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch daily attendance
  const fetchRecords = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (date) params.date = date;
      if (activeStatus && activeStatus !== 'ALL') {
        params.status = activeStatus;
      }
      if (isTrainee !== undefined) {
        params.is_trainee = isTrainee;
      }
      if (courseId) params.course_id = courseId;
      if (departmentId) params.department_id = departmentId;
      if (rankId) params.rank_id = rankId;
      if (dutyType) params.duty_type = dutyType;
      if (category) params.category = category;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get('/attendance/daily', { params });
      setRecords(res.data?.data || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load status records', err);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [isOpen, date, activeStatus, isTrainee, courseId, departmentId, rankId, dutyType, category, debouncedSearch, page, pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentConfig = useMemo(() => {
    return STATUS_CONFIG[activeStatus] || {
      label: activeStatus,
      colorClass: 'text-indigo-600',
      bgClass: 'bg-indigo-50',
      borderClass: 'border-indigo-200',
      icon: Users,
    };
  }, [activeStatus]);

  const HeaderIcon = currentConfig.icon;

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params: Record<string, any> = {
        page: 1,
        page_size: 1000,
      };
      if (date) params.date = date;
      if (activeStatus && activeStatus !== 'ALL') params.status = activeStatus;
      if (isTrainee !== undefined) params.is_trainee = isTrainee;
      if (courseId) params.course_id = courseId;
      if (departmentId) params.department_id = departmentId;
      if (rankId) params.rank_id = rankId;
      if (dutyType) params.duty_type = dutyType;
      if (category) params.category = category;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get('/attendance/daily', { params });
      const exportList: AttendanceRecord[] = res.data?.data || [];

      if (!exportList.length) {
        alert('No records to export');
        return;
      }

      const headers = ['Device PIN', 'Name', 'Code', 'Role/Course', 'Department/Shift', 'Status', 'In Time', 'Out Time', 'Late (Mins)', 'Date'];
      const rows = exportList.map(r => [
        `"${r.biometric_user_id || ''}"`,
        `"${(r.personnel_name || '').replace(/"/g, '""')}"`,
        `"${r.employee_code || ''}"`,
        `"${r.is_trainee ? (r.course_name || 'Trainee') : (r.rank_name || r.designation || 'Staff')}"`,
        `"${r.department_name || r.shift_name || '-'}"`,
        `"${r.status}"`,
        `"${r.first_in ? new Date(r.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}"`,
        `"${r.last_out ? new Date(r.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}"`,
        `"${r.late_minutes || 0}"`,
        `"${r.attendance_date || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const fileStatus = (activeStatus || 'all').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.setAttribute('download', `attendance_${fileStatus}_${date || 'today'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const norm = (status || '').toUpperCase();
    const config = STATUS_CONFIG[norm] || {
      label: norm,
      colorClass: 'text-slate-600',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-200'
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${config.bgClass} ${config.colorClass} ${config.borderClass}`}>
        {config.label}
      </span>
    );
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return <span className="text-slate-300 font-normal">—</span>;
    try {
      const dt = new Date(isoString);
      return <span className="font-semibold text-slate-700">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
    } catch {
      return <span className="text-slate-300">—</span>;
    }
  };

  const getAvatarColor = (id: number) => {
    const colors = [
      "bg-teal-100 text-teal-700",
      "bg-purple-100 text-purple-700",
      "bg-fuchsia-100 text-fuchsia-700",
      "bg-emerald-100 text-emerald-700",
      "bg-rose-100 text-rose-700",
      "bg-sky-100 text-sky-700",
      "bg-amber-100 text-amber-700",
      "bg-indigo-100 text-indigo-700",
    ];
    return colors[id % colors.length];
  };

  if (!isOpen) return null;

  // Available status tabs based on whether this is Trainees or Staff
  const availableTabs = isTrainee
    ? ['ALL', 'PRESENT,LATE', 'PRESENT', 'ABSENT', 'LEAVE', 'WEEKEND', 'OSD', 'MEDICAL', 'EVIDENCE', 'REPATRIATION']
    : ['ALL', 'PRESENT,LATE', 'PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'DUTY_REST', 'OSD', 'MEDICAL', 'WEEKEND', 'EVIDENCE'];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs ${currentConfig.bgClass} ${currentConfig.borderClass}`}>
              <HeaderIcon className={`w-5 h-5 ${currentConfig.colorClass}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {title || `${currentConfig.label} Personnel`}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${currentConfig.bgClass} ${currentConfig.colorClass} border ${currentConfig.borderClass}`}>
                  {total} {total === 1 ? 'person' : 'records'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>{isTrainee === true ? 'Trainees' : isTrainee === false ? 'Staff' : 'All Personnel'}</span>
                <span>·</span>
                <span>Date: {date || new Date().toISOString().split('T')[0]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting || total === 0}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-40 shadow-xs cursor-pointer"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {availableTabs.map((sKey) => {
            const cfg = STATUS_CONFIG[sKey] || { label: sKey };
            const isSelected = activeStatus === sKey;
            return (
              <button
                key={sKey}
                type="button"
                onClick={() => {
                  setActiveStatus(sKey);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected 
                    ? 'bg-primary text-white shadow-sm shadow-primary/20 scale-[1.02]' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by Name, Biometric PIN, Emp Code, Rank/Course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-slate-700 shadow-2xs"
            />
            {search && (
              <button 
                onClick={() => setSearch('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchRecords()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors shadow-2xs cursor-pointer"
              title="Refresh records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-400">Loading attendance data...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No personnel found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No users match status &quot;{currentConfig.label}&quot; {debouncedSearch ? `with search term &quot;${debouncedSearch}&quot;` : ''} on this date.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50/75 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="px-5 py-3 w-12">#</th>
                    <th className="px-4 py-3">Personnel</th>
                    <th className="px-3 py-3 text-center">Device PIN</th>
                    <th className="px-4 py-3">{isTrainee ? 'Course' : 'Rank / Role'}</th>
                    <th className="px-4 py-3">Department / Shift</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">First In</th>
                    <th className="px-3 py-3 text-center">Last Out</th>
                    <th className="px-3 py-3 text-center">Late / Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r, idx) => {
                    const rowNumber = (page - 1) * pageSize + idx + 1;
                    const initials = r.personnel_name 
                      ? r.personnel_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
                      : 'NA';
                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-400 tabular-nums">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarColor(r.personnel_id)}`}>
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 leading-tight">
                                {r.personnel_name || 'Unnamed Personnel'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                {r.employee_code && <span>Code: {r.employee_code}</span>}
                                {r.gender && <span>· {r.gender}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                            {r.biometric_user_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-700">
                            {r.is_trainee ? (r.course_name || 'Trainee') : (r.rank_name || r.designation || 'Staff')}
                          </div>
                          {r.category && !r.is_trainee && (
                            <div className="text-[10px] text-slate-400 font-medium">{r.category}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-600">
                            {r.department_name || r.shift_name || 'General'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {getStatusBadge(r.status)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {formatTime(r.first_in)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {formatTime(r.last_out)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {r.late_minutes > 0 ? (
                            <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              +{r.late_minutes}m late
                            </span>
                          ) : r.total_work_minutes && r.total_work_minutes > 0 ? (
                            <span className="text-slate-500 font-medium text-[11px]">
                              {Math.round(r.total_work_minutes / 60)}h {Math.round(r.total_work_minutes % 60)}m
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer with Pagination */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <PaginationBar 
            page={page} 
            pageSize={pageSize} 
            total={total} 
            onPageChange={(newPage) => setPage(newPage)} 
          />
        </div>
      </div>
    </div>
  );
};

export default AttendanceStatusUsersModal;
