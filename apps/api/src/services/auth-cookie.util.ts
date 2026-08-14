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

// path:'/' - CSRF double-submit deseni JS'in bu cookie'yi document.cookie
// ile HER sayfadan okuyup X-Csrf-Token header'ına eklemesini gerektiriyor;
// path:'/auth' verilirse (refresh cookie'siyle aynı) kullanıcı /'dayken bu
// cookie JS'e hiç görünmez, header hiçbir zaman gönderilemez.
export function buildCsrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

export function buildClearCookieOptions(base: CookieOptions): CookieOptions {
  return { ...base, maxAge: 0 };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}
