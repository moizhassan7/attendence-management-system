import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  ShieldCheck,
  BookOpen,
  UserPlus,
  UserCheck,
  FileText,
  UserCog,
  Link,
  Settings,
  DatabaseBackup,
  Fingerprint,
  MonitorPlay,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/trainees', icon: GraduationCap, label: 'Trainees' },
  { to: '/personnel', icon: Users, label: 'Staff' },
  { to: '/security', icon: ShieldCheck, label: 'Security' },
  { to: '/directory', icon: BookOpen, label: 'Directory' },
  { to: '/enrollment', icon: UserPlus, label: 'Enrollment' },
  { to: '/attendance', icon: UserCheck, label: 'Attendance' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/users', icon: UserCog, label: 'User Management' },
  { to: '/devices', icon: Link, label: 'Connection' },
  { to: '/settings', icon: Settings, label: 'Configuration' },
  { to: '/backup', icon: DatabaseBackup, label: 'Backup & Restore' },
];

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    setLogoFailed(false);
  }, [branding.logo_url]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#EEF2FF] dark:bg-[#0B0F19] p-3 gap-3">
      <aside className="w-[252px] flex-shrink-0 h-full flex flex-col bg-white dark:bg-[#121826] rounded-[28px] shadow-sm border border-white/80 dark:border-white/5 px-3.5 py-4">
        <div className="flex items-center gap-3 px-2 pb-3">
          <div className="w-11 h-11 rounded-full bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 p-1.5">
            {branding.logo_url && !logoFailed ? (
              <img
                src={branding.logo_url}
                alt={branding.display_name}
                className="w-full h-full object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : branding.acronym ? (
              <span className="font-bold text-xs text-indigo-600">{branding.acronym}</span>
            ) : (
              <Fingerprint className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100 leading-snug truncate"
              title={branding.display_name || 'Organization'}
            >
              {branding.display_name || 'Organization'}
            </h1>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
              Biometric Attendance Management
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-[7px] rounded-2xl text-[13px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="pt-3 space-y-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 text-[13px] font-semibold text-slate-600 dark:text-slate-300"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span className="flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span className={`w-9 h-5 rounded-full p-0.5 flex ${isDark ? 'bg-indigo-500 justify-end' : 'bg-slate-200'}`}>
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>

          <button
            onClick={() => navigate('/live-screen')}
            className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-[13px] font-bold text-white bg-[#1B2437] hover:bg-[#111827] dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            <MonitorPlay className="w-4 h-4" />
            Live Screen
          </button>

          <div className="flex items-center justify-between px-2 py-2 rounded-2xl bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                {user?.full_name?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user?.full_name || 'Administrator'}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                  {user?.role || 'ADMIN'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 flex-shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 pb-16">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
