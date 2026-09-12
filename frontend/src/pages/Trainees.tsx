import React, { useEffect, useState } from 'react';
import { 
  Users, UserCheck, UserX, Briefcase, 
  CalendarDays, FileWarning, Activity, ArrowRightLeft, Plus, ChevronRight, Monitor
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import api from '../api/client';

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
  evidence: number;
  repatriation: number;
}

interface CourseSummary {
  course_id: number;
  course_name: string;
  strength: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  osd: number;
  medical: number;
  duty_rest: number;
  weekend: number;
  holiday: number;
  evidence: number;
  repatriation: number;
}

interface TraineeData {
  kpi: DashboardKPI;
  courses: CourseSummary[];
  distribution: any[];
}

const KPICard = ({ title, value, subtitle, colorClass, bgClass, icon: Icon, borderClass }: any) => (
  <div className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden h-28`}>
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      </div>
    </div>
    <div>
      <span className={`text-3xl font-black ${colorClass}`}>{value}</span>
      {subtitle && <div className="text-[10px] font-semibold text-slate-400 mt-1">{subtitle}</div>}
    </div>
    {borderClass && (
      <div className={`absolute bottom-4 left-4 right-4 h-1 rounded-full ${borderClass}`}></div>
    )}
  </div>
);

const ProgressBar = ({ current, total }: { current: number, total: number }) => {
  const percent = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="w-full flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-slate-200 rounded-full" 
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
};

const Trainees: React.FC = () => {
  const [data, setData] = useState<TraineeData | null>(null);
  const [traineeList, setTraineeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, traineesRes] = await Promise.all([
          api.get('/dashboard/trainees'),
          api.get('/personnel?is_trainee=true&page_size=100') // fetch up to 100 recent trainees for the list
        ]);
        setData(dashRes.data.data);
        setTraineeList(traineesRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch trainee data', error);
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

  const { kpi, courses } = data;

  // Colors for Donut Charts matching the UI (Present = dark slate, Remaining = light gray)
  const COLORS = ['#475569', '#E2E8F0'];

  // Avatar color generator based on ID
  const getAvatarColor = (id: number) => {
    const colors = [
      "bg-teal-100 text-teal-600",
      "bg-purple-100 text-purple-600",
      "bg-fuchsia-100 text-fuchsia-600",
      "bg-emerald-100 text-emerald-600",
      "bg-rose-100 text-rose-600",
      "bg-sky-100 text-sky-600",
    ];
    return colors[id % colors.length];
  };

  // Sum for the detailed statement table
  const totalEnrolled = courses.reduce((acc, c) => acc + c.strength, 0);
  const totalPresent = courses.reduce((acc, c) => acc + c.present, 0);
  const totalAbsent = courses.reduce((acc, c) => acc + c.absent, 0);
  const totalLeave = courses.reduce((acc, c) => acc + c.leave, 0);
  const totalWeekend = courses.reduce((acc, c) => acc + c.weekend, 0);
  const totalOSD = courses.reduce((acc, c) => acc + c.osd, 0);
  const totalMedical = courses.reduce((acc, c) => acc + c.medical, 0);
  const totalEvidence = courses.reduce((acc, c) => acc + c.evidence, 0);
  const totalRepat = courses.reduce((acc, c) => acc + c.repatriation, 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Trainee Dashboard</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Course enrolment & attendance · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors hidden md:flex">
            <Monitor className="w-4 h-4" /> Live Screen
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors">
            <UserCheck className="w-4 h-4 text-primary" /> Mark attendance
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Add trainee
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        <KPICard title="ENROLLED" value={kpi.total_strength} icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" borderClass="bg-indigo-600" />
        <KPICard title="PRESENT" value={kpi.present} subtitle={`${kpi.attendance_percent}% present`} icon={UserCheck} colorClass="text-emerald-500" bgClass="bg-emerald-50" borderClass="bg-slate-200" />
        <KPICard title="ABSENT" value={kpi.absent} icon={UserX} colorClass="text-rose-500" bgClass="bg-rose-50" borderClass="bg-slate-200" />
        <KPICard title="LEAVE" value={kpi.leave} icon={Briefcase} colorClass="text-sky-500" bgClass="bg-sky-50" borderClass="bg-slate-200" />
        <KPICard title="WEEKEND" value={kpi.weekend} icon={CalendarDays} colorClass="text-slate-600" bgClass="bg-slate-100" borderClass="bg-slate-400" />
        <KPICard title="OSD" value={kpi.osd} icon={Activity} colorClass="text-indigo-500" bgClass="bg-indigo-50" borderClass="bg-slate-200" />
        <KPICard title="MEDICAL" value={kpi.medical} icon={FileWarning} colorClass="text-amber-500" bgClass="bg-amber-50" borderClass="bg-slate-200" />
        <KPICard title="EVIDENCE" value={kpi.evidence} icon={FileWarning} colorClass="text-blue-500" bgClass="bg-blue-50" borderClass="bg-slate-200" />
        <KPICard title="REPATRIATION" value={kpi.repatriation} icon={ArrowRightLeft} colorClass="text-pink-500" bgClass="bg-pink-50" borderClass="bg-pink-500" />
      </div>

      {/* Course-Wise Strength */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-800">Course-Wise Strength</h3>
          <p className="text-[11px] text-slate-400 font-medium">Present strength by course · tap for full stats</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {courses.map((course, idx) => (
            <div key={idx} className="flex flex-col gap-1 cursor-pointer group">
              <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                <span>{course.course_name}</span>
                <span className="text-indigo-600 flex items-center">{course.present} <ChevronRight className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" /></span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-medium text-slate-400">
                <span>attended / enrolled</span>
                <span>{course.present} / {course.strength}</span>
              </div>
              <ProgressBar current={course.present} total={course.strength} />
            </div>
          ))}
        </div>
      </div>

      {/* Daily Trainee Statement (Donuts) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Daily Trainee Statement</h3>
            <p className="text-[11px] text-slate-400 font-medium">Present strength per course</p>
          </div>
          <div className="hidden md:flex flex-wrap gap-3 text-[9px] font-bold text-slate-500 uppercase">
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Present</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Absent</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div> Leave</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div> Weekend</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> OSD</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Medical</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Evidence</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div> Repatriation</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {courses.map((course, idx) => {
            const pieData = [
              { name: 'Present Strength', value: course.present },
              { name: 'Remaining', value: Math.max(0, course.strength - course.present) }
            ];
            
            return (
              <div key={idx} className="flex flex-col items-center">
                <h4 className="text-[11px] font-bold text-slate-600 mb-4 text-center">
                  {course.course_name}
                </h4>
                <div className="h-40 w-40 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col pt-1">
                    <span className="text-2xl font-black text-slate-700 leading-none">{course.present}</span>
                    <span className="text-[10px] text-slate-400 font-semibold mt-1">of {course.strength}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Statement Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-sm font-bold text-slate-800">Detailed Statement</h3>
          <p className="text-[11px] text-slate-400 font-medium">Per-course enrolment & attendance</p>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 bg-white">
              <tr>
                <th className="px-6 py-4">SR</th>
                <th className="px-6 py-4">COURSE</th>
                <th className="px-4 py-4 text-center text-slate-800">ENROLLED</th>
                <th className="px-4 py-4 text-center text-slate-500">PRESENT</th>
                <th className="px-4 py-4 text-center text-slate-500">ABSENT</th>
                <th className="px-4 py-4 text-center text-slate-500">LEAVE</th>
                <th className="px-4 py-4 text-center text-slate-500">WEEKEND</th>
                <th className="px-4 py-4 text-center text-slate-500">OSD</th>
                <th className="px-4 py-4 text-center text-slate-500">MEDICAL</th>
                <th className="px-4 py-4 text-center text-slate-500">EVIDENCE</th>
                <th className="px-4 py-4 text-center text-slate-500">REPAT.</th>
                <th className="px-4 py-4 text-center text-slate-500">MALE</th>
                <th className="px-4 py-4 text-center text-slate-500">FEMALE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {courses.map((course, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-slate-600 font-semibold">
                  <td className="px-6 py-4 text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4">{course.course_name}</td>
                  <td className="px-4 py-4 text-center font-bold text-slate-800">{course.strength}</td>
                  <td className="px-4 py-4 text-center text-emerald-500">{course.present}</td>
                  <td className="px-4 py-4 text-center text-rose-500">{course.absent}</td>
                  <td className="px-4 py-4 text-center text-sky-500">{course.leave}</td>
                  <td className="px-4 py-4 text-center text-slate-500">{course.weekend}</td>
                  <td className="px-4 py-4 text-center text-indigo-500">{course.osd}</td>
                  <td className="px-4 py-4 text-center text-amber-500">{course.medical}</td>
                  <td className="px-4 py-4 text-center text-blue-500">{course.evidence}</td>
                  <td className="px-4 py-4 text-center text-pink-500">{course.repatriation}</td>
                  <td className="px-4 py-4 text-center text-slate-500">{course.male}</td>
                  <td className="px-4 py-4 text-center text-slate-500">{course.female}</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-indigo-50/50 font-bold text-indigo-900 border-t border-indigo-100">
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4">Total</td>
                <td className="px-4 py-4 text-center">{totalEnrolled}</td>
                <td className="px-4 py-4 text-center">{totalPresent}</td>
                <td className="px-4 py-4 text-center">{totalAbsent}</td>
                <td className="px-4 py-4 text-center">{totalLeave}</td>
                <td className="px-4 py-4 text-center">{totalWeekend}</td>
                <td className="px-4 py-4 text-center">{totalOSD}</td>
                <td className="px-4 py-4 text-center">{totalMedical}</td>
                <td className="px-4 py-4 text-center">{totalEvidence}</td>
                <td className="px-4 py-4 text-center">{totalRepat}</td>
                <td className="px-4 py-4 text-center">{courses.reduce((acc, c) => acc + c.male, 0)}</td>
                <td className="px-4 py-4 text-center">{courses.reduce((acc, c) => acc + c.female, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Trainees List */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Trainees</h3>
            <p className="text-[11px] text-slate-400 font-medium">{totalEnrolled} individual records</p>
          </div>
          <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center">
            View full trainee directory <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
        
        <div className="space-y-1">
          {traineeList.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No trainees found.</div>}
          {traineeList.map((trainee, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(trainee.id)}`}>
                  {trainee.full_name ? trainee.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'NA'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">{trainee.full_name}</h4>
                  <p className="text-xs font-medium text-slate-400">ID: {trainee.biometric_user_id}</p>
                </div>
              </div>
              <div className="flex items-center text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                PIN {trainee.biometric_user_id} <ChevronRight className="w-3 h-3 ml-2 opacity-50 group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Trainees;
