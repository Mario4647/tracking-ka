import { supabase, hashPin } from './supabase';
import { TouringUser } from './types';

const STORAGE_KEY = 'touring_active_user';
const COOKIE_USER_KEY = 'touring_user_session';
const COOKIE_ADMIN_KEY = 'touring_admin_session';

export interface AuthSession {
  user: TouringUser;
  token: string;
  loginTime: number;
  expiresAt: number; // 30 days timestamp
}

// 30 Days persistent session duration
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function setCookie(name: string, value: string, days: number = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`;
}

export const authService = {
  // ─── Get Current Logged In User ──────────────────────────────────
  getCurrentSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session: AuthSession = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        // Expired
        authService.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  getCurrentUser(): TouringUser | null {
    return authService.getCurrentSession()?.user || null;
  },

  isAuthenticated(): boolean {
    return authService.getCurrentSession() !== null;
  },

  isAdmin(): boolean {
    const user = authService.getCurrentUser();
    return Boolean(user && user.is_admin);
  },

  // ─── Login with Username & PIN ────────────────────────────────────
  async login(username: string, pin: string): Promise<{ success: boolean; user?: TouringUser; error?: string }> {
    try {
      const cleanUsername = username.trim().toLowerCase();
      const cleanPin = pin.trim();

      if (!cleanUsername || !cleanPin) {
        return { success: false, error: 'Username dan PIN wajib diisi' };
      }

      const hashedPin = await hashPin(cleanPin);

      const { data, error } = await supabase
        .from('touring_users')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (error) {
        return { success: false, error: `Database error: ${error.message}` };
      }

      if (!data) {
        return { success: false, error: 'Username tidak ditemukan. Silakan daftar terlebih dahulu.' };
      }

      if (data.pin_hash !== hashedPin) {
        return { success: false, error: 'PIN yang Anda masukkan salah.' };
      }

      const now = Date.now();
      const session: AuthSession = {
        user: data,
        token: `sess_${data.id}_${now}`,
        loginTime: now,
        expiresAt: now + SESSION_DURATION_MS,
      };

      // Save persistent session in localStorage and Cookies
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setCookie(COOKIE_USER_KEY, session.token, 30);
        if (data.is_admin) {
          setCookie(COOKIE_ADMIN_KEY, session.token, 30);
        }
      }

      window.dispatchEvent(new Event('auth-change'));
      return { success: true, user: data };
    } catch (err: any) {
      return { success: false, error: `Gagal login: ${err.message}` };
    }
  },

  // ─── Register New User with Username & PIN ───────────────────────
  async register(username: string, pin: string): Promise<{ success: boolean; user?: TouringUser; error?: string }> {
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const cleanPin = pin.trim();

      if (cleanUsername.length < 3) {
        return { success: false, error: 'Username minimal 3 karakter (huruf, angka, atau underscore).' };
      }

      if (cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
        return { success: false, error: 'PIN harus berupa 4 hingga 8 digit angka.' };
      }

      // Check if username already taken
      const { data: existing } = await supabase
        .from('touring_users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'Username sudah digunakan. Silakan gunakan username lain atau login.' };
      }

      const hashedPin = await hashPin(cleanPin);

      const { data, error } = await supabase
        .from('touring_users')
        .insert({
          username: cleanUsername,
          pin_hash: hashedPin,
          is_admin: false,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: `Gagal mendaftarkan akun: ${error.message}` };
      }

      // Auto login newly registered user
      const now = Date.now();
      const session: AuthSession = {
        user: data,
        token: `sess_${data.id}_${now}`,
        loginTime: now,
        expiresAt: now + SESSION_DURATION_MS,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setCookie(COOKIE_USER_KEY, session.token, 30);
      }

      window.dispatchEvent(new Event('auth-change'));
      return { success: true, user: data };
    } catch (err: any) {
      return { success: false, error: `Gagal pendaftaran: ${err.message}` };
    }
  },

  // ─── Logout ───────────────────────────────────────────────────────
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('touring_admin_user');
      deleteCookie(COOKIE_USER_KEY);
      deleteCookie(COOKIE_ADMIN_KEY);
      window.dispatchEvent(new Event('auth-change'));
    }
  },
};
