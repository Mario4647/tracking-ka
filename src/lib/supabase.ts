import { createClient } from '@supabase/supabase-js';

// Environment variables isolation - strictly from process.env
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (typeof window === 'undefined') {
    console.warn('[Security Warning] Supabase environment variables are missing.');
  }
}

// Mapbox Token from Environment Variable or User LocalStorage
export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || (typeof window !== 'undefined' ? localStorage.getItem('touring_mapbox_token') || '' : '');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// SHA-256 PIN Hashing with Pepper matching security standards
export async function hashPin(pin: string): Promise<string> {
  const pepper = process.env.NEXT_PUBLIC_APP_SECURITY_PEPPER || 'TouringLiveTrackingSecurePepper_998822AAbbXXzz';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${pin}:${pepper}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
