import { randomBytes } from 'crypto';
import { CookieOptions } from 'express';

// M7a Slice A (ADR-0002'yi bitirmek): SADECE refresh token + bir CSRF
// eşleştirme değeri httpOnly cookie'ye taşınıyor - access token bearer
// header'da kalıyor (bkz. ADR-0002 Addendum). apps/web ve apps/api farklı
// origin'de (render.yaml WEB_ORIGIN yorumu) - SameSite=None+Secure şart,
// Lax/Strict cross-site fetch'te cookie'yi hiç göndermez.
export const REFRESH_COOKIE_NAME = 'koqep_rt';
export const CSRF_COOKIE_NAME = 'koqep_csrf';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  if (!header) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!name) {
      continue;
    }
    result[name] = decodeURIComponent(value);
  }
  return result;
}

// Bilerek domain attribute'u YOK (host-only, api.koqep.com'a daraltılmış
// kalıyor) - httpOnly olduğu için document.cookie okuma sorunu zaten yok,
// CSRF çerezinin aksine genişletmeye gerek yok. .koqep.com'a genişletmek
// ileride BAŞKA bir subdomain (ör. blog.koqep.com) XSS'e maruz kalırsa en
// hassas kimlik materyalini (refresh token) de sızdırma riski açardı.
export function buildRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    // Sadece /auth/refresh ve /auth/logout bu cookie'yi okuyor - JS'in
    // hiç görmesi gerekmiyor, path daraltmak gereksiz gönderimi azaltır.
    path: '/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

// KRİTİK production regresyonu düzeltmesi (M7a Slice A düzeltmesi): domain
// attribute'u OLMADAN bu çerez host-only olur - web (koqep.com) ve API
// (api.koqep.com) farklı HOSTNAME'lerde olduğu için document.cookie web
// sayfasından bunu asla okuyamazdı (RFC 6265 çerez eşleştirmesi port'u
// değil hostname'i baz alır - localhost:3000/3001'de AYNI hostname
// olduğundan bu bug yerel geliştirmede hiç görünmüyordu). WEB_ORIGIN'den
// (allowed-origins.ts'in www-strip deseniyle AYNI) türetilen ortak
// domain (ör. ".koqep.com") hem koqep.com hem api.koqep.com'un JS'ine
// görünür kılıyor.
export function getCsrfCookieDomain(
  webOrigin: string | undefined,
): string | undefined {
  if (!webOrigin) {
    return undefined;
  }

  let hostname: string;
  try {
    hostname = new URL(webOrigin).hostname;
  } catch {
    return undefined;
  }

  // localhost/IP/tek-etiketli hostname'lerde Domain attribute anlamsız -
  // host-only (mevcut, yerel/CI davranışı) korunur.
  const isIpLike = /^[\d.]+$/.test(hostname) || hostname.includes(':');
  if (hostname === 'localhost' || isIpLike || !hostname.includes('.')) {
    return undefined;
  }

  const canonical = hostname.startsWith('www.')
    ? hostname.slice('www.'.length)
    : hostname;
  return `.${canonical}`;
}

// path:'/' - CSRF double-submit deseni JS'in bu cookie'yi document.cookie
// ile HER sayfadan okuyup X-Csrf-Token header'ına eklemesini gerektiriyor;
// path:'/auth' verilirse (refresh cookie'siyle aynı) kullanıcı /'dayken bu
// cookie JS'e hiç görünmez, header hiçbir zaman gönderilemez.
export function buildCsrfCookieOptions(
  webOrigin: string | undefined,
): CookieOptions {
  const domain = getCsrfCookieDomain(webOrigin);
  return {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
    ...(domain ? { domain } : {}),
  };
}

export function buildClearCookieOptions(base: CookieOptions): CookieOptions {
  return { ...base, maxAge: 0 };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}
