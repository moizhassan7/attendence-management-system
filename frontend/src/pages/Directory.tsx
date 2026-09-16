import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CalendarDays, ChevronRight, Search, FileDown,
  X, ChevronLeft, Edit
} from 'lucide-react';
import api from '../api/client';
import { useBranding } from '../context/BrandingContext';
import { EditPersonnelModal } from '../components/EditPersonnelModal';

const Directory: React.FC = () => {
  const { branding } = useBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'Trainees' ? 'Trainees' : 'Staff';
  const initialRank = searchParams.get('rank_id') || '';

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranksList, setRanksList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [deptsList, setDeptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filters & Pagination
  const [activeTab, setActiveTab] = useState<'Staff' | 'Trainees'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rankFilter, setRankFilter] = useState(initialRank);
  const [courseFilter, setCourseFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  // Selected Person Details Modal
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load master data for filters
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [ranksRes, coursesRes, deptsRes] = await Promise.all([
          api.get('/ranks?page_size=100'),
          api.get('/courses?page_size=100'),
          api.get('/departments?page_size=100'),
        ]);
        setRanksList(ranksRes.data?.data || []);
        setCoursesList(coursesRes.data?.data || []);
        setDeptsList(deptsRes.data?.data || []);
      } catch (err) {
        console.error('Failed to load filter metadata', err);
      }
    };
    fetchMasterData();
  }, []);

  const fetchDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const isTrainee = activeTab === 'Trainees';
      let url = `/personnel?is_trainee=${isTrainee}&include_attendance=true&page=${page}&page_size=${pageSize}`;
      
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (rankFilter) url += `&rank_id=${rankFilter}`;
      if (courseFilter) url += `&course_id=${courseFilter}`;
      if (deptFilter) url += `&department_id=${deptFilter}`;
      if (typeFilter) url += `&category=${typeFilter}`;
      
      const res = await api.get(url);
      setPersonnel(res.data?.data || []);
      setTotalRecords(res.data?.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch directory', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, statusFilter, rankFilter, courseFilter, deptFilter, typeFilter, page, pageSize]);

  useEffect(() => {
    const timeout = setTimeout(fetchDirectory, 250);
    return () => clearTimeout(timeout);
  }, [fetchDirectory]);

  const handleTabChange = (tab: 'Staff' | 'Trainees') => {
    setActiveTab(tab);
    setPage(1);
    setSearchParams({ tab });
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true);
    try {
      const isTrainee = activeTab === 'Trainees';
      let url = `/personnel/export/file?format=${format}&is_trainee=${isTrainee}`;
      if (rankFilter) url += `&rank_id=${rankFilter}`;
      if (courseFilter) url += `&course_id=${courseFilter}`;
      if (deptFilter) url += `&department_id=${deptFilter}`;

      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: format === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'text/csv'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const orgSlug = (branding.acronym || 'org').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `${orgSlug}_${activeTab.toLowerCase()}_directory_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to generate export file from database.');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string, firstIn: string, lastOut: string) => {
    const s = status ? status.toLowerCase() : 'absent';
    let baseColor = 'bg-slate-100 text-slate-600';
    
    if (s === 'present') baseColor = 'bg-emerald-50 text-emerald-600';
    if (s === 'late') baseColor = 'bg-amber-50 text-amber-600';
    if (s === 'absent') baseColor = 'bg-rose-50 text-rose-600';
    if (s === 'leave') baseColor = 'bg-sky-50 text-sky-600';
    if (s === 'weekend') baseColor = 'bg-slate-100 text-slate-500';
    if (s === 'duty_rest' || s === 'duty rest') baseColor = 'bg-purple-50 text-purple-600';

    const isIn = firstIn && !lastOut;
    const isOut = lastOut;

    return (
      <div className="flex items-center gap-1.5">
        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${baseColor}`}>
          {s}
        </span>
        {isIn && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
            In
          </span>
        )}
        {isOut && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase">
            Out
          </span>
        )}
      </div>
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Directory</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Live database records for staff & trainees</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button 
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col min-h-[600px]">
        {/* Tabs & Total */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-6 border-b border-slate-100 gap-4">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button 
              onClick={() => handleTabChange('Staff')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Staff' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Staff
            </button>
            <button 
              onClick={() => handleTabChange('Trainees')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Trainees' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Trainees
            </button>
          </div>
          <div className="text-sm font-semibold text-slate-600">
            Total Records: <span className="font-black text-indigo-600">{totalRecords}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name, belt no, PIN, CNIC..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by employment status"
            className="px-3 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {activeTab === 'Staff' ? (
            <>
              <select 
                value={rankFilter} 
                onChange={(e) => { setRankFilter(e.target.value); setPage(1); }}
                aria-label="Filter by rank"
                className="px-3 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="">All ranks</option>
                {ranksList.map(r => (
                  <option key={r.id} value={String(r.id)}>{r.name}</option>
                ))}
              </select>

              <select 
                value={deptFilter} 
                onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                aria-label="Filter by department"
                className="px-3 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="">All departments</option>
                {deptsList.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>

              <select 
                value={typeFilter} 
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                aria-label="Filter by staff type"
                className="px-3 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="">All categories</option>
                <option value="Uniform">Uniform</option>
                <option value="Non-Uniform">Non-Uniform</option>
              </select>
            </>
          ) : (
            <select 
              value={courseFilter} 
              onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
              aria-label="Filter by course"
              className="px-3 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="">All courses</option>
              {coursesList.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          )}

          {(searchTerm || statusFilter || rankFilter || courseFilter || deptFilter || typeFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setRankFilter('');
                setCourseFilter('');
                setDeptFilter('');
                setTypeFilter('');
                setPage(1);
              }}
              className="px-3 py-2.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
            >
              Reset
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
             <div className="flex h-48 items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
             </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">SR</th>
                  <th className="px-4 py-3">PIN / BELT</th>
                  <th className="px-4 py-3">{activeTab === 'Staff' ? 'RANK' : 'COURSE'}</th>
                  <th className="px-4 py-3">NAME</th>
                  <th className="px-4 py-3">FATHER NAME</th>
                  <th className="px-4 py-3">CNIC</th>
                  <th className="px-4 py-3">{activeTab === 'Staff' ? 'BRANCH' : 'PHONE'}</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {personnel.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium">
                      No records found matching current query.
                    </td>
                  </tr>
                ) : (
                  personnel.map((p, idx) => (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedPerson(p)}
                      className="hover:bg-slate-50 transition-colors font-semibold text-slate-700 cursor-pointer"
                    >
                      <td className="px-4 py-3.5 text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-4 py-3.5 text-slate-800">
                        <span className="font-bold text-indigo-600">#{p.biometric_user_id}</span>
                        {p.employee_code && <span className="text-slate-400 text-[11px] ml-1.5">({p.employee_code})</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-bold">
                        {activeTab === 'Staff' ? (p.rank_name || 'Civilian') : (p.course_name || 'Unassigned')}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] uppercase">
                            {p.full_name?.substring(0, 2) || 'NA'}
                          </div>
                          <span className="uppercase font-bold tracking-tight text-slate-800">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 uppercase text-slate-500">{p.father_name || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-500 tracking-wide">{p.cnic || '—'}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {activeTab === 'Staff' ? (p.department_name || 'Admin') : (p.phone || '—')}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(p.attendance_today?.status, p.attendance_today?.first_in, p.attendance_today?.last_out)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedPerson(p); }}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center justify-end w-full group"
                        >
                          View <ChevronRight className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-semibold">
          <div>
            Showing {Math.min(totalRecords, (page - 1) * pageSize + 1)} to {Math.min(totalRecords, page * pageSize)} of {totalRecords} records
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

      {/* Person Details Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800 uppercase">{selectedPerson.full_name}</h3>
                <p className="text-xs text-slate-400">PIN: #{selectedPerson.biometric_user_id} · {selectedPerson.category || (selectedPerson.is_trainee ? 'Trainee' : 'Staff')}</p>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs mb-6">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Service / Roll Code:</span>
                <span className="font-semibold text-slate-700">{selectedPerson.employee_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Father's Name:</span>
                <span className="font-semibold text-slate-700">{selectedPerson.father_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">{selectedPerson.is_trainee ? 'Course:' : 'Rank:'}</span>
                <span className="font-bold text-indigo-600">
                  {selectedPerson.is_trainee ? (selectedPerson.course_name || 'Unassigned') : (selectedPerson.rank_name || 'Civilian')}
                </span>
              </div>
              {!selectedPerson.is_trainee && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Department:</span>
                  <span className="font-semibold text-slate-700">{selectedPerson.department_name || 'Admin'}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">CNIC:</span>
                <span className="font-medium text-slate-700">{selectedPerson.cnic || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Phone:</span>
                <span className="font-medium text-slate-700">{selectedPerson.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Gender:</span>
                <span className="font-medium text-slate-700">{selectedPerson.gender || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Employment Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${selectedPerson.employment_status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {selectedPerson.employment_status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Attendance Status:</span>
                <span className="font-bold text-slate-800">
                  {selectedPerson.attendance_today?.status || 'No punches'}
                </span>
              </div>
              {selectedPerson.attendance_today?.first_in && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">First Punch (IN):</span>
                  <span className="font-semibold text-emerald-600">{new Date(selectedPerson.attendance_today.first_in).toLocaleTimeString()}</span>
                </div>
              )}
              {selectedPerson.attendance_today?.last_out && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Last Punch (OUT):</span>
                  <span className="font-semibold text-slate-600">{new Date(selectedPerson.attendance_today.last_out).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button 
                onClick={() => setSelectedPerson(null)}
                className="px-5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedPerson && (
        <EditPersonnelModal
          person={selectedPerson}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedPerson(null);
            fetchDirectory();
          }}
        />
      )}

    </div>
  );
};

export default Directory;
