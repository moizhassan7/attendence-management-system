import React, { useEffect, useState } from 'react';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, 
  CalendarDays, Wifi, Plus, Search, 
  ChevronDown, Fingerprint, ScanFace, Play, ChevronRight, X,
  UserCheck, Shield, Briefcase, GraduationCap
} from 'lucide-react';
import api from '../api/client';

interface MasterRank {
  id: number;
  name: string;
  code: string;
  sort_order?: number;
}

interface MasterDepartment {
  id: number;
  name: string;
  code: string;
}

interface MasterCourse {
  id: number;
  name: string;
  code?: string | null;
}

interface ConfigRanges {
  trainee_pin_min: number;
  trainee_pin_max: number;
  staff_pin_min: number;
}

interface PersonnelItem {
  id: number;
  biometric_user_id: string;
  employee_code: string | null;
  full_name: string;
  rank_name: string | null;
  department_name: string | null;
  has_fingerprint: boolean;
  has_face: boolean;
  is_trainee: boolean;
  employment_status: string;
  gender: string;
}

interface EnrollmentKPIs {
  total: number;
  enrolled: number;
  pending: number;
  unlinked: number;
}

interface DeviceOption {
  id: number;
  name: string;
  ip_address: string;
  location?: string;
  status: string;
  display_label: string;
}

const Enrollment: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Staff' | 'Trainees'>('Staff');
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<{
    staff_kpi: EnrollmentKPIs;
    trainee_kpi: EnrollmentKPIs;
    devices: DeviceOption[];
  } | null>(null);
  const [personnelList, setPersonnelList] = useState<PersonnelItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewPerson, setViewPerson] = useState<PersonnelItem | null>(null);
  const [showDeviceUsersModal, setShowDeviceUsersModal] = useState(false);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Master data from Configuration & Database
  const [masterRanks, setMasterRanks] = useState<MasterRank[]>([]);
  const [masterDepartments, setMasterDepartments] = useState<MasterDepartment[]>([]);
  const [masterCourses, setMasterCourses] = useState<MasterCourse[]>([]);
  const [civilDesignations, setCivilDesignations] = useState<string[]>([]);
  const [configRanges, setConfigRanges] = useState<ConfigRanges>({
    trainee_pin_min: 1,
    trainee_pin_max: 2000,
    staff_pin_min: 2001,
  });

  // Comprehensive new person form state
  const [formData, setFormData] = useState({
    full_name: '',
    father_name: '',
    cnic: '',
    biometric_user_id: '',
    employee_code: '',
    person_type: 'Staff' as 'Staff' | 'Trainee',
    staff_category: 'Uniform' as 'Uniform' | 'Civilian',
    rank_id: '' as string | number,
    course_id: '' as string | number,
    designation: '',
    custom_designation: '',
    department_id: '' as string | number,
    gender: 'Male',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch KPI stats and devices
  const fetchKpis = async () => {
    try {
      const res = await api.get('/dashboard/enrollment');
      if (res.data.success) {
        setKpiData(res.data.data);
        if (res.data.data.devices?.length && !selectedDevice) {
          setSelectedDevice(res.data.data.devices[0].display_label);
        }
      }
    } catch (err) {
      console.error('Failed to load enrollment KPIs', err);
    }
  };

  // Fetch Master Data (Ranks, Departments, Courses, Configuration Ranges & Designations)
  const fetchMasterData = async () => {
    try {
      const [ranksRes, deptsRes, coursesRes, settingsRes] = await Promise.all([
        api.get('/ranks?page_size=100'),
        api.get('/departments?page_size=100'),
        api.get('/courses?page_size=100'),
        api.get('/settings'),
      ]);

      if (ranksRes.data?.data) {
        const sorted = [...ranksRes.data.data].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
        setMasterRanks(sorted);
      }
      if (deptsRes.data?.data) {
        setMasterDepartments(deptsRes.data.data);
      }
      if (coursesRes.data?.data) {
        setMasterCourses(coursesRes.data.data);
      }
      if (settingsRes.data?.data) {
        if (settingsRes.data.data.ranges) setConfigRanges(settingsRes.data.data.ranges);
        if (settingsRes.data.data.designations) setCivilDesignations(settingsRes.data.data.designations);
      }
    } catch (err) {
      console.error('Failed to load master configuration data', err);
    }
  };

  // Helper to open Add Person modal initialized properly
  const openAddPersonModal = (prefillPin?: string) => {
    const isTrainee = activeTab === 'Trainees';
    const defaultRank = masterRanks.length > 0 ? masterRanks[0].id : '';
    const defaultDept = masterDepartments.length > 0 ? masterDepartments[0].id : '';
    const defaultDesignation = civilDesignations.length > 0 ? civilDesignations[0] : 'Senior Clerk';
    const defaultCourse = masterCourses.length > 0 ? masterCourses[0].id : '';

    setFormData({
      full_name: '',
      father_name: '',
      cnic: '',
      biometric_user_id: prefillPin || '',
      employee_code: '',
      person_type: isTrainee ? 'Trainee' : 'Staff',
      staff_category: 'Uniform',
      rank_id: defaultRank,
      course_id: defaultCourse,
      designation: defaultDesignation,
      custom_designation: '',
      department_id: defaultDept,
      gender: 'Male',
    });
    setIsAddModalOpen(true);
  };

  // Fetch personnel list for active tab
  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const isTrainee = activeTab === 'Trainees';
      let url = `/personnel?is_trainee=${isTrainee}&page_size=100`;
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      const res = await api.get(url);
      setPersonnelList(res.data.data || []);
    } catch (err) {
      console.error('Failed to load personnel list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchPersonnel();
  }, [activeTab, searchTerm]);

  // Handle enrollment button click (Finger or Face)
  const handleEnrollBiometric = async (personId: number, type: 'finger' | 'face', name: string) => {
    setEnrollingId(personId);
    try {
      const res = await api.post(`/personnel/${personId}/enroll-biometric?biometric_type=${type}`);
      if (res.data.success) {
        showToast(`Prompt sent: ${type === 'finger' ? 'Fingerprint' : 'Face'} enrolled for ${name} on ${selectedDevice || 'Terminal'}`);
        await fetchPersonnel();
        await fetchKpis();
      }
    } catch (err) {
      console.error('Failed to trigger enrollment', err);
      showToast(`Error enrolling ${type} for ${name}`);
    } finally {
      setEnrollingId(null);
    }
  };

  // Handle Add Person form submission
  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isTrainee = formData.person_type === 'Trainee';
      const isUniform = formData.person_type === 'Staff' && formData.staff_category === 'Uniform';
      const isCivilian = formData.person_type === 'Staff' && formData.staff_category === 'Civilian';

      const finalDesignation = isCivilian
        ? (formData.designation === '__CUSTOM__' ? formData.custom_designation.trim() : formData.designation)
        : (isTrainee ? 'Recruit / Trainee' : null);

      const payload = {
        full_name: formData.full_name.trim(),
        father_name: formData.father_name.trim() || null,
        cnic: formData.cnic.trim() || null,
        biometric_user_id: formData.biometric_user_id.trim(),
        employee_code: formData.employee_code.trim() || null,
        is_trainee: isTrainee,
        course_id: isTrainee && formData.course_id ? Number(formData.course_id) : null,
        category: isTrainee ? 'Trainee' : (isCivilian ? 'Civilian' : 'Uniform'),
        rank_id: (isUniform || isTrainee) && formData.rank_id ? Number(formData.rank_id) : null,
        designation: finalDesignation || null,
        department_id: formData.department_id ? Number(formData.department_id) : null,
        gender: formData.gender,
        employment_status: 'Active',
      };

      const res = await api.post('/personnel', payload);
      if (res.data.success) {
        showToast(`Person ${formData.full_name} added with Device PIN ${formData.biometric_user_id}`);
        setIsAddModalOpen(false);
        await fetchPersonnel();
        await fetchKpis();
      }
    } catch (err: any) {
      console.error('Failed to add person', err);
      showToast(err.response?.data?.detail || 'Failed to add person');
    }
  };

  const currentKPIs = activeTab === 'Staff' 
    ? (kpiData?.staff_kpi || { total: 209, enrolled: 207, pending: 2, unlinked: 9 })
    : (kpiData?.trainee_kpi || { total: 857, enrolled: 855, pending: 2, unlinked: 3 });

  // Initials generator
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Color mapper for avatar based on name string
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-cyan-100 text-cyan-700',
      'bg-purple-100 text-purple-700',
      'bg-amber-100 text-amber-700',
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-rose-100 text-rose-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] min-h-screen">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit mb-3 shadow-sm">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="text-slate-400 font-normal">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Enrollment & People</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Register people, assign device PINs, and track biometric enrolment</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDeviceUsersModal(true)}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Wifi className="w-3.5 h-3.5 text-indigo-500" />
            Device users
          </button>
          
          <button 
            onClick={() => openAddPersonModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add person
          </button>
        </div>
      </div>

      {/* "How enrolment works" Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">How enrolment works</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Add people here → pushed to all terminals → fingerprint enrols remotely, face is enrolled at the terminal
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
          {/* Step 1 */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 text-blue-600 font-black text-xs flex items-center justify-center">
              1
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
              Add the person here with their device PIN (the User ID that tags every punch) — "Add person".
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 text-blue-600 font-black text-xs flex items-center justify-center">
              2
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
              The dashboard pushes them to every connected terminal automatically — no need to add them on each device.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 text-blue-600 font-black text-xs flex items-center justify-center">
              3
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
              Fingerprint: click "Finger" → the device opens its scan prompt; the person scans → the FP icon turns on and the print syncs to all terminals (enrol once, punch on any device).
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 text-blue-600 font-black text-xs flex items-center justify-center">
              4
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
              Face: remote face capture isn't supported on these units — take the person to a terminal and enrol their face there (Menu → User → this PIN → Face). The Face icon activates automatically.
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 text-blue-600 font-black text-xs flex items-center justify-center">
              5
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
              Done — finger or face punches from any terminal are recorded on the dashboard against this person.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL STAFF */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              TOTAL {activeTab.toUpperCase()}
            </div>
            <div className="text-3xl font-black text-indigo-900 tracking-tight">
              {currentKPIs.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* STAFF ENROLLED */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {activeTab.toUpperCase()} ENROLLED
            </div>
            <div className="text-3xl font-black text-emerald-600 tracking-tight">
              {currentKPIs.enrolled}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* STAFF PENDING */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {activeTab.toUpperCase()} PENDING
            </div>
            <div className="text-3xl font-black text-cyan-600 tracking-tight">
              {currentKPIs.pending}
            </div>
            <div className="text-[10px] font-medium text-slate-400">no biometric yet</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* UNLINKED DEVICE USERS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              UNLINKED DEVICE USERS
            </div>
            <div className="text-3xl font-black text-rose-500 tracking-tight">
              {currentKPIs.unlinked}
            </div>
            <div className="text-[10px] font-medium text-slate-400">on device, no profile</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* People Table Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        
        {/* Table Header: People & Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">People</h2>
            <p className="text-xs font-semibold text-slate-400">{personnelList.length} {activeTab.toLowerCase()}</p>
          </div>

          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setActiveTab('Staff')}
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'Staff' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => setActiveTab('Trainees')}
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'Trainees' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Trainees
            </button>
          </div>
        </div>

        {/* Search Bar & Device Selector */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name or PIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-indigo-500" /> Enrol on
            </span>
            <div className="relative">
              <select 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
              >
                {kpiData?.devices?.map((dev) => (
                  <option key={dev.id} value={dev.display_label}>
                    {dev.display_label}
                  </option>
                )) || (
                  <option value="MB460 (TTQ5254800795)-Device-A">
                    MB460 (TTQ5254800795)-Device-A
                  </option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">NAME</th>
                <th className="pb-3 px-3">RANK</th>
                <th className="pb-3 px-3">DEVICE PIN</th>
                <th className="pb-3 px-3">ENROLLED</th>
                <th className="pb-3 px-3">BIOMETRICS</th>
                <th className="pb-3 px-3">ENROL ON DEVICE</th>
                <th className="pb-3 px-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <div className="mt-2 text-xs font-semibold">Loading enrollment records...</div>
                  </td>
                </tr>
              ) : personnelList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                    No {activeTab.toLowerCase()} found matching your search.
                  </td>
                </tr>
              ) : (
                personnelList.map((person) => {
                  const isEnrolled = person.has_fingerprint || person.has_face;
                  return (
                    <tr key={person.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name with Initials Avatar */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${getAvatarColor(person.full_name)}`}>
                            {getInitials(person.full_name)}
                          </div>
                          <span className="font-bold text-slate-800 uppercase tracking-tight text-xs">
                            {person.full_name}
                          </span>
                        </div>
                      </td>

                      {/* Rank */}
                      <td className="py-3.5 px-3 text-slate-500 font-medium text-xs">
                        {person.rank_name || (person.is_trainee ? 'Trainee' : 'Staff')}
                      </td>

                      {/* Device PIN */}
                      <td className="py-3.5 px-3 font-semibold text-slate-600 text-xs">
                        {person.biometric_user_id || '—'}
                      </td>

                      {/* Enrolled Status Badge */}
                      <td className="py-3.5 px-3">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Biometrics Icons (Fingerprint & Face) */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          {/* Fingerprint indicator */}
                          <div 
                            title={person.has_fingerprint ? "Fingerprint enrolled" : "Fingerprint not enrolled"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                              person.has_fingerprint 
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            <Fingerprint className="w-3.5 h-3.5" />
                          </div>

                          {/* Face scan indicator */}
                          <div 
                            title={person.has_face ? "Face biometric enrolled" : "Face not enrolled"}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                              person.has_face 
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            <ScanFace className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </td>

                      {/* Enrol on Device Buttons */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={enrollingId === person.id}
                            onClick={() => handleEnrollBiometric(person.id, 'finger', person.full_name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-[11px] font-bold text-slate-600 transition-colors bg-white shadow-2xs hover:bg-indigo-50/40"
                          >
                            <Play className="w-2.5 h-2.5 fill-current text-slate-400 group-hover:text-indigo-500" />
                            Finger
                          </button>

                          <button
                            disabled={enrollingId === person.id}
                            onClick={() => handleEnrollBiometric(person.id, 'face', person.full_name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-[11px] font-bold text-slate-600 transition-colors bg-white shadow-2xs hover:bg-indigo-50/40"
                          >
                            <Play className="w-2.5 h-2.5 fill-current text-slate-400 group-hover:text-indigo-500" />
                            Face
                          </button>
                        </div>
                      </td>

                      {/* Action: View > */}
                      <td className="py-3.5 px-3 text-right">
                        <button 
                          onClick={() => setViewPerson(person)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs inline-flex items-center gap-0.5 transition-colors"
                        >
                          View <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Person Modal */}
      {isAddModalOpen && (() => {
        const pinNum = parseInt(formData.biometric_user_id, 10);
        const isPinExceedsTrainee = formData.person_type === 'Trainee' && !isNaN(pinNum) && pinNum > configRanges.trainee_pin_max;
        const isPinBelowStaff = formData.person_type === 'Staff' && !isNaN(pinNum) && pinNum > 0 && pinNum < configRanges.staff_pin_min;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add Person</h3>
                    <p className="text-xs text-slate-400">Register profile, assign rank/category, and link device PIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleAddPerson} className="overflow-y-auto pr-1 py-4 space-y-4 text-xs">
                
                {/* 1. Cadre / Target Type Toggle (Staff vs Trainee) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Person Type / Cadre *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const defaultRank = masterRanks.length > 0 ? masterRanks[0].id : '';
                        setFormData(prev => ({
                          ...prev,
                          person_type: 'Staff',
                          staff_category: 'Uniform',
                          rank_id: defaultRank,
                          designation: civilDesignations.length > 0 ? civilDesignations[0] : 'Senior Clerk',
                        }));
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        formData.person_type === 'Staff'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        formData.person_type === 'Staff' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`font-bold text-xs ${formData.person_type === 'Staff' ? 'text-indigo-900' : 'text-slate-800'}`}>
                          Staff Member
                        </div>
                        <div className="text-[10px] text-slate-400">Officers, Police & Civilians</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const traineeRank = masterRanks.find(r => r.code === 'RT') || masterRanks[0];
                        setFormData(prev => ({
                          ...prev,
                          person_type: 'Trainee',
                          staff_category: 'Uniform',
                          rank_id: traineeRank ? traineeRank.id : '',
                          designation: 'Recruit / Trainee',
                        }));
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        formData.person_type === 'Trainee'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        formData.person_type === 'Trainee' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`font-bold text-xs ${formData.person_type === 'Trainee' ? 'text-indigo-900' : 'text-slate-800'}`}>
                          Course Trainee
                        </div>
                        <div className="text-[10px] text-slate-400">Recruits & Probationers</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Configured PIN Routing Policy Banner */}
                <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-[11px] font-medium ${
                  formData.person_type === 'Staff'
                    ? 'bg-blue-50/70 border-blue-200 text-blue-800'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                }`}>
                  <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                    {formData.person_type === 'Staff' ? <Shield className="w-3 h-3 text-blue-600" /> : <GraduationCap className="w-3 h-3 text-emerald-600" />}
                  </div>
                  <span>
                    {formData.person_type === 'Staff'
                      ? <><strong>Staff PIN Policy:</strong> Device PIN should be <strong>≥ {configRanges.staff_pin_min}</strong> (Range 1 – {configRanges.trainee_pin_max} is reserved for Trainees)</>
                      : <><strong>Trainee PIN Policy:</strong> Device PIN should be between <strong>1 and {configRanges.trainee_pin_max}</strong> (Configured in System Settings)</>
                    }
                  </span>
                </div>

                {/* 3. Rank / Designation (From Configuration) */}
                {formData.person_type === 'Staff' ? (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Staff Classification *
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, staff_category: 'Uniform' }))}
                          className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                            formData.staff_category === 'Uniform'
                              ? 'bg-white text-indigo-700 border-indigo-200 shadow-2xs ring-1 ring-indigo-500/20'
                              : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200/50'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Uniformed Police Rank
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, staff_category: 'Civilian' }))}
                          className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                            formData.staff_category === 'Civilian'
                              ? 'bg-white text-indigo-700 border-indigo-200 shadow-2xs ring-1 ring-indigo-500/20'
                              : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200/50'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          Civilian Designation
                        </button>
                      </div>
                    </div>

                    {formData.staff_category === 'Uniform' ? (
                      <div>
                        <label className="block font-bold text-slate-600 mb-1">
                          Uniform Police Rank (from Configuration) *
                        </label>
                        <div className="relative">
                          <select
                            required
                            value={formData.rank_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, rank_id: e.target.value }))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white cursor-pointer appearance-none pr-8"
                          >
                            <option value="" disabled>-- Select Police Rank --</option>
                            {masterRanks.map((rk) => (
                              <option key={rk.id} value={rk.id}>
                                {rk.name} {rk.code ? `(${rk.code})` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block font-bold text-slate-600 mb-1">
                          Civilian Designation (from Configuration) *
                        </label>
                        <div className="relative">
                          <select
                            value={formData.designation}
                            onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white cursor-pointer appearance-none pr-8"
                          >
                            {civilDesignations.map((desig) => (
                              <option key={desig} value={desig}>
                                {desig}
                              </option>
                            ))}
                            <option value="__CUSTOM__">+ Other / Custom Designation...</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {formData.designation === '__CUSTOM__' && (
                          <input
                            type="text"
                            required
                            placeholder="Type custom civilian designation..."
                            value={formData.custom_designation}
                            onChange={(e) => setFormData(prev => ({ ...prev, custom_designation: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Assigned Training Course Batch *
                      </label>
                      <div className="relative">
                        <select
                          required
                          value={formData.course_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, course_id: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white cursor-pointer appearance-none pr-8"
                        >
                          <option value="" disabled>-- Select Training Course Batch --</option>
                          {masterCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.code ? `(${c.code})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">
                        Trainee Cadre / Rank
                      </label>
                      <div className="relative">
                        <select
                          value={formData.rank_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, rank_id: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white cursor-pointer appearance-none pr-8"
                        >
                          {masterRanks
                            .filter(rk => ['RT', 'CONST', 'HC', 'STF'].includes(rk.code) || rk.name.toLowerCase().includes('trainee') || rk.name.toLowerCase().includes('recruit') || rk.name.toLowerCase().includes('constable'))
                            .map((rk) => (
                              <option key={rk.id} value={rk.id}>
                                {rk.name} ({rk.code})
                              </option>
                            ))}
                          {masterRanks.map(rk => (
                            <option key={`all-${rk.id}`} value={rk.id}>
                              {rk.name} ({rk.code})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Branch / Wing / Department */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    Branch / Wing / Department *
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={formData.department_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white cursor-pointer appearance-none pr-8"
                    >
                      <option value="" disabled>-- Select Branch / Department --</option>
                      {masterDepartments.map((dp) => (
                        <option key={dp.id} value={dp.id}>
                          {dp.name} ({dp.code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* 5. Full Name & Father Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. MUHAMMAD AHMAD"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Father's Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ABDUL RASHID"
                      value={formData.father_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, father_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* 6. Device PIN (User ID) & Belt / Roll Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Device PIN (User ID) *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder={formData.person_type === 'Staff' ? `e.g. ${configRanges.staff_pin_min}` : "e.g. 101"}
                      value={formData.biometric_user_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, biometric_user_id: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 rounded-xl border outline-none font-bold text-slate-800 ${
                        isPinExceedsTrainee || isPinBelowStaff
                          ? 'border-amber-400 bg-amber-50/40 focus:ring-2 focus:ring-amber-400'
                          : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    {isPinExceedsTrainee && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">
                        ⚠️ PIN exceeds Trainee limit ({configRanges.trainee_pin_max}). Staff starts at {configRanges.staff_pin_min}.
                      </p>
                    )}
                    {isPinBelowStaff && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">
                        ⚠️ PIN is below Staff limit ({configRanges.staff_pin_min}+). Trainees are 1–{configRanges.trainee_pin_max}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      {formData.person_type === 'Staff' ? 'Belt / Employee Code' : 'Chest / Roll Number'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={formData.person_type === 'Staff' ? "e.g. 102/C" : "e.g. TC-404"}
                      value={formData.employee_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_code: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* 7. CNIC & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">CNIC Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 37405-1234567-1"
                      value={formData.cnic}
                      onChange={(e) => setFormData(prev => ({ ...prev, cnic: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Gender</label>
                    <select 
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                  >
                    Save Person
                  </button>
                </div>
              </form>

            </div>
          </div>
        );
      })()}

      {/* View Person Modal */}
      {viewPerson && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColor(viewPerson.full_name)}`}>
                  {getInitials(viewPerson.full_name)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">{viewPerson.full_name}</h3>
                  <p className="text-xs text-slate-400">{viewPerson.rank_name || 'Staff'}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewPerson(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Device PIN</span>
                <span className="font-bold text-slate-700">{viewPerson.biometric_user_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Employee Code</span>
                <span className="font-bold text-slate-700">{viewPerson.employee_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Department / Branch</span>
                <span className="font-bold text-slate-700">{viewPerson.department_name || 'Administration'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Fingerprint Enrolled</span>
                <span className={`font-bold ${viewPerson.has_fingerprint ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {viewPerson.has_fingerprint ? 'Yes (Active)' : 'Not enrolled'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Face Enrolled</span>
                <span className={`font-bold ${viewPerson.has_face ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {viewPerson.has_face ? 'Yes (Active)' : 'Not enrolled'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400 font-medium">Active Terminal</span>
                <span className="font-bold text-indigo-600">{selectedDevice || 'Main Gate'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => handleEnrollBiometric(viewPerson.id, 'finger', viewPerson.full_name)}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-50 flex items-center gap-1.5"
              >
                <Fingerprint className="w-3.5 h-3.5" /> Enrol Finger
              </button>
              <button
                onClick={() => setViewPerson(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Users Modal */}
      {showDeviceUsersModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Unlinked Device Users</h3>
                  <p className="text-xs text-slate-400">Punches logged on terminals without matched profiles</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDeviceUsersModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[
                { pin: "1092", device: "MB460-A", lastPunch: "Today 08:14 AM" },
                { pin: "1093", device: "MB460-A", lastPunch: "Today 08:32 AM" },
                { pin: "1104", device: "Gate-02", lastPunch: "Yesterday 09:00 PM" },
                { pin: "1105", device: "Gate-02", lastPunch: "Yesterday 09:05 PM" },
                { pin: "1118", device: "Admin-ZKT", lastPunch: "10 Sep 08:00 AM" },
              ].map((u) => (
                <div key={u.pin} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">Device PIN #{u.pin}</div>
                    <div className="text-[11px] text-slate-400">Terminal: {u.device} • Last: {u.lastPunch}</div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowDeviceUsersModal(false);
                      openAddPersonModal(u.pin);
                    }}
                    className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 text-xs"
                  >
                    Link Profile
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowDeviceUsersModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Enrollment;
