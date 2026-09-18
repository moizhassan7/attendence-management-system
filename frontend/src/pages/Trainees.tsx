import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, UserX, Briefcase, 
  CalendarDays, FileWarning, Activity, ArrowRightLeft, Plus, ChevronRight, Monitor,
  Search, X, Trash2, Edit
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';
import api from '../api/client';
import { EditPersonnelModal } from '../components/EditPersonnelModal';
import { AttendanceStatusUsersModal } from '../components/AttendanceStatusUsersModal';
import PaginationBar from '../components/PaginationBar';
import SearchablePersonSelect from '../components/SearchablePersonSelect';
import { fetchNextDevicePin, digitsOnlyPin } from '../utils/nextDevicePin';

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
  male?: number;
  female?: number;
}

interface TraineeData {
  kpi: DashboardKPI;
  courses: CourseSummary[];
  distribution: any[];
}

const KPICard = ({ title, value, subtitle, colorClass, bgClass, icon: Icon, borderClass, onClick }: any) => (
  <div 
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    title={onClick ? `Click to view ${title} trainees` : undefined}
    className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden h-28 transition-all duration-200 ${
      onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 select-none group' : ''
    }`}
  >
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{title}</span>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgClass} group-hover:scale-110 transition-transform`}>
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
  const navigate = useNavigate();
  const [data, setData] = useState<TraineeData | null>(null);
  const [traineeList, setTraineeList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pickerList, setPickerList] = useState<any[]>([]);
  const pageSize = 25;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    title: string;
    status: string;
    courseId?: number;
  }>({
    isOpen: false,
    title: '',
    status: 'ALL',
  });

  const openStatusModal = (title: string, status: string, courseId?: number) => {
    setStatusModal({
      isOpen: true,
      title,
      status,
      courseId,
    });
  };

  // Add Trainee Form
  const [newTrainee, setNewTrainee] = useState({
    full_name: '',
    biometric_user_id: '',
    employee_code: '',
    gender: 'Male',
    course_id: '',
    phone: '',
    cnic: '',
  });

  // Mark Attendance Form
  const [markAttendance, setMarkAttendance] = useState({
    personnel_id: '',
    exception_type: 'LEAVE',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, coursesRes] = await Promise.all([
        api.get('/dashboard/trainees'),
        api.get('/courses?page_size=50')
      ]);
      setData(dashRes.data?.data);
      setCoursesList(coursesRes.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch trainee data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTraineeList = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        is_trainee: 'true',
        page: String(page),
        page_size: String(pageSize),
      });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedCourseFilter !== 'ALL') params.set('course_id', selectedCourseFilter);
      const traineesRes = await api.get(`/personnel?${params.toString()}`);
      setTraineeList(traineesRes.data?.data || []);
      setTotalRecords(traineesRes.data?.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch trainee list', error);
    }
  }, [page, searchQuery, selectedCourseFilter]);

  useEffect(() => {
    fetchTraineeList();
  }, [fetchTraineeList]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCourseFilter]);

  useEffect(() => {
    if (!showMarkModal) return;
    api.get('/personnel?is_trainee=true&page_size=1000')
      .then((res) => setPickerList(res.data?.data || []))
      .catch(() => setPickerList([]));
  }, [showMarkModal]);

  useEffect(() => {
    if (!showAddModal) return;
    let cancelled = false;
    fetchNextDevicePin(true)
      .then((pin) => {
        if (!cancelled && pin) {
          setNewTrainee((prev) => ({ ...prev, biometric_user_id: pin }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [showAddModal]);

  const handleAddTrainee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/personnel', {
        full_name: newTrainee.full_name,
        biometric_user_id: digitsOnlyPin(newTrainee.biometric_user_id) || undefined,
        employee_code: newTrainee.employee_code || null,
        gender: newTrainee.gender,
        course_id: newTrainee.course_id ? parseInt(newTrainee.course_id, 10) : null,
        phone: newTrainee.phone || null,
        cnic: newTrainee.cnic || null,
        is_trainee: true,
        category: 'Trainee',
        employment_status: 'Active',
      });
      setShowAddModal(false);
      setNewTrainee({
        full_name: '',
        biometric_user_id: '',
        employee_code: '',
        gender: 'Male',
        course_id: '',
        phone: '',
        cnic: '',
      });
      setActionNotice('Trainee created and written to TR terminals.');
      setTimeout(() => setActionNotice(null), 4000);
      fetchData();
      fetchTraineeList();
    } catch (err: any) {
      console.error('Error adding trainee:', err);
      alert(err.response?.data?.detail || 'Failed to create trainee.');
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/attendance/exceptions', {
        personnel_id: parseInt(markAttendance.personnel_id, 10),
        exception_type: markAttendance.exception_type,
        start_date: markAttendance.start_date,
        end_date: markAttendance.end_date,
        reason: markAttendance.reason || null,
      });
      setShowMarkModal(false);
      setActionNotice(`Attendance status updated to ${markAttendance.exception_type} in database.`);
      setTimeout(() => setActionNotice(null), 4000);
      fetchData();
      fetchTraineeList();
    } catch (err: any) {
      console.error('Error marking attendance exception:', err);
      alert(err.response?.data?.detail || 'Failed to update attendance.');
    }
  };

  const handleTransferCourse = async (courseId: number) => {
    if (!selectedTrainee) return;
    try {
      await api.put(`/personnel/${selectedTrainee.id}`, {
        course_id: courseId
      });
      setActionNotice(`Course updated successfully for ${selectedTrainee.full_name}.`);
      setTimeout(() => setActionNotice(null), 4000);
      setSelectedTrainee(null);
      fetchData();
      fetchTraineeList();
    } catch (err: any) {
      console.error('Failed to transfer course:', err);
      alert(err.response?.data?.detail || 'Failed to transfer course.');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedTrainee) return;
    const newStatus = selectedTrainee.employment_status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/personnel/${selectedTrainee.id}`, {
        employment_status: newStatus
      });
      setActionNotice(`Trainee status updated to ${newStatus}.`);
      setTimeout(() => setActionNotice(null), 4000);
      setSelectedTrainee(null);
      fetchData();
      fetchTraineeList();
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      alert(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const handleDeleteTrainee = async () => {
    if (!selectedTrainee) return;
    if (!window.confirm(`Are you sure you want to permanently delete trainee "${selectedTrainee.full_name}"?`)) return;
    try {
      await api.delete(`/personnel/${selectedTrainee.id}`);
      setActionNotice(`Trainee deleted from database.`);
      setTimeout(() => setActionNotice(null), 4000);
      setSelectedTrainee(null);
      fetchData();
      fetchTraineeList();
    } catch (err: any) {
      console.error('Failed to delete trainee:', err);
      alert(err.response?.data?.detail || 'Failed to delete trainee.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  const { kpi, courses } = data;
  const COLORS = ['#475569', '#E2E8F0'];

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

  // Calculations for summary table
  const totalEnrolled = courses.reduce((acc, c) => acc + c.strength, 0);
  const totalPresent = courses.reduce((acc, c) => acc + c.present, 0);
  const totalAbsent = courses.reduce((acc, c) => acc + c.absent, 0);
  const totalLeave = courses.reduce((acc, c) => acc + c.leave, 0);
  const totalWeekend = courses.reduce((acc, c) => acc + c.weekend, 0);
  const totalOSD = courses.reduce((acc, c) => acc + c.osd, 0);
  const totalMedical = courses.reduce((acc, c) => acc + c.medical, 0);
  const totalEvidence = courses.reduce((acc, c) => acc + c.evidence, 0);
  const totalRepat = courses.reduce((acc, c) => acc + c.repatriation, 0);
  const totalMale = courses.reduce((acc, c) => acc + (c.male || 0), 0);
  const totalFemale = courses.reduce((acc, c) => acc + (c.female || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-fit mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span className="font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit'})}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Trainee Dashboard</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Course enrolment & attendance · Live database records</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/live-screen')}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors hidden md:flex"
          >
            <Monitor className="w-4 h-4" /> Live Screen
          </button>
          <button 
            onClick={() => setShowMarkModal(true)}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <UserCheck className="w-4 h-4 text-primary" /> Mark attendance
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add trainee
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)}>✕</button>
        </div>
      )}

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        <KPICard 
          title="ENROLLED" 
          value={kpi.total_strength} 
          icon={Users} 
          colorClass="text-indigo-600" 
          bgClass="bg-indigo-50" 
          borderClass="bg-indigo-600" 
          onClick={() => openStatusModal('All Enrolled Trainees', 'ALL')}
        />
        <KPICard 
          title="PRESENT" 
          value={kpi.present} 
          subtitle={`${kpi.attendance_percent}% present`} 
          icon={UserCheck} 
          colorClass="text-emerald-500" 
          bgClass="bg-emerald-50" 
          borderClass="bg-emerald-500" 
          onClick={() => openStatusModal('Present Trainees', 'PRESENT,LATE')}
        />
        <KPICard 
          title="ABSENT" 
          value={kpi.absent} 
          icon={UserX} 
          colorClass="text-rose-500" 
          bgClass="bg-rose-50" 
          borderClass="bg-rose-500" 
          onClick={() => openStatusModal('Absent Trainees', 'ABSENT')}
        />
        <KPICard 
          title="LEAVE" 
          value={kpi.leave} 
          icon={Briefcase} 
          colorClass="text-sky-500" 
          bgClass="bg-sky-50" 
          borderClass="bg-sky-500" 
          onClick={() => openStatusModal('Trainees on Leave', 'LEAVE')}
        />
        <KPICard 
          title="WEEKEND" 
          value={kpi.weekend} 
          icon={CalendarDays} 
          colorClass="text-slate-600" 
          bgClass="bg-slate-100" 
          borderClass="bg-slate-400" 
          onClick={() => openStatusModal('Weekend Trainees', 'WEEKEND')}
        />
        <KPICard 
          title="OSD" 
          value={kpi.osd} 
          icon={Activity} 
          colorClass="text-indigo-500" 
          bgClass="bg-indigo-50" 
          borderClass="bg-indigo-500" 
          onClick={() => openStatusModal('OSD Trainees', 'OSD')}
        />
        <KPICard 
          title="MEDICAL" 
          value={kpi.medical} 
          icon={FileWarning} 
          colorClass="text-amber-500" 
          bgClass="bg-amber-50" 
          borderClass="bg-amber-500" 
          onClick={() => openStatusModal('Medical Trainees', 'MEDICAL')}
        />
        <KPICard 
          title="EVIDENCE" 
          value={kpi.evidence} 
          icon={FileWarning} 
          colorClass="text-blue-500" 
          bgClass="bg-blue-50" 
          borderClass="bg-blue-500" 
          onClick={() => openStatusModal('Evidence Trainees', 'EVIDENCE')}
        />
        <KPICard 
          title="REPATRIATION" 
          value={kpi.repatriation} 
          icon={ArrowRightLeft} 
          colorClass="text-pink-500" 
          bgClass="bg-pink-50" 
          borderClass="bg-pink-500" 
          onClick={() => openStatusModal('Repatriated Trainees', 'REPATRIATION')}
        />
      </div>

      {/* Course-Wise Strength */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-800">Course-Wise Strength</h3>
          <p className="text-[11px] text-slate-400 font-medium">Present strength by course · tap for full stats</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {courses.map((course, idx) => (
            <div 
              key={idx} 
              onClick={() => { setSelectedCourseFilter(String(course.course_id)); setPage(1); }}
              className="flex flex-col gap-1 cursor-pointer group p-3 rounded-2xl hover:bg-slate-50 transition-colors"
            >
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
                        {pieData.map((_entry, index) => (
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
                  <td className="px-4 py-4 text-center text-slate-500">{course.male ?? 0}</td>
                  <td className="px-4 py-4 text-center text-slate-500">{course.female ?? 0}</td>
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
                <td className="px-4 py-4 text-center">{totalMale}</td>
                <td className="px-4 py-4 text-center">{totalFemale}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Trainees List */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-50 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Trainees</h3>
            <p className="text-[11px] text-slate-400 font-medium">{totalRecords} individual records</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search name, PIN, roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              aria-label="Filter trainees by course"
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-600 focus:outline-none"
            >
              <option value="ALL">All Courses</option>
              {coursesList.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <button 
              onClick={() => navigate('/directory?tab=Trainees')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center whitespace-nowrap"
            >
              Full directory <ChevronRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
        
        <div className="space-y-1">
          {traineeList.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No trainees match search criteria.</div>}
          {traineeList.map((trainee) => (
            <div 
              key={trainee.id} 
              onClick={() => setSelectedTrainee(trainee)}
              className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(trainee.id)}`}>
                  {trainee.full_name ? trainee.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'NA'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">{trainee.full_name}</h4>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <span>PIN: {trainee.biometric_user_id}</span>
                    {trainee.course_name && <span>· {trainee.course_name}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trainee.employment_status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {trainee.employment_status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={async () => {
                    const newStatus = trainee.employment_status === 'Active' ? 'Inactive' : 'Active';
                    if (!window.confirm(`${newStatus === 'Inactive' ? 'Deactivate' : 'Activate'} "${trainee.full_name}"?`)) return;
                    try {
                      await api.put(`/personnel/${trainee.id}`, { employment_status: newStatus });
                      setActionNotice(`Trainee status updated to ${newStatus}.`);
                      setTimeout(() => setActionNotice(null), 4000);
                      fetchData();
                      fetchTraineeList();
                    } catch (err: any) {
                      alert(err.response?.data?.detail || 'Failed to update status.');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${trainee.employment_status === 'Active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  {trainee.employment_status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Permanently delete trainee "${trainee.full_name}"?`)) return;
                    try {
                      await api.delete(`/personnel/${trainee.id}`);
                      setActionNotice('Trainee deleted from database.');
                      setTimeout(() => setActionNotice(null), 4000);
                      fetchData();
                      fetchTraineeList();
                    } catch (err: any) {
                      alert(err.response?.data?.detail || 'Failed to delete trainee.');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-rose-600 hover:bg-rose-50 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <PaginationBar page={page} pageSize={pageSize} total={totalRecords} onPageChange={setPage} />
      </div>

      {/* Add Trainee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-800">Enroll New Trainee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTrainee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={newTrainee.full_name}
                  onChange={(e) => setNewTrainee({...newTrainee, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Device PIN (assigned)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="Assigned automatically"
                    value={newTrainee.biometric_user_id}
                    onChange={(e) => setNewTrainee({...newTrainee, biometric_user_id: digitsOnlyPin(e.target.value)})}
                    className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Roll / Service No</label>
                  <input 
                    type="text" 
                    placeholder="e.g. TR-2026-042"
                    value={newTrainee.employee_code}
                    onChange={(e) => setNewTrainee({...newTrainee, employee_code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Course Assignment *</label>
                  <select
                    required
                    value={newTrainee.course_id}
                    onChange={(e) => setNewTrainee({...newTrainee, course_id: e.target.value})}
                    aria-label="Course Assignment"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="">Select Course</option>
                    {coursesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Gender</label>
                  <select
                    value={newTrainee.gender}
                    onChange={(e) => setNewTrainee({...newTrainee, gender: e.target.value})}
                    aria-label="Gender"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone</label>
                  <input 
                    type="text" 
                    placeholder="0300-1234567"
                    value={newTrainee.phone}
                    onChange={(e) => setNewTrainee({...newTrainee, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">CNIC</label>
                  <input 
                    type="text" 
                    placeholder="37405-..."
                    value={newTrainee.cnic}
                    onChange={(e) => setNewTrainee({...newTrainee, cnic: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md"
                >
                  Save Trainee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Attendance Exception Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Mark Attendance / Exception</h3>
                <p className="text-xs text-slate-400 mt-0.5">Search a trainee, then set leave dates</p>
              </div>
              <button onClick={() => setShowMarkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Select Trainee *</label>
                <SearchablePersonSelect
                  personnel={pickerList}
                  value={markAttendance.personnel_id}
                  onChange={(id) => setMarkAttendance({ ...markAttendance, personnel_id: id })}
                  placeholder="Search name, PIN or roll number"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Status Exception *</label>
                <select
                  value={markAttendance.exception_type}
                  onChange={(e) => setMarkAttendance({...markAttendance, exception_type: e.target.value})}
                  aria-label="Status Exception"
                  className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                >
                  <option value="LEAVE">Leave</option>
                  <option value="OSD">OSD (On Special Duty)</option>
                  <option value="MEDICAL">Medical Leave</option>
                  <option value="EVIDENCE">Court / Evidence</option>
                  <option value="DUTY_REST">Duty Rest</option>
                  <option value="REPATRIATION">Repatriation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Start Date *</label>
                  <input 
                    type="date" 
                    required
                    value={markAttendance.start_date}
                    onChange={(e) => setMarkAttendance({...markAttendance, start_date: e.target.value})}
                    className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">End Date *</label>
                  <input 
                    type="date" 
                    required
                    value={markAttendance.end_date}
                    onChange={(e) => setMarkAttendance({...markAttendance, end_date: e.target.value})}
                    className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Reason / Order Ref</label>
                <input 
                  type="text" 
                  placeholder="e.g. Sanctioned order #104/PTS"
                  value={markAttendance.reason}
                  onChange={(e) => setMarkAttendance({...markAttendance, reason: e.target.value})}
                  className="w-full h-11 px-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowMarkModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
                >
                  Update Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trainee Details & Actions Modal */}
      {selectedTrainee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{selectedTrainee.full_name}</h3>
                <p className="text-xs text-slate-400">Biometric PIN: #{selectedTrainee.biometric_user_id}</p>
              </div>
              <button onClick={() => setSelectedTrainee(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Roll / Service No:</span>
                <span className="font-semibold text-slate-700">{selectedTrainee.employee_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Course:</span>
                <span className="font-bold text-indigo-600">{selectedTrainee.course_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${selectedTrainee.employment_status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {selectedTrainee.employment_status}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Phone:</span>
                <span className="font-medium text-slate-700">{selectedTrainee.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">CNIC:</span>
                <span className="font-medium text-slate-700">{selectedTrainee.cnic || 'N/A'}</span>
              </div>

              {/* Transfer Course */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Transfer to Course</label>
                <select
                  defaultValue={selectedTrainee.course_id || ''}
                  onChange={(e) => e.target.value && handleTransferCourse(parseInt(e.target.value, 10))}
                  aria-label="Transfer to Course"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">Select course to transfer...</option>
                  {coursesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={handleDeleteTrainee}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={handleToggleStatus}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl ${selectedTrainee.employment_status === 'Active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                >
                  {selectedTrainee.employment_status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  onClick={() => setSelectedTrainee(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedTrainee && (
        <EditPersonnelModal
          person={selectedTrainee}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedTrainee(null);
            fetchData();
            fetchTraineeList();
          }}
        />
      )}

      <AttendanceStatusUsersModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
        title={statusModal.title}
        status={statusModal.status}
        courseId={statusModal.courseId}
        isTrainee={true}
      />

    </div>
  );
};

export default Trainees;
