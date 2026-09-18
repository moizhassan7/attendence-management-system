import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Fingerprint, Wifi, WifiOff, ArrowLeft, 
  CheckCircle2, Clock, Users, ShieldCheck, RefreshCw,
  Maximize2, Minimize2, Volume2, VolumeX, Search,
  Activity, HardDrive,
  GraduationCap, Building2, UserCheck, ArrowUpRight, ArrowDownRight,
  Sun, Moon
} from 'lucide-react';
import api from '../api/client';
import { dashboardWebSocketUrl } from '../api/ws';
import { useBranding } from '../context/BrandingContext';
import { useTheme } from '../context/ThemeContext';

interface PunchFeedItem {
  id: number;
  device_id: number;
  biometric_user_id: string;
  punch_time: string;
  punch_type: string | null;
  verified: number | null;
  source: string;
  created_at: string;
  personnel_name: string | null;
  rank_name: string | null;
  department_name: string | null;
  employee_code: string | null;
  device_name: string | null;
}

interface DeviceItem {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  enabled: boolean;
  location?: string;
  connection_status: string;
  last_seen_at?: string;
  last_sync_at?: string;
}

interface LiveStats {
  staff_present: number;
  staff_total: number;
  trainees_present: number;
  trainees_total: number;
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  enabled: number;
  last_sync_at?: string;
  last_sync_status?: string;
}

const LiveScreen: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [logoFailed, setLogoFailed] = useState(false);
  const [punches, setPunches] = useState<PunchFeedItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [stats, setStats] = useState<LiveStats>({
    staff_present: 0,
    staff_total: 0,
    trainees_present: 0,
    trainees_total: 0,
  });
  const [time, setTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { isDark: isDarkMode, toggleTheme } = useTheme();
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [newlyAddedPunchId, setNewlyAddedPunchId] = useState<number | null>(null);
  
  const lastPunchIdRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Subtle natural verification tone
  const playChime = useCallback((isCheckIn: boolean = true) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (isCheckIn) {
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
      } else {
        osc.frequency.setValueAtTime(554.37, now); // C#5
        osc.frequency.setValueAtTime(440, now + 0.08); // A4
      }

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio context restricted
    }
  }, [soundEnabled]);

  useEffect(() => {
    setLogoFailed(false);
  }, [branding.logo_url]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Track Fullscreen State
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const fetchLiveData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [punchesRes, devicesRes, statsRes, traineesRes, devStatsRes] = await Promise.all([
        api.get('/attendance/recent-punches?limit=30'),
        api.get('/devices?page_size=20'),
        api.get('/dashboard/stats'),
        api.get('/dashboard/trainees'),
        api.get('/devices/stats').catch(() => ({ data: { data: null } })),
      ]);

      const fetchedPunches: PunchFeedItem[] = punchesRes.data?.data || [];
      setPunches(fetchedPunches);
      setDevices(devicesRes.data?.data || []);
      if (devStatsRes.data?.data) {
        setDeviceStats(devStatsRes.data.data);
      }

      // Incoming new punch detection
      if (fetchedPunches.length > 0) {
        const topPunch = fetchedPunches[0];
        if (lastPunchIdRef.current !== null && topPunch.id !== lastPunchIdRef.current) {
          const isCheckIn = topPunch.punch_type === 'IN' || topPunch.punch_type === 'CHECK_IN' || topPunch.punch_type === '0';
          playChime(isCheckIn);
          setNewlyAddedPunchId(topPunch.id);
          setTimeout(() => setNewlyAddedPunchId(null), 3000);
        }
        lastPunchIdRef.current = topPunch.id;
      }

      const staffStats = statsRes.data?.data;
      const traineeStats = traineesRes.data?.data?.kpi;

      setStats({
        staff_present: staffStats?.present ?? 0,
        staff_total: staffStats?.total_strength ?? 0,
        trainees_present: traineeStats?.present ?? 0,
        trainees_total: traineeStats?.total_strength ?? 0,
      });
    } catch (err) {
      console.error('Failed to fetch live kiosk data', err);
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  }, [playChime]);

  // Keyboard Shortcuts (F: Fullscreen, M: Mute, R: Refresh, T: Theme)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setSoundEnabled((prev) => !prev);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchLiveData(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchLiveData]);

  // Initial load, polling & WebSocket
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(() => fetchLiveData(false), 7000);

    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket(dashboardWebSocketUrl());
      
      ws.onopen = () => {
        if (isMounted) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'punch.created' || msg.event === 'attendance.processed' || msg.event === 'device.sync') {
            fetchLiveData(false);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (isMounted) setWsConnected(false);
      };

      ws.onerror = () => {
        if (isMounted) setWsConnected(false);
      };
    } catch (err) {
      console.warn('Live screen WS connection skipped:', err);
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
  }, [fetchLiveData]);

  const handleManualRefresh = () => {
    fetchLiveData(true);
  };

  const isPunchIn = (punchType: string | null): boolean => {
    if (!punchType) return true;
    const pt = punchType.toUpperCase();
    return pt === 'IN' || pt === 'CHECK_IN' || pt === '0';
  };

  const filteredPunches = useMemo(() => {
    return punches.filter((p) => {
      const isCheckIn = isPunchIn(p.punch_type);
      if (filterType === 'IN' && !isCheckIn) return false;
      if (filterType === 'OUT' && isCheckIn) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (p.personnel_name || '').toLowerCase().includes(query);
        const pinMatch = (p.biometric_user_id || '').includes(query);
        const codeMatch = (p.employee_code || '').toLowerCase().includes(query);
        const deptMatch = (p.department_name || '').toLowerCase().includes(query);
        const rankMatch = (p.rank_name || '').toLowerCase().includes(query);
        return nameMatch || pinMatch || codeMatch || deptMatch || rankMatch;
      }
      return true;
    });
  }, [punches, filterType, searchQuery]);

  const latestPunch = punches[0] || null;
  const isLatestIn = latestPunch ? isPunchIn(latestPunch.punch_type) : true;

  const formatPunchTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) 
      ? timeStr 
      : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const getRelativeTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    const diffSeconds = Math.max(0, Math.floor((new Date().getTime() - d.getTime()) / 1000));
    if (diffSeconds < 10) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMins = Math.floor(diffSeconds / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const currentHour = time.getHours();
  const isDayShift = currentHour >= 8 && currentHour < 20;

  // Adaptive theme classes
  const theme = isDarkMode ? {
    pageBg: 'bg-[#12141A] text-slate-100',
    headerBg: 'bg-[#181B24]/90 border-[#262B38] text-slate-100',
    cardBg: 'bg-[#181B24] border-[#262B38] shadow-sm',
    cardInner: 'bg-[#12141A]/80 border-[#222734]',
    itemBg: 'bg-[#141721] border-[#222734] hover:border-[#32394A]',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-500',
    btnDefault: 'bg-[#1E222D] hover:bg-[#272C3A] text-slate-300 border-[#2E3545]',
    activeTab: 'bg-indigo-600 text-white',
    inactiveTab: 'text-slate-400 hover:text-white',
    inputBg: 'bg-[#12141A] border-[#262B38] text-white placeholder-slate-500 focus:border-indigo-500',
    divider: 'bg-[#262B38]',
    borderSubtle: 'border-[#262B38]',
    timeDisplay: 'text-slate-100',
    badgeShift: 'bg-slate-800 text-slate-300 border-slate-700',
  } : {
    pageBg: 'bg-[#F4F7FE] text-slate-900',
    headerBg: 'bg-white/95 border-slate-200/90 text-slate-900',
    cardBg: 'bg-white border-slate-200/90 shadow-[0_2px_12px_rgb(0,0,0,0.03)]',
    cardInner: 'bg-slate-50/70 border-slate-200/70',
    itemBg: 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/40',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    btnDefault: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm',
    activeTab: 'bg-indigo-600 text-white shadow-sm',
    inactiveTab: 'text-slate-600 hover:text-slate-900',
    inputBg: 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white',
    divider: 'bg-slate-200',
    borderSubtle: 'border-slate-200/80',
    timeDisplay: 'text-slate-900',
    badgeShift: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className={`min-h-screen lg:h-screen lg:max-h-screen ${theme.pageBg} flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white relative lg:overflow-hidden overflow-y-auto transition-colors duration-200`}>
      
      {/* Top Header Command Bar */}
      <header className={`px-6 py-3.5 border-b ${theme.headerBg} backdrop-blur-md sticky top-0 z-30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors duration-200`}>
        
        {/* Left: Exit & Brand */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer ${theme.btnDefault}`}
            title="Return to Main Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" /> 
            <span>Exit Kiosk</span>
          </button>
          
          <div className={`h-6 w-px ${theme.divider} hidden sm:block`}></div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden p-1 shadow-sm">
              {branding.logo_url && !logoFailed ? (
                <img 
                  src={branding.logo_url} 
                  alt={branding.display_name} 
                  className="w-full h-full object-contain"
                  onError={() => setLogoFailed(true)} 
                />
              ) : branding.acronym ? (
                <span className="font-bold text-sm text-indigo-700">{branding.acronym}</span>
              ) : (
                <Fingerprint className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-bold tracking-tight ${theme.textPrimary} leading-tight`}>
                  {branding.display_name || 'Organization'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Live Attendance
                </span>
              </div>
              <p className={`text-xs ${theme.textSecondary} flex items-center gap-2 mt-0.5`}>
                <span>{branding.system_name || 'Biometric Entrance Feed'}</span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5 font-medium text-[11px]">
                  {wsConnected ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live Connected
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span> Polling (7s)
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Digital Time & Action Controls */}
        <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto">
          
          {/* Real Clock */}
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-2">
              <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${theme.timeDisplay} tabular-nums`}>
                {time.toLocaleTimeString('en-US', { hour12: true })}
              </div>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${theme.badgeShift}`}>
                {isDayShift ? 'Day Shift' : 'Night Shift'}
              </span>
            </div>
            <div className={`text-xs font-medium ${theme.textMuted} mt-0.5`}>
              {time.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div className={`h-8 w-px ${theme.divider}`}></div>

          {/* Clean Action Toolbar */}
          <div className="flex items-center gap-2">
            
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode (Press T)' : 'Switch to Dark Mode (Press T)'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${theme.btnDefault}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Audio Chime Button */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playChime(true);
              }}
              title={soundEnabled ? 'Mute Chime Alerts (Press M)' : 'Enable Chime Alerts (Press M)'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : theme.btnDefault
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Press F)' : 'Enter Fullscreen (Press F)'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${theme.btnDefault}`}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Data (Press R)"
              className={`p-2 rounded-xl border transition-all cursor-pointer disabled:opacity-50 ${theme.btnDefault}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

        </div>
      </header>

      {/* KPI Telemetry Header Strip */}
      <section className="px-6 pt-4 pb-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Faculty & Staff Presence */}
          <div className={`p-4 rounded-2xl ${theme.cardBg} transition-all`}>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className={`flex items-center gap-1.5 ${theme.textSecondary}`}>
                <Users className="w-3.5 h-3.5 text-indigo-600" /> Faculty & Staff
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs font-bold font-mono">
                {stats.staff_total > 0 ? Math.round((stats.staff_present / stats.staff_total) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-2xl font-bold ${theme.textPrimary} font-mono tabular-nums`}>{stats.staff_present}</span>
              <span className={`text-xs ${theme.textMuted} font-mono`}>/ {stats.staff_total} on roster</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.staff_total > 0 ? Math.min(100, (stats.staff_present / stats.staff_total) * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Trainees & Recruits Presence */}
          <div className={`p-4 rounded-2xl ${theme.cardBg} transition-all`}>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className={`flex items-center gap-1.5 ${theme.textSecondary}`}>
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" /> Trainees & Recruits
              </span>
              <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 text-xs font-bold font-mono">
                {stats.trainees_total > 0 ? Math.round((stats.trainees_present / stats.trainees_total) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-2xl font-bold ${theme.textPrimary} font-mono tabular-nums`}>{stats.trainees_present}</span>
              <span className={`text-xs ${theme.textMuted} font-mono`}>/ {stats.trainees_total} enrolled</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.trainees_total > 0 ? Math.min(100, (stats.trainees_present / stats.trainees_total) * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Biometric Activity Summary */}
          <div className={`p-4 rounded-2xl ${theme.cardBg} transition-all`}>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className={`flex items-center gap-1.5 ${theme.textSecondary}`}>
                <Activity className="w-3.5 h-3.5 text-indigo-600" /> Recent Punches
              </span>
              <span className="text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-xs font-bold font-mono">
                Stream Buffer
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-2xl font-bold ${theme.textPrimary} font-mono tabular-nums`}>{punches.length}</span>
              <span className={`text-xs ${theme.textMuted}`}>records loaded</span>
            </div>
            <div className={`text-xs ${theme.textSecondary} truncate flex items-center gap-1`}>
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Latest: {latestPunch ? formatPunchTime(latestPunch.punch_time) : 'No events yet'}</span>
            </div>
          </div>

          {/* Biometric Hardware Fleet */}
          <div className={`p-4 rounded-2xl ${theme.cardBg} transition-all`}>
            <div className="flex justify-between items-center text-xs font-semibold mb-2">
              <span className={`flex items-center gap-1.5 ${theme.textSecondary}`}>
                <HardDrive className="w-3.5 h-3.5 text-indigo-600" /> Devices Connected
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs font-bold font-mono">
                {deviceStats ? `${deviceStats.online}/${deviceStats.total} Online` : `${devices.filter(d => d.connection_status === 'ONLINE').length} Active`}
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-2xl font-bold ${theme.textPrimary} font-mono tabular-nums`}>
                {devices.filter(d => d.connection_status === 'ONLINE').length}
              </span>
              <span className={`text-xs ${theme.textMuted} font-mono`}>/ {devices.length} terminals</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
              {devices.map((d) => (
                <div 
                  key={d.id}
                  title={`${d.name} (${d.connection_status})`}
                  className={`h-full flex-1 rounded-full transition-all ${
                    d.connection_status === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-400'
                  }`}
                />
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column (Span 4): Spotlight Card & Hardware Devices */}
        <div className="lg:col-span-4 flex flex-col gap-5 min-h-0">
          
          {/* Spotlight: Most Recent Verified Punch */}
          <div className={`p-5 rounded-2xl ${theme.cardBg} flex flex-col`}>
            <div className={`flex justify-between items-center pb-3 border-b ${theme.borderSubtle} mb-4`}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={`text-xs font-bold ${theme.textPrimary}`}>
                    Latest Verification
                  </h2>
                  <p className={`text-[11px] ${theme.textMuted}`}>Most recent terminal check-in</p>
                </div>
              </div>

              {latestPunch && (
                <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {getRelativeTime(latestPunch.punch_time)}
                </span>
              )}
            </div>

            {latestPunch ? (
              <div className={`p-4 rounded-xl border ${
                isLatestIn 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60' 
                  : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base border shadow-sm ${
                      isLatestIn 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200'
                    }`}>
                      {(latestPunch.personnel_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className={`text-base font-bold ${theme.textPrimary} leading-tight flex items-center gap-1.5`}>
                        {latestPunch.personnel_name || `Personnel #${latestPunch.biometric_user_id || latestPunch.employee_code}`}
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {latestPunch.employee_code && (
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 shadow-sm">
                            {latestPunch.employee_code}
                          </span>
                        )}
                        <span className={`text-xs font-mono ${theme.textSecondary}`}>
                          PIN #{latestPunch.biometric_user_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clean IN / OUT Badge */}
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border shadow-sm ${
                    isLatestIn
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}>
                    {isLatestIn ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{isLatestIn ? 'CHECK IN' : 'CHECK OUT'}</span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${theme.borderSubtle} text-xs`}>
                  <div>
                    <span className={`text-[10px] ${theme.textMuted} block font-semibold`}>Rank / Department</span>
                    <span className={`${theme.textPrimary} font-medium truncate block`}>
                      {latestPunch.rank_name || 'Personnel'}
                      {latestPunch.department_name ? ` · ${latestPunch.department_name}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[10px] ${theme.textMuted} block font-semibold`}>Terminal</span>
                    <span className={`${theme.textPrimary} font-medium truncate block`}>
                      {latestPunch.device_name || 'Biometric Terminal'}
                    </span>
                  </div>
                </div>

                <div className={`mt-3 pt-2.5 border-t ${theme.borderSubtle} flex justify-between items-center text-xs`}>
                  <span className={`text-xs ${theme.textSecondary} font-medium flex items-center gap-1.5`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Authenticated
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatPunchTime(latestPunch.punch_time)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <Clock className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <span>Waiting for biometric verification events...</span>
              </div>
            )}
          </div>

          {/* Biometric Hardware Terminals */}
          <div className={`p-5 rounded-2xl ${theme.cardBg} flex-1 flex flex-col min-h-0`}>
            <div className={`flex justify-between items-center pb-3 border-b ${theme.borderSubtle} mb-3`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className={`text-xs font-bold ${theme.textPrimary}`}>
                  Biometric Terminals
                </h2>
              </div>
              <span className={`text-xs font-mono ${theme.textMuted}`}>
                {devices.length} Units
              </span>
            </div>

            {/* Device list */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
              {devices.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No biometric devices registered.
                </div>
              ) : (
                devices.map((d) => {
                  const isOnline = d.connection_status === 'ONLINE';
                  return (
                    <div 
                      key={d.id} 
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                        isDarkMode 
                          ? 'bg-[#141721] border-[#222734] hover:border-[#32394A]' 
                          : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isOnline ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className={`font-semibold ${theme.textPrimary} truncate text-xs`}>
                            {d.name}
                          </div>
                          <div className={`text-[10px] ${theme.textMuted} flex items-center gap-1.5`}>
                            <span className="font-mono">{d.ip_address}</span>
                            {d.location && (
                              <>
                                <span>•</span>
                                <span className="truncate">{d.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block ${
                          isOnline 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                        }`}>
                          {d.connection_status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Span 8): Real-time Live Punch Feed */}
        <div className={`lg:col-span-8 rounded-2xl ${theme.cardBg} p-5 flex flex-col min-h-0`}>
          
          {/* Feed Toolbar & Filtering */}
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b ${theme.borderSubtle} mb-3`}>
            
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-bold ${theme.textPrimary}`}>Live Attendance Feed</h2>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {filteredPunches.length} logs
                  </span>
                </div>
                <p className={`text-xs ${theme.textSecondary}`}>
                  Continuous verified records streamed directly from hardware gates
                </p>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              
              {/* Clean Filter Tabs */}
              <div className={`flex items-center p-1 rounded-xl border text-xs ${isDarkMode ? 'bg-[#12141A] border-[#262B38]' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    filterType === 'ALL' 
                      ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-sm' 
                      : theme.inactiveTab
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('IN')}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    filterType === 'IN' 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : theme.inactiveTab
                  }`}
                >
                  In ({punches.filter(p => isPunchIn(p.punch_type)).length})
                </button>
                <button
                  onClick={() => setFilterType('OUT')}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                    filterType === 'OUT' 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : theme.inactiveTab
                  }`}
                >
                  Out ({punches.filter(p => !isPunchIn(p.punch_type)).length})
                </button>
              </div>

              {/* Clean Search Input */}
              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter name or ID..."
                  className={`w-full border rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none transition-colors ${theme.inputBg}`}
                />
              </div>

            </div>

          </div>

          {/* Punch Stream List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filteredPunches.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <span>No punch records found matching your filter.</span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-indigo-600 hover:underline font-semibold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              filteredPunches.map((p, idx) => {
                const isCheckIn = isPunchIn(p.punch_type);
                const isHighlighted = newlyAddedPunchId === p.id;
                const formattedTime = formatPunchTime(p.punch_time);

                return (
                  <div 
                    key={p.id || idx} 
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                      isHighlighted 
                        ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200' 
                        : theme.itemBg
                    }`}
                  >
                    {/* Left: Punch Direction + Personnel Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      
                      {/* State Badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                        isCheckIn 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}>
                        {isCheckIn ? (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">IN</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">OUT</span>
                        )}
                      </div>

                      {/* Monogram */}
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {(p.personnel_name || 'P').charAt(0).toUpperCase()}
                      </div>

                      {/* Name & Details */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-sm ${theme.textPrimary} truncate`}>
                            {p.personnel_name || `Personnel #${p.biometric_user_id || p.employee_code || '---'}`}
                          </span>
                          
                          {p.employee_code && (
                            <span className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {p.employee_code}
                            </span>
                          )}

                          <span className={`text-xs font-mono ${theme.textMuted}`}>
                            PIN #{p.biometric_user_id || '---'}
                          </span>
                        </div>

                        <div className={`text-xs ${theme.textSecondary} flex items-center gap-2 mt-0.5 truncate`}>
                          <span className="font-medium truncate">
                            {p.rank_name || 'Staff'}
                          </span>
                          {p.department_name && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="truncate flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {p.department_name}
                              </span>
                            </>
                          )}
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="truncate flex items-center gap-1 text-slate-400">
                            <HardDrive className="w-3 h-3" />
                            {p.device_name || 'Terminal'}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Right: Timestamp & Verified */}
                    <div className="text-right shrink-0 pl-3">
                      <div className={`text-sm font-bold font-mono ${theme.textPrimary} tabular-nums`}>
                        {formattedTime}
                      </div>
                      <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </main>

      {/* Bottom Kiosk Status Bar */}
      <footer className={`px-6 py-2.5 border-t ${theme.headerBg} flex flex-col sm:flex-row justify-between items-center text-xs ${theme.textSecondary} font-medium gap-2 transition-colors duration-200`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {branding.display_name || 'Central Biometric Gateway'}
          </span>
          <span className="text-slate-300">•</span>
          <span className={theme.textMuted}>Central Server Active</span>
        </div>

        {/* Keyboard shortcut tips */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Shortcuts:</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">[F] Fullscreen</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">[T] Theme</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">[M] Chime</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">[R] Refresh</span>
        </div>
      </footer>

    </div>
  );
};

export default LiveScreen;
