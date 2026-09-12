import React, { useEffect, useState } from 'react';
import { 
  Users, UserCheck, UserX, Briefcase, 
  CalendarDays, Activity, FileWarning, ArrowRightLeft, Plus, ChevronRight, Monitor,
  GraduationCap
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import api from '../api/client';

const KPICard = ({ title, value, subtitle, colorClass, bgClass, icon: Icon, borderClass }: any) => (
  <div className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden h-28`}>
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight w-2/3">{title}</span>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      </div>
    </div>
    <div>
      <span className={`text-3xl font-black ${colorClass}`}>{value}</span>
      {subtitle && <div className="text-[10px] font-semibold text-slate-400 mt-1 whitespace-pre-wrap">{subtitle}</div>}
    </div>
    {borderClass && (
      <div className={`absolute bottom-4 left-4 right-4 h-1 rounded-full ${borderClass}`}></div>
    )}
  </div>
);

const ProgressBar = ({ current, total, color }: { current: number, total: number, color: string }) => {
  const percent = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
      <div 
        className={`h-full rounded-full ${color}`} 
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  );
};

const Personnel: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Uniform' | 'Non-Uniform'>('Uniform');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, staffRes] = await Promise.all([
          api.get('/dashboard/staff'),
          api.get('/personnel?is_trainee=false&page_size=100')
        ]);
        setData(dashRes.data.data);
        setStaffList(staffRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch staff data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  const { kpi, distribution, ranks } = data;

  // Filter ranks for the active tab (category)
  const currentCategoryKey = activeTab === 'Uniform' ? 'uniform' : 'non_uniform';
  const filteredRanks = ranks.filter((r: any) => r[currentCategoryKey] > 0);
  
  // Format for Recharts
  const barData = filteredRanks.map((r: any) => ({
    name: r.rank_name,
    Strength: r[currentCategoryKey]
  }));

  const pieData = [
    { name: 'Present', value: kpi.present, color: '#10B981' }, // Emerald
    { name: 'Absent', value: kpi.absent, color: '#F43F5E' }, // Rose
    { name: 'Leave', value: kpi.leave, color: '#0EA5E9' }, // Sky
    { name: 'Weekend', value: kpi.weekend, color: '#475569' }, // Slate
    { name: 'OSD', value: kpi.osd, color: '#6366F1' }, // Indigo
    { name: 'Medical', value: kpi.medical, color: '#F59E0B' }, // Amber
    { name: 'Evidence', value: kpi.evidence, color: '#3B82F6' }, // Blue
    { name: 'Duty Rest', value: kpi.duty_rest, color: '#A855F7' }, // Purple
  ];

  // Helper for colors in list
  const getAvatarColor = (id: number) => {
    const colors = [
      "bg-teal-100 text-teal-600",
      "bg-purple-100 text-purple-600",
      "bg-fuchsia-100 text-fuchsia-600",
      "bg-emerald-100 text-emerald-600",
      "bg-rose-100 text-rose-600",
      "bg-sky-100 text-sky-600",
      "bg-orange-100 text-orange-600",
      "bg-indigo-100 text-indigo-600",
    ];
    return colors[id % colors.length];
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'present') return 'bg-emerald-500';
    if (s === 'absent') return 'bg-rose-500';
    if (s === 'leave') return 'bg-sky-500';
    if (s === 'osd') return 'bg-indigo-500';
    if (s === 'medical') return 'bg-amber-500';
    if (s === 'evidence') return 'bg-blue-500';
    if (s === 'duty_rest' || s === 'duty rest') return 'bg-purple-500';
    if (s === 'weekend') return 'bg-slate-600';
    return 'bg-slate-400';
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Staff Dashboard</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Faculty & staff strength · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors">
            <UserCheck className="w-4 h-4 text-primary" /> Mark attendance
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Add staff
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-3">
        <KPICard title="GRAND TOTAL" value={kpi.total_strength} subtitle={`${kpi.uniform} uniform · ${kpi.non_uniform} civil`} icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" borderClass="bg-indigo-600" />
        <KPICard title="PRESENT" value={kpi.present} subtitle={`On site: ${kpi.present} in -\n0 out`} icon={UserCheck} colorClass="text-emerald-500" bgClass="bg-emerald-50" borderClass="bg-emerald-500" />
        <KPICard title="LATE" value={kpi.late} subtitle={`95% on time`} icon={UserCheck} colorClass="text-amber-500" bgClass="bg-amber-50" borderClass="bg-amber-500" />
        <KPICard title="ABSENT" value={kpi.absent} icon={UserX} colorClass="text-rose-500" bgClass="bg-rose-50" borderClass="bg-rose-500" />
        <KPICard title="LEAVE" value={kpi.leave} icon={Briefcase} colorClass="text-sky-500" bgClass="bg-sky-50" borderClass="bg-sky-500" />
        <KPICard title="OSD" value={kpi.osd} icon={Activity} colorClass="text-indigo-500" bgClass="bg-indigo-50" borderClass="bg-indigo-500" />
        <KPICard title="MEDICAL" value={kpi.medical} icon={FileWarning} colorClass="text-amber-500" bgClass="bg-amber-50" borderClass="bg-amber-500" />
        <KPICard title="EVIDENCE" value={kpi.evidence} icon={GraduationCap} colorClass="text-blue-500" bgClass="bg-blue-50" borderClass="bg-blue-500" />
        <KPICard title="DUTY REST" value={kpi.duty_rest} icon={CalendarDays} colorClass="text-purple-500" bgClass="bg-purple-50" borderClass="bg-purple-500" />
        <KPICard title="WEEKEND" value={kpi.weekend} icon={CalendarDays} colorClass="text-slate-600" bgClass="bg-slate-100" borderClass="bg-slate-500" />
      </div>

      <div className="flex gap-2 text-xs font-bold">
        <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
          <span>→</span> {kpi.present} in now
        </div>
        <div className="flex items-center gap-1 text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <span>←</span> 0 checked out
        </div>
      </div>

      {/* Availability today */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-800">Availability today</h3>
          <p className="text-[11px] text-slate-400 font-medium">Present · late · absent · leave · OSD · medical · evidence · duty rest across all staff</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Donut Chart */}
          <div className="flex justify-center h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pt-1">
              <span className="text-3xl font-black text-slate-800">{kpi.attendance_percent}%</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">present</span>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="md:col-span-2 grid grid-cols-2 gap-x-8 gap-y-4">
            {pieData.map((stat, idx) => {
              const percent = kpi.total_strength > 0 ? (stat.value / kpi.total_strength) * 100 : 0;
              return (
                <div key={idx} className="flex flex-col">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 mb-1">
                    <span>{stat.name}</span>
                    <span className="text-slate-400">{stat.value} · {Math.round(percent)}%</span>
                  </div>
                  <ProgressBar current={stat.value} total={kpi.total_strength} color={getStatusColor(stat.name)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rank-Wise Breakdown */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-[400px]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Rank-Wise Breakdown</h3>
            <p className="text-[11px] text-slate-400 font-medium">Sanctioned strength by rank — click a rank to view the directory</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('Uniform')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'Uniform' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Uniform Staff
            </button>
            <button 
              onClick={() => setActiveTab('Non-Uniform')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'Non-Uniform' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Non-Uniform Staff
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0">
          {/* Table */}
          <div className="overflow-y-auto no-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3 w-16">SR</th>
                  <th className="px-4 py-3">RANK</th>
                  <th className="px-4 py-3 text-right text-slate-800">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredRanks.map((rank: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors font-bold text-slate-600 cursor-pointer">
                    <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-4 py-3">{rank.rank_name}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{rank[currentCategoryKey]}</td>
                  </tr>
                ))}
                {/* Total */}
                <tr className="bg-indigo-50/50 font-black text-indigo-700 border-t border-indigo-100 sticky bottom-0">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{filteredRanks.reduce((sum: number, r: any) => sum + r[currentCategoryKey], 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div className="flex flex-col min-h-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> 
              {activeTab.toUpperCase()} STRENGTH BY RANK
            </div>
            <div className="flex-1 min-h-0 w-full pr-4 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} 
                    width={100} 
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#F8FAFC'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 600 }} 
                  />
                  <Bar dataKey="Strength" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fill: '#64748B', fontSize: 10, fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Staff</h3>
            <p className="text-[11px] text-slate-400 font-medium">{kpi.total_strength} on the roster</p>
          </div>
          <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center">
            View full staff directory <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
        
        <div className="space-y-1">
          {staffList.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No staff found.</div>}
          {staffList.slice(0, 10).map((staff, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(staff.id)}`}>
                  {staff.full_name ? staff.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'NA'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 uppercase">{staff.full_name}</h4>
                  <p className="text-[11px] font-medium text-slate-400">
                    {staff.rank_name || 'Civil'} · {staff.department_name || 'Admin'}
                  </p>
                </div>
              </div>
              <div className="flex items-center text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase">
                PIN {staff.biometric_user_id} <ChevronRight className="w-3 h-3 ml-2 opacity-50 group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Personnel;
