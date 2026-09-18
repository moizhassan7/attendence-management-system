import React, { useState, useEffect } from 'react';
import { 
  Calendar, ChevronRight, Search, FileSpreadsheet, Download, 
  RotateCcw, ChevronDown, 
  Tv, ChevronLeft, UserCheck, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';

interface ReportRow {
  sr: number;
  id: number;
  personnel_id: number;
  name: string;
  belt_no: string;
  pin: string;
  rank: string;
  department: string;
  status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Weekend' | 'Summary' | string;
  check_in: string;
  check_out: string;
  hours: string;
  late_minutes: number;
  date: string;
  is_trainee: boolean;
  summary_data?: {
    present_days: number;
    late_days: number;
    absent_days: number;
    leave_days: number;
  };
}

interface ReportSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total_hours: number;
}

const Reports: React.FC = () => {
  // Cadre switcher: Staff vs Trainee
  const [cadre, setCadre] = useState<'Staff' | 'Trainee'>('Staff');

  // Quick report filter tabs
  const [quickFilter, setQuickFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'leave' | 'by_department' | 'summary'>('all');

  // Time period state with dynamic default dates
  const todayStr = () => new Date().toISOString().split('T')[0];
  const [periodMode, setPeriodMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filter criteria
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedRank, setSelectedRank] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // Master options
  const [departments, setDepartments] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Report table data & pagination
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    total_hours: 0,
  });
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // Live time ticker
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        }) + ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch filter dropdown options on mount
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [deptsRes, ranksRes, coursesRes] = await Promise.allSettled([
          api.get('/departments'),
          api.get('/ranks'),
          api.get('/courses'),
        ]);

        if (deptsRes.status === 'fulfilled') {
          setDepartments(deptsRes.value.data.data || []);
        }
        if (ranksRes.status === 'fulfilled') {
          setRanks(ranksRes.value.data.data || []);
        }
        if (coursesRes.status === 'fulfilled') {
          setCourses(coursesRes.value.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load master filters', err);
      }
    };
    fetchMasterData();
  }, []);

  // Reset page when filters or cadre change
  useEffect(() => {
    setPage(1);
  }, [cadre, quickFilter, periodMode, singleDate, startDate, endDate, searchTerm, selectedDept, selectedRank, selectedCourse]);

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const isTrainee = cadre === 'Trainee';
      const params = new URLSearchParams();
      params.append('is_trainee', String(isTrainee));
      params.append('quick_filter', quickFilter);
      params.append('page', String(page));
      params.append('page_size', String(pageSize));

      if (periodMode === 'single') {
        params.append('date', singleDate);
      } else {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (selectedDept) {
        params.append('department_id', selectedDept);
      }
      if (!isTrainee && selectedRank) {
        params.append('rank_id', selectedRank);
      }
      if (isTrainee && selectedCourse) {
        params.append('course_id', selectedCourse);
      }

      const res = await api.get(`/attendance/report?${params.toString()}`);
      if (res.data) {
        setReportData(res.data.data || []);
        setSummary(res.data.summary || {
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          total_hours: 0,
        });
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.total_pages || 1);
          setTotalRows(res.data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch attendance report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchReport, 200);
    return () => clearTimeout(timer);
  }, [cadre, quickFilter, periodMode, singleDate, startDate, endDate, searchTerm, selectedDept, selectedRank, selectedCourse, page, pageSize]);

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(true);
    try {
      const isTrainee = cadre === 'Trainee';
      const params = new URLSearchParams();
      params.append('is_trainee', String(isTrainee));
      params.append('quick_filter', quickFilter);
      params.append('format', format);

      if (periodMode === 'single') {
        params.append('date', singleDate);
      } else {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (selectedDept) {
        params.append('department_id', selectedDept);
      }
      if (!isTrainee && selectedRank) {
        params.append('rank_id', selectedRank);
      }
      if (isTrainee && selectedCourse) {
        params.append('course_id', selectedCourse);
      }

      const baseURL = api.defaults.baseURL || '/api/v1';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${baseURL}/attendance/report/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Export download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const targetDateStr = periodMode === 'single' ? singleDate : `${startDate}_to_${endDate}`;
      a.download = `Attendance_${cadre}_${targetDateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error', err);
      alert('Failed to export file. Please verify network and try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDept('');
    setSelectedRank('');
    setSelectedCourse('');
    setQuickFilter('all');
    setSingleDate('2026-09-12');
    setStartDate('2026-09-01');
    setEndDate('2026-09-12');
  };

  // Helper for generating avatar initials
  const getInitials = (name: string): string => {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Avatar pastel color palette
  const getAvatarColor = (initials: string): { bg: string; text: string } => {
    const colors = [
      { bg: 'bg-emerald-100', text: 'text-emerald-800' },
      { bg: 'bg-teal-100', text: 'text-teal-800' },
      { bg: 'bg-sky-100', text: 'text-sky-800' },
      { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      { bg: 'bg-purple-100', text: 'text-purple-800' },
      { bg: 'bg-amber-100', text: 'text-amber-800' },
      { bg: 'bg-rose-100', text: 'text-rose-800' },
      { bg: 'bg-blue-100', text: 'text-blue-800' },
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
      sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PRESENT') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
          Present
        </span>
      );
    }
    if (s === 'LATE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200/60">
          Late
        </span>
      );
    }
    if (s === 'LEAVE' || s === 'OSD' || s === 'MEDICAL' || s === 'DUTY_REST') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200/60">
          Leave
        </span>
      );
    }
    if (s === 'WEEKEND') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
          Weekend
        </span>
      );
    }
    if (s === 'SUMMARY') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200/60">
          Summary
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200/60">
        Absent
      </span>
    );
  };

  const quickFiltersList = [
    { id: 'all', label: 'Daily Attendance' },
    { id: 'present', label: 'Present' },
    { id: 'late', label: 'Late Comers' },
    { id: 'absent', label: 'Absentees' },
    { id: 'leave', label: 'On Leave' },
    { id: 'by_department', label: 'By Department' },
    { id: 'summary', label: 'Period Summary' },
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar: Timestamp and Live Screen Link */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-slate-600 text-xs font-medium shadow-xs border border-slate-100">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span>{currentTime || 'Sat, 12 Sep 2026 1:53 PM'}</span>
        </div>

        <Link 
          to="/live-screen" 
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Tv className="w-3 h-3 text-emerald-400" />
          <span>Live Screen</span>
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance Reports</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Present list, late comers, absentees and leave — pick a tab, then export Excel or CSV
        </p>
        
        {/* Navigation sub-links */}
        <div className="flex items-center gap-4 mt-2 text-xs font-medium text-indigo-600">
          <button 
            onClick={() => { setQuickFilter('all'); setCadre('Staff'); }}
            className="hover:underline flex items-center gap-1 transition-colors"
          >
            Daily Register — mark attendance <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter('present')}
            className="hover:underline flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition-colors font-semibold"
          >
            Present today <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <Link 
            to="/enrollment" 
            className="hover:underline flex items-center gap-1 text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Device Enrolment report <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Report Tabs Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mr-1">
          QUICK REPORTS
        </span>
        {quickFiltersList.map((item) => {
          const isActive = quickFilter === item.id;
          const isPresentTab = item.id === 'present';
          return (
            <button
              key={item.id}
              onClick={() => setQuickFilter(item.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? isPresentTab
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-600 font-semibold'
                    : 'bg-white text-indigo-600 shadow-xs border border-indigo-200 font-semibold'
                  : isPresentTab
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                    : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Center Cadre Toggle: Staff vs Trainee */}
      <div className="flex justify-center pt-1 pb-1">
        <div className="inline-flex bg-white p-1 rounded-full border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => setCadre('Staff')}
            className={`px-7 py-2 rounded-full text-xs font-semibold transition-all duration-150 ${
              cadre === 'Staff'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => setCadre('Trainee')}
            className={`px-7 py-2 rounded-full text-xs font-semibold transition-all duration-150 ${
              cadre === 'Trainee'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trainee
          </button>
        </div>
      </div>

      {/* Main Grid: Left Filters Sidebar + Right Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Filters Sidebar (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card 1: Time Period */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-800">Time period</h2>
            
            <div className="grid grid-cols-2 gap-1 bg-slate-100/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriodMode('single')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodMode === 'single'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single day
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('range')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodMode === 'range'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Date range
              </button>
            </div>

            {periodMode === 'single' ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  DATE
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    START DATE
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    END DATE
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Entity Filters */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800">Filters</h2>
                <p className="text-[10px] text-slate-400">{cadre} filters</p>
              </div>
              {(searchTerm || selectedDept || selectedRank || selectedCourse) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Search Person */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                SEARCH PERSON
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, PIN or belt no..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Select People Quick Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                SELECT PEOPLE
              </label>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-700 font-medium">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>All {cadre.toLowerCase()}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Branch / Department Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                BRANCH / DEPARTMENT
              </label>
              <div className="relative">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">All branches</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Rank (for Staff) or Course (for Trainee) */}
            {cadre === 'Staff' ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  RANK
                </label>
                <div className="relative">
                  <select
                    value={selectedRank}
                    onChange={(e) => setSelectedRank(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="">All ranks</option>
                    {ranks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  TRAINING COURSE
                </label>
                <div className="relative">
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="">All courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Main Table Area (9 cols) */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          {/* Header Row: Preview Title & Export Buttons */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {quickFilter === 'present' ? 'Present today' : 'Preview'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {quickFilter === 'present'
                  ? 'Everyone who checked in (on time + late)'
                  : periodMode === 'single'
                    ? `Single day · ${singleDate}`
                    : `Date range · ${startDate} to ${endDate}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                disabled={exporting || loading}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={exporting || loading}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Sub-Header: Counts & KPI Stats */}
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">{totalRows} rows</span>
              <div className="h-3 w-px bg-slate-300" />
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuickFilter('present')}
                  className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 hover:bg-emerald-100"
                >
                  Present: {quickFilter === 'present' ? totalRows : summary.present + summary.late}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter('late')}
                  className="inline-flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 hover:bg-amber-100"
                >
                  Late: {summary.late}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter('leave')}
                  className="inline-flex items-center gap-1 text-sky-700 font-medium bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 hover:bg-sky-100"
                >
                  Leave: {summary.leave}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter('absent')}
                  className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 hover:bg-rose-100"
                >
                  Absent: {summary.absent}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              {cadre} · 9 Columns
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                  <th className="py-3 px-4 w-12 text-center">SR</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">BELT NO</th>
                  <th className="py-3 px-4">PIN</th>
                  <th className="py-3 px-4">{cadre === 'Staff' ? 'RANK' : 'COURSE'}</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4">{quickFilter === 'summary' ? 'DAYS PRES' : 'CHECK-IN'}</th>
                  <th className="py-3 px-4">{quickFilter === 'summary' ? 'DAYS ABS' : 'CHECK-OUT'}</th>
                  <th className="py-3 px-4 text-right pr-5">HOURS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading attendance records...</span>
                      </div>
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <AlertCircle className="w-6 h-6 text-slate-300 mb-1" />
                        <span className="font-semibold text-slate-600">No records found</span>
                        <span className="text-[11px] text-slate-400">Try adjusting your date or search filters</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => {
                    const initials = getInitials(row.name);
                    const color = getAvatarColor(initials);
                    return (
                      <tr 
                        key={row.id || idx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-center text-slate-400 font-medium text-[11px]">
                          {row.sr}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${color.bg} ${color.text}`}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs tracking-tight">
                                {row.name.toUpperCase()}
                              </p>
                              {row.department && (
                                <p className="text-[10px] text-slate-400 font-normal">
                                  {row.department}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 text-xs">
                          {row.belt_no || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 text-xs">
                          {row.pin}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium text-xs">
                          {row.rank}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {renderStatusBadge(row.status)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium text-xs">
                          {row.check_in}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium text-xs">
                          {row.check_out}
                        </td>
                        <td className="py-2.5 px-4 text-right pr-5 font-mono text-slate-700 text-xs font-semibold">
                          {row.hours}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Pagination */}
          {!loading && totalRows > 0 && (
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-800">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * pageSize, totalRows)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{totalRows}</span> entries
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-semibold text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
