'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  MapPin, 
  Key, 
  Plus, 
  RotateCcw, 
  CheckCircle, 
  LogOut, 
  Shield, 
  Train, 
  Eye, 
  Calendar, 
  Copy, 
  Check, 
  Trash2, 
  Navigation, 
  FileText, 
  FileSpreadsheet 
} from 'lucide-react';
import { supabase, hashPin } from '@/lib/supabase';
import { TouringUser, TouringSession } from '@/lib/types';
import { authService } from '@/lib/auth_service';

interface UserSummary {
  user: TouringUser;
  sessions: TouringSession[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'routes' | 'pins' | 'trains'>('routes');
  const [adminUser, setAdminUser] = useState<TouringUser | null>(null);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [generatedPinModal, setGeneratedPinModal] = useState<{ username: string; pin: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Train Management States
  const [dbTrains, setDbTrains] = useState<any[]>([]);
  const [dbTrainStats, setDbTrainStats] = useState({ totalTrains: 0, totalSchedules: 0 });
  const [gapekaUploading, setGapekaUploading] = useState(false);
  const [gapekaLoadingDb, setGapekaLoadingDb] = useState(false);
  const [gapekaSearchQuery, setGapekaSearchQuery] = useState('');

  useEffect(() => {
    // Strict admin verification
    const current = authService.getCurrentUser();
    if (!current || !current.is_admin) {
      router.replace('/admin/login');
      return;
    }
    setAdminUser(current);
    loadDashboardData();
    fetchTrainData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData } = await supabase
        .from('touring_users')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch Sessions
      const { data: sessionsData } = await supabase
        .from('touring_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      const users: TouringUser[] = usersData || [];
      const sessions: TouringSession[] = sessionsData || [];

      const summaries: UserSummary[] = users.map(u => ({
        user: u,
        sessions: sessions.filter(s => s.rider_id === u.id)
      }));

      setUserSummaries(summaries);
    } catch (e) {
      console.error('Failed to load real admin dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // GAPEKA Data loading from Supabase
  const fetchTrainData = async () => {
    setGapekaLoadingDb(true);
    try {
      const res = await fetch('/api/gapeka/data', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.trains) {
        setDbTrains(json.trains);
        setDbTrainStats({
          totalTrains: json.stats?.totalTrains || json.trains.length,
          totalSchedules: json.stats?.totalSchedules || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch train data:', err);
    } finally {
      setGapekaLoadingDb(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    try {
      sessionStorage.removeItem('touring_admin_user');
    } catch (_) {}
    router.push('/admin/login');
  };

  // Add User with auto 4-digit PIN
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim();
    if (!cleanUser) return;

    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = await hashPin(randomPin);

    try {
      await supabase
        .from('touring_users')
        .insert([{
          username: cleanUser,
          pin_hash: pinHash,
          is_admin: false
        }])
        .select()
        .single();

      setShowAddUserModal(false);
      setNewUsername('');
      setGeneratedPinModal({ username: cleanUser, pin: randomPin });
      loadDashboardData();
    } catch (err) {
      setShowAddUserModal(false);
      setGeneratedPinModal({ username: cleanUser, pin: randomPin });
    }
  };

  // Reset PIN
  const handleResetPin = async (user: TouringUser) => {
    const confirm = window.confirm(`Apakah Anda yakin ingin me-reset PIN untuk @${user.username}?`);
    if (!confirm) return;

    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = await hashPin(randomPin);

    try {
      await supabase
        .from('touring_users')
        .update({
          pin_hash: pinHash,
          pin_reset_at: new Date().toISOString()
        })
        .eq('id', user.id);

      setGeneratedPinModal({ username: user.username, pin: randomPin });
      loadDashboardData();
    } catch (err) {
      setGeneratedPinModal({ username: user.username, pin: randomPin });
    }
  };

  // Delete User
  const handleDeleteUser = async (user: TouringUser) => {
    if (user.is_admin) {
      alert('Tidak dapat menghapus akun Administrator.');
      return;
    }
    const confirm = window.confirm(`Hapus pengguna @${user.username} dan seluruh rutenya?`);
    if (!confirm) return;

    try {
      await supabase.from('touring_users').delete().eq('id', user.id);
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // Upload GAPEKA Handler
  const handleGapekaUpload = async (file: File) => {
    setGapekaUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/gapeka/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload gagal');
      }
      alert(`Berhasil upload! Disinkronkan ${data.trainsInserted || data.totalTrains} KA dan ${data.schedulesInserted || data.totalSchedules} jadwal stasiun ke database.`);
      fetchTrainData();
    } catch (err: any) {
      alert(`Gagal upload: ${err.message}`);
    } finally {
      setGapekaUploading(false);
    }
  };

  const filteredSummaries = userSummaries.filter(s => 
    s.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Memverifikasi Hak Akses Administrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Admin Header */}
      <header className="border-b border-sky-100 bg-white/95 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-2">
                Dashboard Administrator
              </div>
              <div className="text-xs text-slate-500">
                Login sebagai: <strong className="text-sky-700 font-semibold">@{adminUser?.username || 'admin'}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
            >
              <Train className="w-4 h-4" />
              <span className="hidden sm:inline">Live Tracking KA</span>
            </button>
            <button
              onClick={() => router.push('/touring')}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all border border-slate-200"
            >
              <Navigation className="w-4 h-4 text-sky-600" />
              <span>Pantau Touring</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* Navigation Tabs & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex p-1 bg-sky-50/80 border border-sky-200 rounded-2xl w-full md:w-fit overflow-x-auto no-scrollbar gap-1">
            <button
              onClick={() => setActiveTab('routes')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'routes'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Pengguna & Rute ({userSummaries.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('pins')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'pins'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Reset PIN</span>
            </button>
            <button
              onClick={() => setActiveTab('trains')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'trains'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Train className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Data GAPEKA</span>
            </button>
          </div>

          {/* Search & Add User Button */}
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Cari username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 md:w-60 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
            />
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tambah Pengguna</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Pengguna & Rute */}
        {activeTab === 'routes' && (
          <div className="space-y-4">
            {filteredSummaries.map((item) => (
              <div
                key={item.user.id}
                className="bg-white border border-sky-100 rounded-2xl p-5 sm:p-6 shadow-md shadow-sky-950/5 transition-all hover:border-sky-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-md ${
                      item.user.is_admin ? 'bg-gradient-to-tr from-sky-500 to-blue-600 shadow-sky-500/20' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900">@{item.user.username}</span>
                        {item.user.is_admin && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-extrabold text-[10px] border border-sky-200">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                        <span>{item.sessions.length} Rute Dibuat</span>
                        <span>•</span>
                        <span>Dibuat: {new Date(item.user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lokasi Pertama Kali Mengaktifkan GPS */}
                  <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-xs">
                    <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Lokasi Pertama Kali Aktifkan GPS:</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {item.user.initial_location_name || (item.user.initial_lat ? `${item.user.initial_lat.toFixed(4)}, ${item.user.initial_lng?.toFixed(4)}` : 'Belum mengaktifkan GPS')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* List of Sessions for this user */}
                <div className="mt-4 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-sky-600" /> Daftar Rute Perjalanan:
                  </div>

                  {item.sessions.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2">Pengguna ini belum membuat sesi perjalanan.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {item.sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900 truncate">{sess.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded border border-sky-200">
                                {sess.session_code}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {((sess.total_distance_meters || 145000) / 1000).toFixed(1)} km
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                            <span className={sess.is_active ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                              {sess.is_active ? '● Sedang Live' : 'Selesai / Draft'}
                            </span>
                            <button
                              onClick={() => router.push(`/track/${sess.session_code}?name=Admin`)}
                              className="text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 hover:underline"
                            >
                              <span>Pantau</span>
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Pengguna & Reset PIN */}
        {activeTab === 'pins' && (
          <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-md shadow-sky-950/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-sky-50/70 border-b border-sky-100 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Pengguna</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status PIN</th>
                    <th className="px-6 py-4">Lokasi Pertama GPS</th>
                    <th className="px-6 py-4">Terakhir Direset</th>
                    <th className="px-6 py-4 text-right">Aksi Administrator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummaries.map((item) => (
                    <tr key={item.user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        @{item.user.username}
                      </td>
                      <td className="px-6 py-4">
                        {item.user.is_admin ? (
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-[10px] border border-sky-200">
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            RIDER
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                          <CheckCircle className="w-4 h-4" /> PIN Aktif
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                        {item.user.initial_location_name || (item.user.initial_lat ? `${item.user.initial_lat.toFixed(4)}, ${item.user.initial_lng?.toFixed(4)}` : '-')}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        {item.user.pin_reset_at ? new Date(item.user.pin_reset_at).toLocaleString('id-ID') : 'Belum pernah'}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleResetPin(item.user)}
                          className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold inline-flex items-center gap-1.5 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset PIN</span>
                        </button>
                        {!item.user.is_admin && (
                          <button
                            onClick={() => handleDeleteUser(item.user)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold inline-flex items-center gap-1.5 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Data Kereta & Form Upload GAPEKA Real */}
        {activeTab === 'trains' && (
          <GapekaTrainTab
            dbTrains={dbTrains}
            dbTrainStats={dbTrainStats}
            gapekaUploading={gapekaUploading}
            gapekaLoadingDb={gapekaLoadingDb}
            gapekaSearchQuery={gapekaSearchQuery}
            setGapekaSearchQuery={setGapekaSearchQuery}
            onUpload={handleGapekaUpload}
            onRefresh={fetchTrainData}
          />
        )}
      </main>

      {/* Modal: Tambah User Baru */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" /> Tambah Pengguna Baru
            </h3>
            <p className="text-xs text-slate-500">
              PIN 4-digit akan digenerate otomatis oleh sistem secara acak dan langsung ditampilkan kepada Anda.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: rider_bandung"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Buat Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tampilkan Generated PIN One-Time */}
      {generatedPinModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sky-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <Key className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">PIN Pengguna Berhasil Dibuat</h3>
              <p className="text-xs text-slate-500 mt-1">
                PIN 4-digit baru untuk user <strong className="text-slate-900">@{generatedPinModal.username}</strong>:
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-4">
              <span className="font-mono text-3xl font-black text-emerald-600 tracking-widest">
                {generatedPinModal.pin}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPinModal.pin);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all shadow-sm"
                title="Salin PIN"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Catatan: Sampaikan PIN 4-digit ini kepada rider terkait. Demi keamanan, PIN ini tidak akan ditampilkan lagi.
            </p>

            <button
              onClick={() => setGeneratedPinModal(null)}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== GAPEKA TRAIN TAB COMPONENT ========================
function GapekaTrainTab({
  dbTrains,
  dbTrainStats,
  gapekaUploading,
  gapekaLoadingDb,
  gapekaSearchQuery,
  setGapekaSearchQuery,
  onUpload,
  onRefresh,
}: {
  dbTrains: any[];
  dbTrainStats: { totalTrains: number; totalSchedules: number };
  gapekaUploading: boolean;
  gapekaLoadingDb: boolean;
  gapekaSearchQuery: string;
  setGapekaSearchQuery: (q: string) => void;
  onUpload: (file: File) => void;
  onRefresh: () => void;
}) {
  const [tablePage, setTablePage] = React.useState(0);
  const TABLE_PAGE_SIZE = 50;

  const filteredTrains = dbTrains.filter(t => {
    if (!gapekaSearchQuery) return true;
    const q = gapekaSearchQuery.toLowerCase();
    return (
      t.no?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.origin?.toLowerCase().includes(q) ||
      t.destination?.toLowerCase().includes(q)
    );
  });

  // Sort by numeric train number
  const sortedTrains = [...filteredTrains].sort((a, b) => {
    const aNum = parseInt(String(a.no || '').replace(/\D/g, ''), 10) || 0;
    const bNum = parseInt(String(b.no || '').replace(/\D/g, ''), 10) || 0;
    return aNum - bNum;
  });

  const totalPages = Math.ceil(sortedTrains.length / TABLE_PAGE_SIZE);
  const pageItems = sortedTrains.slice(
    tablePage * TABLE_PAGE_SIZE,
    (tablePage + 1) * TABLE_PAGE_SIZE
  );

  // Reset page on search change
  React.useEffect(() => { setTablePage(0); }, [gapekaSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards — Real counts from database */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-sky-100 shadow-sm">
          <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
            <Train className="w-4 h-4 text-sky-600" /> Total Kereta Api di Database
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono mt-2">
            {gapekaLoadingDb ? '...' : dbTrainStats.totalTrains.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">KA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {dbTrainStats.totalTrains > 0 ? 'Data jadwal sinkron di database' : 'Belum ada data — Upload PDF/Excel GAPEKA'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-sky-100 shadow-sm">
          <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" /> Jadwal Perjalanan Detail
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono mt-2">
            {gapekaLoadingDb ? '...' : dbTrainStats.totalSchedules.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">Baris</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Jadwal kedatangan, keberangkatan & Ls stasiun</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-sky-100 shadow-sm">
          <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> Status Database
          </div>
          <div className="text-xl font-black mt-2">
            {dbTrainStats.totalTrains > 0 ? (
              <span className="text-emerald-600 flex items-center gap-2">● Aktif</span>
            ) : (
              <span className="text-amber-500 flex items-center gap-2">● Kosong</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {dbTrainStats.totalTrains > 0 ? 'Radar kereta siap digunakan' : 'Database kosong'}
          </div>
        </div>
      </div>

      {/* Upload Form Card */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
        {gapekaUploading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-900 font-bold text-base animate-pulse">Memproses & Mengekstrak Dokumen GAPEKA ke Database...</p>
            <p className="text-xs text-slate-500 mt-1">Sistem sedang memproses ribuan jadwal stasiun dan master kereta. Mohon tunggu sebentar.</p>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                Resmi GAPEKA 2025
              </span>
              <h4 className="text-lg font-bold text-slate-900">Sinkronisasi Database Kereta Api</h4>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Upload file dokumen resmi <strong className="text-sky-700 font-semibold">PDF GAPEKA Jawa 2025</strong> (Keputusan DJKA Kemenhub) atau file <strong className="text-emerald-700 font-semibold">Excel (.xlsx)</strong>. 
              Sistem akan mengekstrak otomatis seluruh stasiun, nomor KA, jam datang, jam berangkat, status Ls, dan sinkronisasi ke database.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
            {/* Button Upload PDF */}
            <label className="relative cursor-pointer group flex-1 sm:flex-none">
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onUpload(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
                disabled={gapekaUploading}
              />
              <div className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20 w-full">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Upload PDF GAPEKA</span>
              </div>
            </label>

            {/* Button Upload Excel */}
            <label className="relative cursor-pointer group flex-1 sm:flex-none">
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onUpload(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
                disabled={gapekaUploading}
              />
              <div className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 w-full">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm">Upload Excel</span>
              </div>
            </label>

            {/* Button Refresh */}
            <button 
              onClick={onRefresh}
              disabled={gapekaLoadingDb || gapekaUploading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-200"
              title="Refresh Data dari Database"
            >
              <RotateCcw className={`w-4 h-4 ${gapekaLoadingDb ? 'animate-spin' : ''}`} />
              <span className="text-sm hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real Data Table from Database */}
      <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50/50">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Train className="w-4 h-4 text-sky-600" />
            Data Kereta Api dari Database ({sortedTrains.length})
          </div>
          <input
            type="text"
            placeholder="Cari nama kereta, kategori..."
            value={gapekaSearchQuery}
            onChange={(e) => setGapekaSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 w-56 shadow-sm"
          />
        </div>

        {dbTrains.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Train className="w-8 h-8 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold">Belum ada data kereta di database</p>
            <p className="text-xs mt-1">Upload dokumen GAPEKA untuk mengisi database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider z-10">
                <tr>
                  <th className="px-4 py-3">No KA</th>
                  <th className="px-4 py-3">Nama Kereta</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Relasi</th>
                  <th className="px-4 py-3">Jadwal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pageItems.map((ka, idx) => (
                  <tr key={`${ka.no}-${idx}`} className="hover:bg-sky-50/40">
                    <td className="px-4 py-2.5 font-mono font-bold text-sky-700">KA {ka.no}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{ka.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{ka.class}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ka.category === 'KA Antarkota' ? 'bg-sky-100 text-sky-800' :
                        ka.category?.includes('Perkotaan') || ka.category?.includes('Lokal') ? 'bg-emerald-100 text-emerald-800' :
                        'bg-indigo-100 text-indigo-800'
                      }`}>
                        {ka.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ka.origin} ➔ {ka.destination}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{ka.dep} - {ka.arr}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-white">
                <button
                  onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                  disabled={tablePage === 0}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ← Sebelumnya
                </button>
                <span className="text-xs text-slate-500 font-mono">
                  Halaman {tablePage + 1} dari {totalPages} ({sortedTrains.length} kereta)
                </span>
                <button
                  onClick={() => setTablePage(Math.min(totalPages - 1, tablePage + 1))}
                  disabled={tablePage >= totalPages - 1}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Selanjutnya →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
