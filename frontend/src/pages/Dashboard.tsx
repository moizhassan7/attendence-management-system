import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, Clock, UserX, 
  MonitorPlay, ChevronRight, Stethoscope, Briefcase, FileWarning, CalendarDays, ArrowRightLeft, ShieldCheck, RefreshCw
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import api from '../api/client';
import TraineesOverview from '../components/TraineesOverview';

// Types matching backend schemas
interface DashboardKPI {
  total_strength: number;
  present: number;
  attendance_percent: number;
  late: number;
  absent: number;
  leave: number;
  osd: number;
  medical: number;
  duty_rest: number;
  weekend: number;
  holiday: number;
}

interface AttendanceDistribution {
  status: string;
  count: number;
  percentage: number;
}

interface WorkforceRatio {
  uniform: number;
  non_uniform: number;
  uniform_percent: number;
  non_uniform_percent: number;
}

interface RankSummary {
  rank_id: number;
  rank_name: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  osd: number;
  medical: number;
  duty_rest: number;
}

interface DepartmentSummary {
  department_id: number;
  department_name: string;
  strength: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  osd: number;
  medical: number;
  duty_rest: number;
}

// Custom KPI Card
const KPICard = ({ title, value, subtitle, icon: Icon, colorClass, percent }: any) => (
  <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-50 flex flex-col justify-between h-28">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
    </div>
    <div className="flex items-end gap-2">
      <span className={`text-3xl font-extrabold ${colorClass} tracking-tight`}>{value}</span>
      {percent !== undefined && <span className="text-xs font-semibold text-slate-400 mb-1.5">{percent}</span>}
    </div>
    {subtitle && <div className="text-[10px] text-slate-400 mt-1 leading-tight whitespace-pre-line">{subtitle}</div>}
  </div>
);

const PIE_COLORS: Record<string, string> = {
  PRESENT: '#10B981',
  LATE: '#F59E0B',
  ABSENT: '#EF4444',
  LEAVE: '#06B6D4',
  OSD: '#6366F1',
  MEDICAL: '#F97316',
  EVIDENCE: '#3B82F6',
  DUTY_REST: '#8B5CF6',
  WEEKEND: '#64748B',
  HOLIDAY: '#EC4899',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardKPI | null>(null);
  const [distribution, setDistribution] = useState<AttendanceDistribution[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRatio | null>(null);
  const [ranks, setRanks] = useState<RankSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const [statsRes, distRes, workforceRes, ranksRes, deptsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/distribution'),
        api.get('/dashboard/workforce-ratio'),
        api.get('/dashboard/rank-summary'),
        api.get('/dashboard/department-summary'),
      ]);

      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (distRes.data?.data) setDistribution(distRes.data.data);
      if (workforceRes.data?.data) setWorkforce(workforceRes.data.data);
      if (ranksRes.data?.data) setRanks(ranksRes.data.data);
      if (deptsRes.data?.data) setDepartments(deptsRes.data.data);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Failed to fetch real dashboard data from backend", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    // WebSocket live connection
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      ws = new WebSocket(`${protocol}//${host}:8000/ws/dashboard`);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'dashboard.metrics.updated') {
            fetchDashboardData();
          }
        } catch {
          // ignore non-json
        }
      };
    } catch (err) {
      console.warn("WebSocket dashboard connection skipped:", err);
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [fetchDashboardData]);

  if (loading && !stats) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-500">Loading live data from database...</span>
        </div>
      </div>
    );
  }

  // Prepared data for charts
  const pieData = distribution.length > 0 
    ? distribution.map(d => ({
        name: d.status.replace('_', ' '),
        value: d.count,
        color: PIE_COLORS[d.status] || '#94A3B8',
        percentage: d.percentage
      }))
    : [{ name: 'No Punches', value: stats?.total_strength || 1, color: '#E2E8F0', percentage: 100 }];

  // Bar chart ranks data from DB
  const barData = ranks
    .filter(r => r.total > 0)
    .map(r => ({ name: r.rank_name, Strength: r.total }))
    .sort((a, b) => a.Strength - b.Strength);

  // Computed metrics
  const largestRank = ranks.length > 0 ? [...ranks].sort((a, b) => b.total - a.total)[0] : null;
  const exceptionsCount = (stats?.late || 0) + (stats?.leave || 0) + (stats?.osd || 0) + (stats?.medical || 0) + (stats?.duty_rest || 0);

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-slate-600">
            {new Date().toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
          </span>
          <button 
            onClick={() => fetchDashboardData(true)} 
            disabled={isRefreshing}
            title="Refresh database data"
            className="ml-2 text-slate-400 hover:text-primary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button 
            onClick={() => fetchDashboardData(true)}
            className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors shadow-lg shadow-dark/10"
          >
            <MonitorPlay className="w-4 h-4" />
            Live Sync
          </button>
        </div>
      </div>

      {/* Dynamic Subtitle */}
      <div className="text-sm font-medium text-slate-500 tracking-tight">
        {stats?.present ?? 0} of {stats?.total_strength ?? 0} staff present · {stats?.attendance_percent ?? 0}% attendance · {workforce?.uniform ?? 0} Uniform / {workforce?.non_uniform ?? 0} Non-Uniform
      </div>

      <div className="flex justify-between items-end border-b border-slate-200 pb-2">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Users className="w-5 h-5" />
            <span className="text-lg">Staff Overview</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Live database attendance & strength</div>
        </div>
        <button 
          onClick={() => navigate('/personnel')}
          className="text-sm font-semibold text-primary flex items-center hover:text-primaryDark"
        >
          Personnel directory <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Real KPI Row from Database */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        <KPICard title="STRENGTH" value={stats?.total_strength ?? 0} icon={Users} colorClass="text-primary" />
        <KPICard title="PRESENT" value={stats?.present ?? 0} percent={`${stats?.attendance_percent ?? 0}%`} icon={UserCheck} colorClass="text-accent" />
        <KPICard title="LATE" value={stats?.late ?? 0} icon={Clock} colorClass="text-warning" />
        <KPICard title="ABSENT" value={stats?.absent ?? 0} icon={UserX} colorClass="text-danger" />
        <KPICard title="LEAVE" value={stats?.leave ?? 0} icon={Briefcase} colorClass="text-info" />
        <KPICard title="OSD" value={stats?.osd ?? 0} icon={FileWarning} colorClass="text-purple" />
        <KPICard title="MEDICAL" value={stats?.medical ?? 0} icon={Stethoscope} colorClass="text-warning" />
        <KPICard title="WEEKEND" value={stats?.weekend ?? 0} icon={CalendarDays} colorClass="text-dark" />
        <KPICard 
          title="ON SITE" 
          value={<><span className="text-accent text-xl">→{stats?.present ?? 0}</span> <span className="text-slate-400 text-xl">←0</span></>} 
          subtitle="live presence" 
          icon={ArrowRightLeft} 
          colorClass="text-accent" 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Donut Chart - Real Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[320px]">
          <div>
            <h3 className="font-bold text-slate-800">Attendance today</h3>
            <p className="text-xs text-slate-400">Status distribution across database</p>
          </div>
          <div className="flex-1 relative flex items-center justify-center min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={70} outerRadius={95}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                  cornerRadius={4}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(val: any, name: any) => [`${val} staff`, name]}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-slate-800">{stats?.attendance_percent ?? 0}%</span>
              <span className="text-xs text-slate-400 font-medium">present</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        {/* Workforce Ratio - Real from Database */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-[320px]">
          <div>
            <h3 className="font-bold text-slate-800">Workforce</h3>
            <p className="text-xs text-slate-400">Uniform vs Non-uniform headcounts</p>
          </div>
          
          <div className="flex-1 flex flex-col justify-center my-4">
            <div className="flex justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-slate-500">Uniform ({workforce?.uniform_percent ?? 0}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Non-uniform ({workforce?.non_uniform_percent ?? 0}%)</span>
              </div>
            </div>
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-4xl font-extrabold text-primary">{workforce?.uniform ?? 0}</span>
              <span className="text-4xl font-extrabold text-slate-700">{workforce?.non_uniform ?? 0}</span>
            </div>
            
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${workforce?.uniform_percent ?? 0}%` }}
              ></div>
              <div 
                className="h-full bg-primary/20 transition-all duration-500" 
                style={{ width: `${workforce?.non_uniform_percent ?? 0}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-8 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Attendance</span>
              <span className="font-bold text-slate-800">{stats?.attendance_percent ?? 0}%</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Largest rank</span>
              <span className="font-bold text-slate-800">
                {largestRank ? `${largestRank.rank_name} (${largestRank.total})` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Users className="w-3 h-3"/> Departments
              </span>
              <span className="font-bold text-slate-800">{departments.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">On exception</span>
              <span className="font-bold text-slate-800">{exceptionsCount}</span>
            </div>
          </div>
        </div>

        {/* Strength by rank - Real from Database */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[320px]">
          <div>
            <h3 className="font-bold text-slate-800">Strength by rank</h3>
            <p className="text-xs text-slate-400">Real personnel counts per rank</p>
          </div>
          <div className="flex-1 w-full min-h-0 mt-4">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10 }} 
                    width={110} 
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                  />
                  <Bar dataKey="Strength" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No rank data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Table - Real Database Ranks */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
        <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Rank-wise attendance</h3>
            <p className="text-xs text-slate-400">Real-time breakdown from database personnel and daily logs</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
            {ranks.length} Ranks
          </span>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[400px] no-scrollbar">
          <table className="w-full text-sm text-left relative">
            <thead className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0 bg-white z-10">
              <tr>
                <th className="px-6 py-4">RANK</th>
                <th className="px-2 py-4 text-center text-accent">PRESENT</th>
                <th className="px-2 py-4 text-center text-warning">LATE</th>
                <th className="px-2 py-4 text-center text-danger">ABS</th>
                <th className="px-2 py-4 text-center text-info">LEAVE</th>
                <th className="px-2 py-4 text-center text-slate-600">WKND</th>
                <th className="px-2 py-4 text-center text-purple">OSD</th>
                <th className="px-2 py-4 text-center text-warning">MED</th>
                <th className="px-2 py-4 text-center text-blue-500">EVI</th>
                <th className="px-2 py-4 text-center text-purple">DREST</th>
                <th className="px-6 py-4 text-center text-slate-600">STR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ranks.length > 0 ? (
                ranks.map((rank) => {
                  const presentPercent = rank.total > 0 ? Math.round((rank.present / rank.total) * 100) : 0;
                  return (
                    <tr key={rank.rank_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-semibold text-slate-700 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        {rank.rank_name}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-accent" style={{ width: `${presentPercent}%` }}></div>
                          </div>
                          <span className="font-bold text-accent w-6 text-right">{rank.present}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center text-warning/80 font-medium">
                        {rank.late > 0 ? rank.late : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-danger/80 font-bold">
                        {rank.absent > 0 ? rank.absent : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-info/80 font-medium">
                        {rank.leave > 0 ? rank.leave : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-slate-600 font-medium">
                        <span className="text-slate-200">0</span>
                      </td>
                      <td className="px-2 py-3 text-center text-purple/80 font-medium">
                        {rank.osd > 0 ? rank.osd : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-warning/80 font-medium">
                        {rank.medical > 0 ? rank.medical : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-blue-500/80 font-medium">
                        <span className="text-slate-200">0</span>
                      </td>
                      <td className="px-2 py-3 text-center text-purple/80 font-medium">
                        {rank.duty_rest > 0 ? rank.duty_rest : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700 bg-slate-50/30">
                        {rank.total}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-400">
                    No ranks found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TraineesOverview />
    </div>
  );
};

export default Dashboard;
