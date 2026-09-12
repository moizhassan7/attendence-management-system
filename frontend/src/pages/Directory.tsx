import React, { useEffect, useState } from 'react';
import { 
  CalendarDays, ChevronRight, Search, FileDown,
  Filter
} from 'lucide-react';
import api from '../api/client';

const Directory: React.FC = () => {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [activeTab, setActiveTab] = useState<'Staff' | 'Trainees'>('Staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inOutFilter, setInOutFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    const fetchDirectory = async () => {
      setLoading(true);
      try {
        const isTrainee = activeTab === 'Trainees';
        let url = `/personnel?is_trainee=${isTrainee}&include_attendance=true&page_size=100`;
        
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const res = await api.get(url);
        setPersonnel(res.data.data || []);
        setTotalRecords(res.data.pagination?.total || 0);
      } catch (error) {
        console.error('Failed to fetch directory', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Debounce search slightly
    const timeout = setTimeout(fetchDirectory, 300);
    return () => clearTimeout(timeout);
  }, [activeTab, searchTerm, statusFilter, inOutFilter, rankFilter, typeFilter]);

  const getStatusBadge = (status: string, firstIn: string, lastOut: string) => {
    const s = status ? status.toLowerCase() : 'absent';
    let baseColor = 'bg-slate-100 text-slate-600';
    
    if (s === 'present') baseColor = 'bg-emerald-50 text-emerald-600';
    if (s === 'late') baseColor = 'bg-amber-50 text-amber-600';
    if (s === 'absent') baseColor = 'bg-rose-50 text-rose-600';
    if (s === 'leave') baseColor = 'bg-sky-50 text-sky-600';
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

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Directory</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Searchable staff & trainee directory</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">
            <FileDown className="w-4 h-4" /> Export Excel
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <FileDown className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col min-h-[600px]">
        {/* Tabs & Total */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-6 border-b border-slate-100 gap-4">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button 
              onClick={() => setActiveTab('Staff')}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'Staff' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Staff
            </button>
            <button 
              onClick={() => setActiveTab('Trainees')}
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
          <div className="relative flex-1 min-w-[250px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name, belt no, CNIC, branch..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm font-medium bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select 
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select 
            value={inOutFilter} onChange={(e) => setInOutFilter(e.target.value)}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">In & out (all)</option>
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
          <select 
            value={rankFilter} onChange={(e) => setRankFilter(e.target.value)}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">All ranks</option>
          </select>
          <select 
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">All staff types</option>
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
             <div className="flex h-32 items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
             </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">SR</th>
                  <th className="px-4 py-3">BELT NO</th>
                  <th className="px-4 py-3">RANK</th>
                  <th className="px-4 py-3">NAME</th>
                  <th className="px-4 py-3">FATHER NAME</th>
                  <th className="px-4 py-3">CNIC</th>
                  <th className="px-4 py-3">DOB</th>
                  <th className="px-4 py-3">BRANCH</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {personnel.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-medium">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  personnel.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors font-semibold text-slate-700">
                      <td className="px-4 py-4 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-4 text-slate-800">{p.employee_code || '—'}</td>
                      <td className="px-4 py-4 text-slate-500">{p.rank_name || 'Civilian'}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] uppercase">
                            {p.full_name.substring(0, 2)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="uppercase font-bold tracking-tight">{p.full_name}</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">General</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 uppercase text-slate-500">{p.father_name || ''}</td>
                      <td className="px-4 py-4 text-slate-500 tracking-wide">{p.cnic || ''}</td>
                      <td className="px-4 py-4 text-slate-500">{p.dob ? new Date(p.dob).toLocaleDateString('en-GB') : ''}</td>
                      <td className="px-4 py-4 text-slate-600">{p.department_name || 'Admin'}</td>
                      <td className="px-4 py-4">
                        {getStatusBadge(p.attendance_today?.status, p.attendance_today?.first_in, p.attendance_today?.last_out)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button className="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center justify-end w-full group">
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
      </div>
    </div>
  );
};

export default Directory;
