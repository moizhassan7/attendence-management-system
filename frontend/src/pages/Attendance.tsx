import React, { useEffect, useState, useCallback } from 'react';
import { 
  CalendarDays, Search, Clock, RefreshCw, 
  Plus, ChevronLeft, ChevronRight, CheckCircle2, 
  X
} from 'lucide-react';
import api from '../api/client';
import SearchablePersonSelect from '../components/SearchablePersonSelect';

interface AttendanceRecord {
  id: number;
  personnel_id: number;
  full_name: string;
  biometric_user_id: string;
  employee_code?: string;
  rank_name?: string;
  department_name?: string;
  course_name?: string;
  is_trainee: boolean;
  attendance_date: string;
  status: string;
  first_in: string | null;
  last_out: string | null;
  total_hours: number | null;
  late_minutes: number;
  punch_count: number;
  exception_type?: string;
  exception_reason?: string;
}

const Attendance: React.FC = () => {
  const [targetDate, setTargetDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [cadre, setCadre] = useState<'Staff' | 'Trainee'>('Staff');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [showManualPunch, setShowManualPunch] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [personnelDropdown, setPersonnelDropdown] = useState<any[]>([]);

  // Manual punch state
  const [manualTime, setManualTime] = useState(new Date().toTimeString().substring(0, 5));
  const [punchState, setPunchState] = useState(1); // 1 = Check-in, 2 = Check-out

  // Exception state
  const [exceptionType, setExceptionType] = useState('LEAVE');
  const [exceptionReason, setExceptionReason] = useState('');

  // Load list of personnel for dropdowns
  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        const isTrainee = cadre === 'Trainee';
        const res = await api.get(`/personnel?is_trainee=${isTrainee}&page_size=1000`);
        setPersonnelDropdown(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load personnel list', err);
      }
    };
    fetchPersonnel();
  }, [cadre]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const isTrainee = cadre === 'Trainee';
      let url = `/attendance/report?is_trainee=${isTrainee}&date=${targetDate}&page=${page}&page_size=${pageSize}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) url += `&quick_filter=${encodeURIComponent(statusFilter.toLowerCase())}`;

      const res = await api.get(url);
      const data = res.data?.data || [];
      // Normalize report row into attendance record
      const items: AttendanceRecord[] = data.map((r: any) => ({
        id: r.id || r.personnel_id,
        personnel_id: r.personnel_id,
        full_name: r.name,
        biometric_user_id: String(r.pin || ''),
        employee_code: r.belt_no,
        rank_name: r.rank,
        department_name: r.department,
        course_name: r.rank,
        is_trainee: isTrainee,
        attendance_date: r.date || targetDate,
        status: r.status,
        first_in: r.check_in !== '-' ? r.check_in : null,
        last_out: r.check_out !== '-' ? r.check_out : null,
        total_hours: parseFloat(r.hours) || 0,
        late_minutes: r.late_minutes || 0,
        punch_count: r.first_in ? (r.last_out ? 2 : 1) : 0,
      }));
      setRecords(items);
      setTotalRows(res.data?.pagination?.total || items.length);
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    } finally {
      setLoading(false);
    }
  }, [cadre, targetDate, page, pageSize, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchAttendance, 200);
    return () => clearTimeout(timer);
  }, [fetchAttendance]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await api.post(`/attendance/process-daily?date=${targetDate}`);
      setNotice(res.data?.message || 'Daily attendance records successfully recalculated from biometric punch logs.');
      setTimeout(() => setNotice(null), 5000);
      fetchAttendance();
    } catch (err: any) {
      console.error('Recalculate failed', err);
      alert(err.response?.data?.detail || 'Failed to recalculate attendance.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleManualPunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;

    try {
      const punchIso = `${targetDate}T${manualTime}:00`;
      await api.post('/attendance/manual-punch', {
        personnel_id: parseInt(selectedPersonId, 10),
        punch_time: punchIso,
        punch_state: punchState,
        punch_type: punchState === 2 ? 'OUT' : 'IN',
      });
      setShowManualPunch(false);
      setNotice(`Manual ${punchState === 2 ? 'Check-out' : 'Check-in'} registered and daily attendance recalculated.`);
      setTimeout(() => setNotice(null), 4000);
      fetchAttendance();
    } catch (err: any) {
      console.error('Manual punch failed', err);
      alert(err.response?.data?.detail || 'Failed to register manual punch.');
    }
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;

    try {
      await api.post('/attendance/exceptions', {
        personnel_id: parseInt(selectedPersonId, 10),
        exception_type: exceptionType,
        start_date: targetDate,
        end_date: targetDate,
        reason: exceptionReason || null,
      });
      setShowExceptionModal(false);
      setNotice(`Exception ${exceptionType} applied and attendance updated.`);
      setTimeout(() => setNotice(null), 4000);
      fetchAttendance();
    } catch (err: any) {
      console.error('Exception failed', err);
      alert(err.response?.data?.detail || 'Failed to record exception.');
    }
  };

  const getStatusStyle = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'PRESENT') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    if (s === 'LATE') return 'bg-amber-50 text-amber-600 border-amber-200';
    if (s === 'ABSENT') return 'bg-rose-50 text-rose-600 border-rose-200';
    if (s === 'LEAVE') return 'bg-sky-50 text-sky-600 border-sky-200';
    if (s === 'WEEKEND') return 'bg-slate-100 text-slate-600 border-slate-200';
    if (s === 'OSD') return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    if (s === 'MEDICAL') return 'bg-orange-50 text-orange-600 border-orange-200';
    if (s === 'DUTY_REST' || s === 'DUTY REST') return 'bg-purple-50 text-purple-600 border-purple-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            <input 
              type="date"
              value={targetDate}
              onChange={(e) => { setTargetDate(e.target.value); setPage(1); }}
              className="bg-transparent border-none font-bold text-slate-700 outline-none cursor-pointer text-xs"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Attendance Register</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Real daily attendance computed from ZKTeco biometric punches, shifts, and sanctioned exceptions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            title="Recalculate attendance records from raw punches"
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin text-primary' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate Day'}</span>
          </button>
          <button
            onClick={() => {
              setSelectedPersonId('');
              setManualTime(new Date().toTimeString().substring(0, 5));
              setShowManualPunch(true);
            }}
            className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Clock className="w-3.5 h-3.5" /> Manual Punch
          </button>
          <button
            onClick={() => {
              setSelectedPersonId('');
              setShowExceptionModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all"
          >
            <Plus className="w-4 h-4" /> Mark Exception
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* Cadre Tabs & Search */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-100">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => { setCadre('Staff'); setPage(1); }}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${cadre === 'Staff' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Faculty & Staff
            </button>
            <button
              onClick={() => { setCadre('Trainee'); setPage(1); }}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${cadre === 'Trainee' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Recruits & Trainees
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Total Records: <span className="font-bold text-slate-800">{totalRows}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search name, PIN, belt no..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by attendance status"
            className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="all">Active Only</option>
            <option value="late">Late Arrivals</option>
            <option value="absent">Absentees</option>
            <option value="leave">On Leave</option>
          </select>

          {(searchTerm || statusFilter) && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setPage(1); }}
              className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
            >
              Reset
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading attendance records from database...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No attendance records found for {targetDate}. Click "Recalculate Day" to process logs.
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">SR</th>
                  <th className="py-3 px-4">PIN / BELT</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">{cadre === 'Staff' ? 'RANK / DEPT' : 'COURSE'}</th>
                  <th className="py-3 px-4 text-emerald-600">FIRST IN</th>
                  <th className="py-3 px-4 text-slate-600">LAST OUT</th>
                  <th className="py-3 px-4">HOURS</th>
                  <th className="py-3 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {records.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <span className="text-indigo-600">#{r.biometric_user_id}</span>
                      {r.employee_code && <span className="text-slate-400 text-[10px] ml-1.5">({r.employee_code})</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 uppercase">{r.full_name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {cadre === 'Staff' ? `${r.rank_name || 'Staff'} · ${r.department_name || 'PTS'}` : (r.course_name || 'Trainee')}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-600 font-bold">
                      {r.first_in ? r.first_in : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-semibold">
                      {r.last_out ? r.last_out : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {r.total_hours ? `${r.total_hours}h` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-semibold">
          <div>
            Showing {Math.min(totalRows, (page - 1) * pageSize + 1)} to {Math.min(totalRows, page * pageSize)} of {totalRows} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Punch Modal */}
      {showManualPunch && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Add Manual Punch</h3>
              <button onClick={() => setShowManualPunch(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualPunchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Person *</label>
                <SearchablePersonSelect
                  personnel={personnelDropdown}
                  value={selectedPersonId}
                  onChange={(id) => setSelectedPersonId(id)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Time *</label>
                  <input 
                    type="time"
                    required
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Punch State</label>
                  <select
                    value={punchState}
                    onChange={(e) => setPunchState(parseInt(e.target.value, 10))}
                    aria-label="Punch State"
                    className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                  >
                    <option value={1}>Check-In</option>
                    <option value={2}>Check-Out</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualPunch(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
                >
                  Record Punch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Exception Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Record Exception</h3>
                <p className="text-xs text-slate-400 mt-0.5">Leave, OSD, medical, duty rest, or court duty</p>
              </div>
              <button onClick={() => setShowExceptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExceptionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Person *</label>
                <SearchablePersonSelect
                  personnel={personnelDropdown}
                  value={selectedPersonId}
                  onChange={(id) => setSelectedPersonId(id)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Exception Type *</label>
                <select
                  value={exceptionType}
                  onChange={(e) => setExceptionType(e.target.value)}
                  aria-label="Exception Type"
                  className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                >
                  <option value="LEAVE">Leave</option>
                  <option value="OSD">OSD (On Special Duty)</option>
                  <option value="MEDICAL">Medical Leave</option>
                  <option value="DUTY_REST">Duty Rest</option>
                  <option value="EVIDENCE">Court / Evidence</option>
                  <option value="REPATRIATION">Repatriation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Reason / Office Order</label>
                <input 
                  type="text"
                  placeholder="e.g. Order #78/Admin"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
                >
                  Apply Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Attendance;
