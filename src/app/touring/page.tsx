'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Navigation, 
  Shield, 
  Radio, 
  ArrowRight, 
  History, 
  AlertCircle, 
  Train, 
  LogOut, 
  User, 
  Key, 
  Lock, 
  UserPlus, 
  X 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/auth_service';
import { TouringUser } from '@/lib/types';

interface RecentSession {
  code: string;
  name: string;
  title: string;
  lastVisited: string;
}

export default function TouringTrackerPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<TouringUser | null>(null);
  const [viewerName, setViewerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  // Auth modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    if (user) {
      setViewerName(user.username);
    } else {
      const savedName = localStorage.getItem('touring_viewer_name') || '';
      if (savedName) setViewerName(savedName);
    }

    try {
      const recents = localStorage.getItem('touring_recent_viewers');
      if (recents) {
        setRecentSessions(JSON.parse(recents));
      }
    } catch (_) { }

    const handleAuthChange = () => {
      const u = authService.getCurrentUser();
      setCurrentUser(u);
      if (u) setViewerName(u.username);
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const res = await authService.login(authUsername, authPin);
        if (!res.success) {
          setAuthError(res.error || 'Gagal login');
        } else {
          setCurrentUser(res.user || null);
          setShowAuthModal(false);
          setAuthUsername('');
          setAuthPin('');
        }
      } else {
        const res = await authService.register(authUsername, authPin);
        if (!res.success) {
          setAuthError(res.error || 'Gagal mendaftar');
        } else {
          setCurrentUser(res.user || null);
          setShowAuthModal(false);
          setAuthUsername('');
          setAuthPin('');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = viewerName.trim();
    const cleanCode = sessionCode.trim().toUpperCase();

    if (!cleanName) {
      setErrorMessage('Masukkan nama pemantau Anda.');
      return;
    }
    if (cleanCode.length !== 8) {
      setErrorMessage('Kode perjalanan harus terdiri dari 8 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('touring_sessions')
        .select('id, session_code, title, is_active, status')
        .eq('session_code', cleanCode)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setErrorMessage(`Kode perjalanan "${cleanCode}" tidak ditemukan. Pastikan rider di aplikasi sudah membagikan kode yang benar.`);
        setIsLoading(false);
        return;
      }

      const sessionTitle = data.title || 'Touring Sesi';

      try {
        localStorage.setItem('touring_viewer_name', cleanName);

        const updatedRecents = [
          {
            code: cleanCode,
            name: cleanName,
            title: sessionTitle,
            lastVisited: new Date().toISOString(),
          },
          ...recentSessions.filter(r => r.code !== cleanCode),
        ].slice(0, 5);

        localStorage.setItem('touring_recent_viewers', JSON.stringify(updatedRecents));
      } catch (_) { }

      router.push(`/track/${cleanCode}?viewer=${encodeURIComponent(cleanName)}`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Gagal menghubungkan ke sesi touring. Periksa koneksi internet Anda.');
      setIsLoading(false);
    }
  };

  const handleQuickJoin = (item: RecentSession) => {
    router.push(`/track/${item.code}?viewer=${encodeURIComponent(item.name || viewerName || 'Pemantau')}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center px-4 py-6 sm:py-8 font-sans">
      {/* ─── Top Navigation Bar (Clean Light Blue & White) ───────────── */}
      <header className="w-full max-w-5xl flex items-center justify-between gap-4 mb-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 bg-white/95 p-2 px-4 rounded-2xl border border-sky-100 shadow-md shadow-sky-950/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 leading-tight">
              Pantau Touring <span className="text-sky-600">Live</span>
            </div>
            <div className="text-[11px] text-slate-500">Real-time GPS Tracking Komunitas</div>
          </div>
        </div>

        {/* Right Navigation */}
        <div className="flex items-center gap-2">
          {/* Live Tracking KA Button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-all shadow-md shadow-sky-600/20"
          >
            <Train className="w-4 h-4" />
            <span className="hidden sm:inline">Live Tracking KA</span>
          </button>

          {/* User Profile / Login Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-white border border-sky-100 p-1.5 px-3 rounded-xl shadow-md shadow-sky-950/5">
              <div className="flex items-center gap-1.5 text-xs text-sky-700 font-mono font-semibold">
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span className="max-w-[100px] truncate">@{currentUser.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all ml-1"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold transition-all shadow-md shadow-sky-950/5"
            >
              <Key className="w-4 h-4 text-sky-600" />
              <span>Login</span>
            </button>
          )}

          {/* Admin Dashboard */}
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-sky-100 text-slate-600 hover:text-slate-900 transition-all shadow-md shadow-sky-950/5"
            title="Dashboard Admin"
          >
            <Shield className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </header>

      {/* ─── Main Center Card ────────────────────────────────────────── */}
      <div className="max-w-md w-full my-auto py-4">
        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold mb-3 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-ping" />
            <span>Mode Pemantau Publik</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pantau Posisi Rider
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5">
            Cukup masukkan nama Anda dan 8-digit kode sesi perjalanan yang dibagikan oleh rider.
          </p>
        </div>

        {/* Input Form Card */}
        <div className="bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-950/5">
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Nama Pemantau Anda
              </label>
              <input
                type="text"
                value={viewerName}
                onChange={(e) => setViewerName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                maxLength={30}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Kode Perjalanan (8 Karakter)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="TRNG-9988"
                  maxLength={8}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
                <Radio className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600" />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Mulai Pantau Perjalanan</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Join Recent Sessions */}
          {recentSessions.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-sky-600" />
                <span>Perjalanan Terakhir Dipantau</span>
              </div>
              <div className="space-y-2">
                {recentSessions.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => handleQuickJoin(item)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 flex items-center justify-between text-left transition-all group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                        {item.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 font-semibold">
                        Kode: {item.code}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="text-center text-slate-400 text-xs py-2">
        Aplikasi Pelacakan GPS & Touring Komunitas © {new Date().getFullYear()}
      </footer>

      {/* ─── Auth Modal (Optional Login/Register) ────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 mx-auto shadow-lg shadow-sky-500/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {authMode === 'login' ? 'Masuk ke Akun' : 'Daftar Akun Pengguna Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                {authMode === 'login'
                  ? 'Masukkan Username dan PIN Anda.'
                  : 'Buat Username dan tentukan PIN angka Anda sendiri.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="Masukkan username"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  PIN Akses (4-6 Digit Angka)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={8}
                    value={authPin}
                    onChange={(e) => setAuthPin(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : authMode === 'login' ? (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Masuk</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar & Masuk</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100">
              {authMode === 'login' ? (
                <p className="text-xs text-slate-500">
                  Belum punya akun?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                    className="text-sky-600 font-bold hover:underline"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Sudah memiliki akun?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    className="text-sky-600 font-bold hover:underline"
                  >
                    Masuk ke Akun
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
