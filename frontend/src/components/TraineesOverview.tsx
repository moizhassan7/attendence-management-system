import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, ChevronRight, UserCheck, UserX, Briefcase, 
  CalendarDays, FileWarning, ArrowRightLeft, Users, BookOpen
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';

// Mock data matching the screenshot
const TRAINEE_ATTENDANCE = {
  present: 0,
  presentPercent: 0,
  absent: 3,
  leave: 0,
  weekend: 900,
  osd: 0,
  repatriation: 17
};

const TRAINEE_ENROLMENT = {
  total: 920,
  basic: 770,
  lower: 87,
  drill: 0
};

const COURSE_DATA = [
  { name: 'Basic Recruit Class Course', enrolled: 770, present: 0, late: 0, absent: 3, leave: 0, weekend: 752, osd: 0, medical: 0, evidence: 0, repatriation: 15, strength: 770 },
  { name: 'Lower Class Course', enrolled: 87, present: 0, late: 0, absent: 0, leave: 0, weekend: 86, osd: 0, medical: 0, evidence: 0, repatriation: 1, strength: 87 },
  { name: 'Drill/Weapon Instructor Course', enrolled: 0, present: 0, late: 0, absent: 0, leave: 0, weekend: 0, osd: 0, medical: 0, evidence: 0, repatriation: 0, strength: 0 },
];

const SmallKPICard = ({ title, value, subtitle, colorClass, icon: Icon }: any) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className={`w-4 h-4 ${colorClass}`} />}
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-extrabold ${colorClass || 'text-primary'}`}>{value}</span>
    </div>
    {subtitle && <div className="text-[10px] text-slate-400 mt-1">{subtitle}</div>}
  </div>
);

const TraineesOverview: React.FC = () => {
  const navigate = useNavigate();
  
  const barChartData = COURSE_DATA.map(c => ({
    name: c.name,
    Strength: c.enrolled
  }));

  return (
    <div className="mt-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white/50 p-4 rounded-2xl border border-slate-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-primary flex items-center justify-center shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Trainees</h2>
            <p className="text-xs text-slate-500 font-medium">Course enrolment & attendance</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/trainees')}
          className="text-sm font-semibold text-primary flex items-center hover:text-primaryDark bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 transition-all hover:shadow-md"
        >
          Trainees page <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Trainees Attendance KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Trainees - Attendance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SmallKPICard title="PRESENT" value={TRAINEE_ATTENDANCE.present} subtitle={`${TRAINEE_ATTENDANCE.presentPercent}%`} icon={UserCheck} colorClass="text-accent" />
          <SmallKPICard title="ABSENT" value={TRAINEE_ATTENDANCE.absent} icon={UserX} colorClass="text-danger" />
          <SmallKPICard title="LEAVE" value={TRAINEE_ATTENDANCE.leave} icon={Briefcase} colorClass="text-info" />
          <SmallKPICard title="WEEKEND" value={TRAINEE_ATTENDANCE.weekend} icon={CalendarDays} colorClass="text-dark" />
          <SmallKPICard title="OSD" value={TRAINEE_ATTENDANCE.osd} icon={FileWarning} colorClass="text-purple" />
          <SmallKPICard title="REPATRIATION" value={TRAINEE_ATTENDANCE.repatriation} icon={ArrowRightLeft} colorClass="text-pink-500" />
        </div>
      </div>

      {/* Trainees Enrolment KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 mt-6">Trainees - Course Enrolment</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <SmallKPICard title="TRAINEES ENROLLED" value={TRAINEE_ENROLMENT.total} icon={Users} colorClass="text-primary" />
          <SmallKPICard title="BASIC RECRUIT CLASS COURSE" value={TRAINEE_ENROLMENT.basic} icon={BookOpen} colorClass="text-indigo-600" />
          <SmallKPICard title="LOWER CLASS COURSE" value={TRAINEE_ENROLMENT.lower} icon={GraduationCap} colorClass="text-emerald-500" />
          <SmallKPICard title="DRILL/WEAPON INSTRUCTOR COURSE" value={TRAINEE_ENROLMENT.drill} icon={FileWarning} colorClass="text-amber-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
        {/* Enrolment by Course Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[320px]">
          <div>
            <h3 className="font-bold text-slate-800">Enrolment by course</h3>
            <p className="text-xs text-slate-400">Sanctioned strength</p>
          </div>
          <div className="flex-1 w-full min-h-0 mt-6 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748B', fontSize: 10 }} 
                  width={140} 
                />
                <RechartsTooltip 
                  cursor={{fill: '#F1F5F9'}} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                />
                <Bar dataKey="Strength" fill="#10B981" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748B', fontSize: 10, fontWeight: 600 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Course-wise attendance table */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[320px]">
          <div className="p-6 pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Course-wise attendance</h3>
            <p className="text-xs text-slate-400">Every course × status · by enrolment</p>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0 bg-white z-10">
                <tr>
                  <th className="px-6 py-3">COURSE</th>
                  <th className="px-2 py-3 text-center text-accent">PRESENT</th>
                  <th className="px-2 py-3 text-center text-warning">LATE</th>
                  <th className="px-2 py-3 text-center text-danger">ABS</th>
                  <th className="px-2 py-3 text-center text-info">LEAVE</th>
                  <th className="px-2 py-3 text-center text-slate-600">WKND</th>
                  <th className="px-2 py-3 text-center text-purple">OSD</th>
                  <th className="px-2 py-3 text-center text-warning">MED</th>
                  <th className="px-2 py-3 text-center text-blue-500">EVI</th>
                  <th className="px-2 py-3 text-center text-pink-500">REPAT</th>
                  <th className="px-6 py-3 text-center text-slate-600">STR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {COURSE_DATA.map((course, idx) => {
                  const colors = ['bg-primary', 'bg-purple', 'bg-pink-500'];
                  const bulletColor = colors[idx % colors.length];
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-semibold text-slate-700 flex items-center gap-2 text-xs truncate max-w-[160px]" title={course.name}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bulletColor}`}></div>
                        <span className="truncate">{course.name}</span>
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-accent">
                        {course.present > 0 ? course.present : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-warning/80">
                        {course.late > 0 ? course.late : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-danger">
                        {course.absent > 0 ? course.absent : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-info/80">
                        {course.leave > 0 ? course.leave : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-slate-600">
                        {course.weekend > 0 ? course.weekend : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-purple/80">
                        {course.osd > 0 ? course.osd : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-warning/80">
                        {course.medical > 0 ? course.medical : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-medium text-blue-500/80">
                        {course.evidence > 0 ? course.evidence : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-pink-500">
                        {course.repatriation > 0 ? course.repatriation : <span className="text-slate-200">0</span>}
                      </td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700 bg-slate-50/30">
                        {course.strength}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraineesOverview;
