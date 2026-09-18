import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Clock, UserX, 
  MonitorPlay, ChevronRight, Stethoscope, Briefcase, FileWarning, CalendarDays, ArrowRightLeft, ShieldCheck, RefreshCw
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import api from '../api/client';
import { dashboardWebSocketUrl } from '../api/ws';
import TraineesOverview from '../components/TraineesOverview';
import { rankChartLabel, rankDisplayName } from '../utils/rankLabels';

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

const StatusTile = ({ title, value, hint, icon: Icon, colorClass }: any) => (
  <div className="bg-slate-50/80 rounded-xl px-3 py-3 border border-slate-100 min-h-[78px] flex flex-col justify-between">
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className="flex items-end gap-1.5 mt-2">
      <span className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>{value}</span>
      {hint != null && hint !== '' && (
        <span className="text-[10px] font-semibold text-slate-400 mb-0.5">{hint}</span>
      )}
    </div>
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
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [stats, setStats] = useState<DashboardKPI | null>(null);
  const [distribution, setDistribution] = useState<AttendanceDistribution[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRatio | null>(null);
  const [ranks, setRanks] = useState<RankSummary[]>([]);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const params = selectedDate ? { date: selectedDate } : {};
      const [statsRes, distRes, workforceRes, ranksRes, deptsRes] = await Promise.all([
        api.get('/dashboard/stats', { params }),
        api.get('/dashboard/distribution', { params }),
        api.get('/dashboard/workforce-ratio'),
        api.get('/dashboard/rank-summary', { params }),
        api.get('/dashboard/department-summary', { params }),
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
  }, [selectedDate]);

  const handleLiveSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const res = await api.post('/devices/sync-all');
      const data = res.data?.data;
      const msg = res.data?.message || `Sync completed: ${data?.total_synced ?? 0} devices processed.`;
      setSyncNotice(msg);
      await fetchDashboardData(true);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      console.error("Device sync failed", err);
      setSyncNotice(err.response?.data?.detail || "Device synchronization failed. Check device network connectivity.");
      setTimeout(() => setSyncNotice(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket(dashboardWebSocketUrl());
      
      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'dashboard.metrics.updated') {
            fetchDashboardData();
          }
        } catch {
          // ignore non-json
        }
      };

      ws.onerror = () => {
        // Prevent uncaught console error on disconnect
      };
    } catch (err) {
      console.warn("WebSocket dashboard connection skipped:", err);
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => {
            try { ws?.close(); } catch {}
          };
        }
      }
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

  const pieData = distribution.length > 0 
    ? distribution.map(d => ({
        name: d.status.replace('_', ' '),
        value: d.count,
        color: PIE_COLORS[d.status] || '#94A3B8',
        percentage: d.percentage
      }))
    : [{ name: 'No Punches', value: stats?.total_strength || 1, color: '#E2E8F0', percentage: 100 }];

  const barData = ranks
    .filter(r => r.total > 0)
    .map(r => ({
      name: rankChartLabel(r.rank_name),
      fullName: rankDisplayName(r.rank_name),
      Strength: r.total,
    }));

  const largestRank = ranks.length > 0 ? [...ranks].sort((a, b) => b.total - a.total)[0] : null;
  const exceptionsCount = (stats?.late || 0) + (stats?.leave || 0) + (stats?.osd || 0) + (stats?.medical || 0) + (stats?.duty_rest || 0);
  const attendancePct = stats?.attendance_percent ?? 0;
  const liveDepts = [...departments]
    .filter((d) => d.strength > 0)
    .sort((a, b) => b.strength - a.strength);

  return (
    <div className="space-y-6 text-slate-800">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Users className="w-5 h-5" />
            <span className="text-lg">Staff Overview</span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {stats?.present ?? 0} of {stats?.total_strength ?? 0} staff present · {attendancePct}% attendance · {workforce?.uniform ?? 0} Uniform / {workforce?.non_uniform ?? 0} Non-Uniform
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            <CalendarDays className="w-4 h-4 text-primary" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer"
              title="Select date to inspect attendance records"
            />
            <button 
              onClick={() => fetchDashboardData(true)} 
              disabled={isRefreshing || isSyncing}
              title="Refresh database data"
              className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button 
            onClick={handleLiveSync}
            disabled={isSyncing}
            title="Poll and synchronize all ZKTeco devices immediately"
            className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors shadow-lg shadow-dark/10 disabled:opacity-75"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                <span>Syncing Devices...</span>
              </>
            ) : (
              <>
                <MonitorPlay className="w-4 h-4" />
                <span>Live Sync</span>
              </>
            )}
          </button>
          <button 
            onClick={() => navigate('/personnel')}
            className="text-sm font-semibold text-primary flex items-center hover:text-primaryDark bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
          >
            Personnel directory <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all">
          <span>{syncNotice}</span>
          <button onClick={() => setSyncNotice(null)} className="text-primary hover:text-primaryDark">✕</button>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-5 lg:pb-0 lg:pr-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parade state</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-5xl font-extrabold tracking-tight text-accent">{stats?.present ?? 0}</span>
              <span className="text-lg font-bold text-slate-400">/ {stats?.total_strength ?? 0}</span>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-1">Present of total staff strength</p>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, attendancePct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[11px] font-semibold">
              <span className="text-accent">{attendancePct}% attendance</span>
              <span className="text-slate-400">{exceptionsCount} on exception</span>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusTile title="Late" value={stats?.late ?? 0} icon={Clock} colorClass="text-warning" />
            <StatusTile title="Absent" value={stats?.absent ?? 0} icon={UserX} colorClass="text-danger" />
            <StatusTile title="Leave" value={stats?.leave ?? 0} icon={Briefcase} colorClass="text-info" />
            <StatusTile title="OSD" value={stats?.osd ?? 0} icon={FileWarning} colorClass="text-purple" />
            <StatusTile title="Medical" value={stats?.medical ?? 0} icon={Stethoscope} colorClass="text-warning" />
            <StatusTile title="Weekend" value={stats?.weekend ?? 0} icon={CalendarDays} colorClass="text-dark" />
            <StatusTile title="Duty rest" value={stats?.duty_rest ?? 0} icon={ShieldCheck} colorClass="text-purple" />
            <StatusTile
              title="On site"
              value={stats?.present ?? 0}
              hint="in"
              icon={ArrowRightLeft}
              colorClass="text-accent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 pb-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Rank-wise attendance</h3>
              <p className="text-xs text-slate-400">Seniority order · click a rank to open directory</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              {ranks.length} Ranks
            </span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[520px] no-scrollbar">
            <table className="w-full text-sm text-left relative">
              <thead className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0 bg-white z-10">
                <tr>
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-2 py-3 text-center text-accent">Present</th>
                  <th className="px-2 py-3 text-center text-warning">Late</th>
                  <th className="px-2 py-3 text-center text-danger">Abs</th>
                  <th className="px-2 py-3 text-center text-info">Leave</th>
                  <th className="px-2 py-3 text-center text-purple">OSD</th>
                  <th className="px-2 py-3 text-center text-warning">Med</th>
                  <th className="px-2 py-3 text-center text-purple">Drest</th>
                  <th className="px-5 py-3 text-center text-slate-600">Str</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ranks.length > 0 ? (
                  ranks.map((rank) => {
                    const presentPercent = rank.total > 0 ? Math.round((rank.present / rank.total) * 100) : 0;
                    return (
                      <tr 
                        key={rank.rank_id} 
                        onClick={() => navigate(`/directory?tab=Staff&rank_id=${rank.rank_id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        title={`Click to view all ${rankDisplayName(rank.rank_name)} in directory`}
                      >
                        <td className="px-5 py-3 font-semibold text-slate-700">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                            {rankDisplayName(rank.rank_name)}
                          </div>
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
                        <td className="px-2 py-3 text-center text-purple/80 font-medium">
                          {rank.osd > 0 ? rank.osd : <span className="text-slate-200">0</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-warning/80 font-medium">
                          {rank.medical > 0 ? rank.medical : <span className="text-slate-200">0</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-purple/80 font-medium">
                          {rank.duty_rest > 0 ? rank.duty_rest : <span className="text-slate-200">0</span>}
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-slate-700 bg-slate-50/30">
                          {rank.total}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                      No ranks found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[300px]">
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
                    innerRadius={62} outerRadius={86}
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
                <span className="text-3xl font-extrabold text-slate-800">{attendancePct}%</span>
                <span className="text-xs text-slate-400 font-medium">present</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mt-1">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800">Workforce</h3>
              <p className="text-xs text-slate-400">Uniform vs Non-uniform headcounts</p>
            </div>
            <div className="mt-5">
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
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 border-t border-slate-100 pt-4 mt-5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Attendance</span>
                <span className="font-bold text-slate-800">{attendancePct}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Largest rank</span>
                <span className="font-bold text-slate-800 truncate ml-2">
                  {largestRank ? `${rankDisplayName(largestRank.rank_name)} (${largestRank.total})` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Departments</span>
                <span className="font-bold text-slate-800">{departments.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">On exception</span>
                <span className="font-bold text-slate-800">{exceptionsCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Strength by rank</h3>
            <p className="text-xs text-slate-400">Seniority order · real personnel counts</p>
          </div>
          <div className="w-full mt-4" style={{ height: Math.max(220, barData.length * 32) }}>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    interval={0}
                    width={118}
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                  />
                  <RechartsTooltip 
                    cursor={{fill: '#F1F5F9'}}
                    formatter={(value) => [value ?? 0, 'Strength']}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || ''}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                  />
                  <Bar dataKey="Strength" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No rank data available
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Departments</h3>
            <p className="text-xs text-slate-400">Present against posted strength</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto no-scrollbar divide-y divide-slate-50">
            {liveDepts.length > 0 ? liveDepts.map((dept) => {
              const pct = dept.strength > 0 ? Math.round((dept.present / dept.strength) * 100) : 0;
              return (
                <div key={dept.department_id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700 truncate">{dept.department_name}</span>
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      {dept.present}/{dept.strength}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            }) : (
              <div className="px-5 py-8 text-center text-xs text-slate-400">No department strength recorded.</div>
            )}
          </div>
        </div>
      </div>

      <TraineesOverview targetDate={selectedDate} />
    </div>
  );
};

export default Dashboard;
