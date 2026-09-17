import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Lock, User, Loader2, Sun, Moon } from 'lucide-react';
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

      navigate('/');
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the attendance server. Open this app with the host PC IP (not localhost) and keep the backend running.');
      } else {
        setError(err.response?.data?.detail || 'Invalid username or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-mesh p-4 relative overflow-hidden transition-colors duration-200">
      {/* Floating Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-105 transition-all z-20 cursor-pointer"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
      </button>

      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md z-10">
        <div className="glass-panel p-8 shadow-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/10 border border-primary/20 dark:border-primary/30 overflow-hidden p-1.5">
              {branding.logo_url && !logoFailed ? (
                <img 
                  src={branding.logo_url} 
                  alt={branding.display_name} 
                  className="w-full h-full object-contain"
                  onError={() => setLogoFailed(true)} 
                />
              ) : branding.acronym ? (
                <span className="text-xl font-black text-primary dark:text-indigo-400">{branding.acronym}</span>
              ) : (
                <Fingerprint className="w-8 h-8 text-primary dark:text-indigo-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-center">
              {branding.display_name || 'AttendSys'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 text-center">
              {branding.system_name || 'Biometric Attendance & Executive Dashboard'}
            </p>
            {branding.tagline && (
              <p className="text-slate-400 dark:text-slate-500 text-xs italic mt-1">{branding.tagline}</p>
            )}
          </div>

          {error && (
            <div className="bg-danger/20 border border-danger/50 text-danger-100 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0 animate-pulse"></div>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-10"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2.5 mt-2 flex justify-center items-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-slate-500">
            <p>{branding.legal_name || branding.display_name || 'On-Premise ZKTeco Integration System'}</p>
            <p className="mt-1">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
