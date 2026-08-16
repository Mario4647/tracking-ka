import { NextRequest, NextResponse } from 'next/server';

// ─── Rate Limiter (In-Memory Sliding Window for DDoS & Bruteforce Mitigation) ───
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const BLOCK_DURATION_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_GENERAL = 180; // 180 requests per minute
const MAX_REQUESTS_AUTH = 25; // 25 requests per minute for auth/upload

function isRateLimited(ip: string, isAuthOrUpload: boolean): boolean {
  const now = Date.now();
  const limit = isAuthOrUpload ? MAX_REQUESTS_AUTH : MAX_REQUESTS_GENERAL;
  const key = `${ip}:${isAuthOrUpload ? 'auth' : 'gen'}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + BLOCK_DURATION_MS });
    return false;
  }

  record.count += 1;
  if (record.count > limit) {
    return true;
  }
  return false;
}

// Periodic cleanup of stale rate limit entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of Array.from(rateLimitMap.entries())) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ─── Web Application Firewall (WAF) Detection Patterns ───────────────
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?\s+select)\b)/i,
  /(\b(select|insert|update|delete|drop|alter|create|truncate)\b\s+.*\b(from|into|table|database)\b)/i,
  /((\%27)|('))\s*(or|and)\s*.*(=|<|>|like)/i,
  /(\b(or|and)\b\s+['"\d\w]+=['"\d\w]+)/i,
  /(\b(benchmark|sleep|pg_sleep|waitfor\s+delay)\s*\()/i,
  /(;\s*(drop|delete|insert|update|select)\b)/i,
  /(--|\/\*|\*\/|#\s*$)/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /onload\s*=\s*['"][^'"]*['"]/i,
  /onerror\s*=\s*['"][^'"]*['"]/i,
  /onclick\s*=\s*['"][^'"]*['"]/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /eval\s*\(/i,
  /document\.cookie/i,
];

const RCE_AND_TRAVERSAL_PATTERNS = [
  /(\.\.\/|\.\.\\|\%2e\%2e\%2f|\%2e\%2e\/|\.\.\%2f)/i,
  /(\/etc\/passwd|\/etc\/shadow|\/proc\/self|\/boot\.ini|\/win\.ini)/i,
  /(cmd\.exe|powershell\.exe|\/bin\/sh|\/bin\/bash|\/bin\/zsh)/i,
  /(\b(passthru|shell_exec|exec|system|popen|proc_open)\s*\()/i,
  /(\b(base64_decode|eval|assert)\s*\(.*(base64|eval))/i,
];

function inspectPayload(input: string): { blocked: boolean; reason?: string } {
  if (!input) return { blocked: false };
  const decoded = decodeURIComponent(input);

  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(input) || pattern.test(decoded)) {
      return { blocked: true, reason: 'WAF: SQL Injection pattern detected' };
    }
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input) || pattern.test(decoded)) {
      return { blocked: true, reason: 'WAF: Cross-Site Scripting (XSS) pattern detected' };
    }
  }

  for (const pattern of RCE_AND_TRAVERSAL_PATTERNS) {
    if (pattern.test(input) || pattern.test(decoded)) {
      return { blocked: true, reason: 'WAF: Remote Code Execution or Path Traversal attempt detected' };
    }
  }

  return { blocked: false };
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

  // 1. Skip static assets, favicon, and next internal chunks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('/favicon.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  // 2. DDoS / Anti-Bruteforce Rate Limiting
  const isAuthOrUpload = pathname.includes('/admin/login') || pathname.includes('/api/gapeka/upload');
  if (isRateLimited(ip, isAuthOrUpload)) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Aktivitas terdeteksi terlalu tinggi. Permintaan Anda dibatasi sementara demi keamanan sistem.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  // 3. WAF Security Inspection on URI & Query String
  const urlInspection = inspectPayload(pathname + search);
  if (urlInspection.blocked) {
    console.warn(`[WAF Security Block] IP: ${ip} | Path: ${pathname} | Reason: ${urlInspection.reason}`);
    return new NextResponse(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Permintaan diblokir oleh Web Application Firewall (WAF) keamanan sistem.',
        reason: urlInspection.reason,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Backward Compatibility Redirect: /kereta -> /
  if (pathname === '/kereta') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 5. Anti-Bypass Admin Check for Dashboard Route (Strict Server-Side Protection)
  if (pathname.startsWith('/admin/dashboard')) {
    const adminSessionCookie = req.cookies.get('touring_admin_session')?.value;
    if (!adminSessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // 6. Security Headers Response Hardening (Anti-CVE / Anti-Clickjacking / Anti-MIME)
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://api.mapbox.com blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://api.mapbox.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.tiles.openrailwaymap.org https://*.tile.thunderforest.com https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.opentopomap.org https://api.mapbox.com https://*.tiles.mapbox.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tile.openstreetmap.org https://*.tiles.openrailwaymap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
