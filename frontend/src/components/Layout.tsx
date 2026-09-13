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
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    setLogoFailed(false);
  }, [branding.logo_url]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Expanded nav items matching the mockup
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white m-3 rounded-3xl flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Logo Area */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700 overflow-hidden flex-shrink-0 shadow-xs p-1">
              {branding.logo_url && !logoFailed ? (
                <img 
                  src={branding.logo_url} 
                  alt={branding.display_name} 
                  className="w-full h-full object-contain"
                  onError={() => setLogoFailed(true)} 
                />
              ) : branding.acronym ? (
                <span className="font-black text-xs text-primary tracking-tight">{branding.acronym}</span>
              ) : (
                <Fingerprint className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 
                className="font-bold text-sm tracking-tight text-slate-800 leading-snug truncate"
                title={branding.display_name || 'Organization'}
              >
                {branding.display_name || 'Organization'}
              </h1>
              <p 
                className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate"
                title={branding.system_name || 'Attendance System'}
              >
                {branding.system_name || 'Attendance System'}
              </p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <nav className="px-4 mt-2 space-y-1 pb-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 text-primary'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Area */}
        <div className="p-4 bg-white border-t border-slate-50">
          <button 
            onClick={() => navigate('/live-screen')}
            className="w-full flex items-center justify-center gap-2 bg-dark text-white rounded-xl py-3 px-4 text-sm font-medium hover:bg-slate-700 transition-colors mb-3 shadow-lg shadow-dark/10"
          >
            <MonitorPlay className="w-4 h-4" />
            Live Screen
          </button>
          
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center text-xs font-bold">
                {user?.full_name?.substring(0, 2).toUpperCase() || 'BI'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">{user?.full_name || 'Bio Incharge'}</p>
                <p className="text-[10px] font-medium text-slate-400">{user?.role || 'ADMIN'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-danger transition-colors p-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
