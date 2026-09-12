import React, { useEffect, useState } from 'react';
import { 
  Users, UserCheck, UserX, Briefcase, 
  CalendarDays, Activity, FileWarning, ArrowRightLeft, Plus, ChevronRight, Monitor,
  GraduationCap, Sunrise, Sun, Moon, Clock, Search, FileDown
} from 'lucide-react';
import api from '../api/client';

const KPICard = ({ title, value, colorClass, bgClass, icon: Icon, borderClass }: any) => (
  <div className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden`}>
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight max-w-[70%]">{title}</span>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      </div>
    </div>
    <div className="mt-4">
      <span className={`text-3xl font-black ${colorClass}`}>{value}</span>
    </div>
    {borderClass && (
      <div className={`absolute bottom-4 left-4 right-4 h-1 rounded-full ${borderClass}`}></div>
    )}
  </div>
);

const Security: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<string>('Morning');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/security');
        setData(res.data.data);
      } catch (error) {
        console.error('Failed to fetch security data', error);
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

  const { deployment, status, staff } = data;

  const getShiftIcon = (shift: string) => {
    if (shift === 'Morning') return Sunrise;
    if (shift === 'Evening') return Sun;
    if (shift === 'Night') return Moon;
    if (shift === 'Awaiting') return Clock;
    return CalendarDays;
  };

  const shiftTabs = [
    { name: 'Morning', count: deployment.morning, icon: Sunrise },
    { name: 'Evening', count: deployment.evening, icon: Sun },
    { name: 'Night', count: deployment.night, icon: Moon },
    { name: 'Awaiting', count: deployment.awaiting, icon: Clock },
    { name: 'Off / Marked', count: deployment.off, icon: CalendarDays }
  ];

  const filteredStaff = staff.filter((s: any) => 
    s.shift.toLowerCase() === activeShift.toLowerCase() || 
    (activeShift === 'Off / Marked' && s.shift === 'Off / Marked')
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Security Attendance</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Shifts are detected automatically from each guard's punches — no daily setup needed</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <FileDown className="w-4 h-4" /> Excel
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <FileDown className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DEPLOYMENT TODAY</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard title="MORNING" value={deployment.morning} icon={Sunrise} colorClass="text-emerald-500" bgClass="bg-emerald-50" borderClass="bg-emerald-500" />
          <KPICard title="EVENING" value={deployment.evening} icon={Sun} colorClass="text-amber-500" bgClass="bg-amber-50" borderClass="bg-amber-500" />
          <KPICard title="NIGHT" value={deployment.night} icon={Moon} colorClass="text-indigo-600" bgClass="bg-indigo-50" borderClass="bg-indigo-600" />
          <KPICard title="AWAITING" value={deployment.awaiting} icon={Clock} colorClass="text-slate-600" bgClass="bg-slate-100" borderClass="bg-slate-500" />
          <KPICard title="OFF / MARKED" value={deployment.off} icon={CalendarDays} colorClass="text-purple-600" bgClass="bg-purple-50" borderClass="bg-purple-600" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ATTENDANCE STATUS</h3>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
          <KPICard title="TOTAL" value={status.total} icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
          <KPICard title="PRESENT" value={status.present} icon={UserCheck} colorClass="text-emerald-500" bgClass="bg-emerald-50" />
          <KPICard title="LATE" value={status.late} icon={UserCheck} colorClass="text-amber-500" bgClass="bg-amber-50" />
          <KPICard title="ABSENT" value={status.absent} icon={UserX} colorClass="text-rose-500" bgClass="bg-rose-50" />
          <KPICard title="LEAVE" value={status.leave} icon={Briefcase} colorClass="text-sky-500" bgClass="bg-sky-50" />
          <KPICard title="OSD" value={status.osd} icon={Activity} colorClass="text-indigo-500" bgClass="bg-indigo-50" />
          <KPICard title="MEDICAL" value={status.medical} icon={FileWarning} colorClass="text-amber-500" bgClass="bg-amber-50" />
          <KPICard title="EVIDENCE" value={status.evidence} icon={GraduationCap} colorClass="text-blue-500" bgClass="bg-blue-50" />
          <KPICard title="DUTY REST" value={status.duty_rest} icon={CalendarDays} colorClass="text-purple-500" bgClass="bg-purple-50" />
        </div>
      </div>

      {/* Shift Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {shiftTabs.map(tab => (
          <button
            key={tab.name}
            onClick={() => setActiveShift(tab.name)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
              activeShift === tab.name 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.name} 
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeShift === tab.name ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
        <div className="ml-auto">
          <button className="flex items-center gap-2 bg-slate-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-slate-600 transition-colors">
            Mark selected
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-h-[400px]">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-800">{activeShift} - {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</h3>
          <p className="text-[11px] text-slate-400 font-medium">{filteredStaff.length} on the {activeShift.toLowerCase()} shift (detected from punches)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="px-4 py-3">NAME</th>
                <th className="px-4 py-3">RANK / BELT</th>
                <th className="px-4 py-3">CHECK-IN</th>
                <th className="px-4 py-3">CHECK-OUT</th>
                <th className="px-4 py-3">HOURS</th>
                <th className="px-4 py-3">OT</th>
                <th className="px-4 py-3">WORKED (7D)</th>
                <th className="px-4 py-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-medium">
                    No staff deployed in {activeShift} shift.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staffMember: any) => (
                  <tr key={staffMember.id} className="hover:bg-slate-50 transition-colors font-semibold text-slate-700">
                    <td className="px-4 py-4">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                          {staffMember.name.substring(0, 2)}
                        </div>
                        <span className="uppercase font-bold">{staffMember.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">{staffMember.rank_belt}</td>
                    <td className="px-4 py-4 text-emerald-600 font-bold">
                      {staffMember.check_in ? new Date(staffMember.check_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-4">
                      {staffMember.check_out ? (
                        <span className="text-slate-700">{new Date(staffMember.check_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      ) : (
                        <span className="text-amber-500 font-bold">no checkout</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-indigo-600 font-bold">{staffMember.hours ? `${staffMember.hours}h` : '-'}</td>
                    <td className="px-4 py-4 text-slate-400 font-medium">{staffMember.ot || '-'}</td>
                    <td className="px-4 py-4 text-emerald-600 font-bold">{staffMember.worked_7d}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                          {staffMember.status}
                        </span>
                        {!staffMember.check_out && staffMember.check_in && (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                            In
                          </span>
                        )}
                        {staffMember.check_out && (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                            Out
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Security;
