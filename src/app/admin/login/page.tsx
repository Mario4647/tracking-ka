'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, ArrowLeft, ArrowRight, AlertCircle, Train } from 'lucide-react';
import { authService } from '@/lib/auth_service';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUser) {
      setErrorMessage('Masukkan username admin.');
      return;
    }
    if (cleanPin.length < 4) {
      setErrorMessage('PIN admin harus berupa minimal 4 digit.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authService.login(cleanUser, cleanPin);

      if (!res.success || !res.user) {
        setErrorMessage(res.error || 'Username atau PIN Admin salah.');
        setIsLoading(false);
        return;
      }

      if (!res.user.is_admin) {
        setErrorMessage('Akun ini bukan akun Administrator. Akses dashboard admin ditolak.');
        setIsLoading(false);
        return;
      }

      try {
        sessionStorage.setItem('touring_admin_user', JSON.stringify(res.user));
      } catch (_) {}

      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Terjadi kesalahan saat login: ${err.message || 'Kesalahan sistem'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative font-sans">
      {/* Back Button */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-sky-100 text-slate-700 text-xs font-semibold shadow-md shadow-sky-950/5 transition-all"
      >
        <ArrowLeft className="w-4 h-4 text-sky-600" />
        <span>Kembali ke Live Tracking KA</span>
      </button>

      <div className="max-w-md w-full my-auto py-6">
        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard Admin
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5">
            Masuk untuk mengelola data jadwal kereta, rute touring, dan akun pengguna.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-950/5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Username Admin
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: admin"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                PIN Admin (4-6 Digit)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono tracking-widest text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span>Memverifikasi...</span>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
