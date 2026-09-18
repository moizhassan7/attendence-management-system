import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Loader2, Sun, Moon, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { branding } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [branding.logo_url]);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, ...userData } = response.data;
      login(access_token, userData);

      // Try to fetch full profile
      try {
        const meRes = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        login(access_token, meRes.data);
      } catch (err) {
        console.error("Failed to fetch full profile", err);
      }

      navigate('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the attendance server. Open this app with the host PC IP and ensure backend service is running.');
      } else {
        setError(err.response?.data?.detail || 'Invalid username or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#080d1a] p-4 relative overflow-hidden transition-colors duration-200">
      {/* Top Header Controls: Return to Website & Theme Toggle */}
      <div className="absolute top-4 inset-x-4 max-w-5xl mx-auto flex items-center justify-between z-30 pointer-events-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:scale-102 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Return to Institution Website</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-105 transition-all cursor-pointer"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>

      {/* Decorative Orbs & Grid */}
      <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] bg-indigo-600/15 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-amber-500/15 dark:bg-amber-400/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2.5s' }}></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none"></div>

      <div className="w-full max-w-md z-10 pt-10 sm:pt-0">
        <div className="bg-white/95 dark:bg-[#0e1628]/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-[32px] p-8 sm:p-9 shadow-2xl shadow-indigo-950/10 dark:shadow-black/60 relative overflow-hidden">
          {/* Subtle Top Gold Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-indigo-600 to-amber-400"></div>

          {/* Large PTS Sargodha Crest Showcase */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="relative group mb-3">
              <div className="absolute -inset-2 bg-gradient-to-r from-amber-400/20 via-indigo-500/20 to-amber-400/20 rounded-full blur-md"></div>
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-900 dark:bg-slate-950 p-2 shadow-xl border-2 border-amber-400/40 flex items-center justify-center">
                {!logoFailed ? (
                  <img
                    src={branding.logo_url || '/pts_logo.png'}
                    alt="Police Training School Sargodha Crest"
                    className="w-full h-full object-contain filter drop-shadow"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <ShieldCheck className="w-14 h-14 text-amber-400" />
                )}
              </div>
            </div>

            {/* Official Badge Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              Punjab Police • Estd. Sargodha
            </div>

            {/* Institutional Headings */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Police Training School Sargodha
            </h1>
            <p className="text-xs font-serif text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              پولیس ٹریننگ سکول سرگودھا
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cadet & Official Management Portal
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl mb-5 text-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 animate-pulse"></div>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Authorized Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="e.g. admin or operator"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex justify-center items-center gap-2 transition-all cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In to System</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5 text-center text-[11px] text-slate-400 dark:text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600 dark:text-slate-400">
              {branding.legal_name || 'Police Training School, Sargodha — Punjab Police'}
            </p>
            <p>Government of Punjab • Punjab Police</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
