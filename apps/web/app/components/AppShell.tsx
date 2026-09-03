"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthPageShell from "./AuthPageShell";
import AuthView from "./AuthView";
import RoomView from "./RoomView";
import { refreshAccessToken, setAccessTokenRefreshedListener } from "../../lib/api";
import {
  readStoredLocale,
  detectBrowserLocale,
  translations,
} from "../../lib/i18n";

// M11b Slice A: "/" artık saf bir pazarlama landing'i (LandingPage.tsx) -
// bu dosya bugüne kadar app/page.tsx'te yaşayan TÜM bootstrap/auth/oda
// mantığını DEĞİŞTİRMEDEN taşıyor, SADECE "/app" route'una. `?mode=signup`
// ile gelen bir bağlantı (landing'in "sign up" butonu) AuthView'ı doğrudan
// kayıt modunda açar - useSearchParams App Router'da bir Suspense sınırı
// gerektirdiği için üst page.tsx bunu <Suspense> ile sarmalıyor (reset-
// password/page.tsx'in AYNI deseni).
export default function AppShell() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : undefined;

  // M7a Slice A (ADR-0002'yi bitirmek): access token hâlâ SADECE bellek-içi
  // (localStorage/sessionStorage'a hiç yazılmaz - THREAT-MODEL satır 4'teki
  // XSS blast radius'unu küçültür) ama artık sabit değil: mount'ta ve 401
  // alan her istekte httpOnly refresh-token cookie'siyle sessizce yenileniyor
  // (bkz. lib/api.ts refreshAccessToken) - sekme kapatma/reload/`/privacy`
  // gibi başka bir route'a gidip geri dönme artık oturumu düşürmüyor.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // M9 Slice D2 (Dalga A): TEK locale-çözümleme noktası - giriş öncesi
  // ekranların (AuthPageShell/AuthView) hepsi buradan `dict` alıyor.
  // Render gövdesinde (state DEĞİL) - ucuz senkron localStorage/navigator
  // okuması, RoomView'ın kendi authoritative (User.locale'den türeyen)
  // dict'ini ETKİLEMİYOR (giriş sonrası tamamen bağımsız, D1'den beri).
  const locale = readStoredLocale() ?? detectBrowserLocale();
  const dict = translations[locale];

  useEffect(() => {
    setAccessTokenRefreshedListener(setAccessToken);
    return () => setAccessTokenRefreshedListener(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    refreshAccessToken()
      .then((token) => {
        if (!cancelled) {
          setAccessToken(token);
        }
      })
      .catch(() => {
        // Geçerli bir refresh-token cookie'si yok (taze ziyaretçi ya da
        // süresi dolmuş) - AuthView'a düşülür, hata sessizce yutulur.
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isBootstrapping) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <p className="text-muted">{dict.common.loading}</p>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <AuthPageShell dict={dict}>
        <AuthView
          initialMode={initialMode}
          dict={dict}
          locale={locale}
          onAuthenticated={(tokens, nextTotpEnabled) => {
            setAccessToken(tokens.accessToken);
            setTotpEnabled(nextTotpEnabled);
          }}
        />
      </AuthPageShell>
    );
  }

  return (
    <RoomView
      accessToken={accessToken}
      initialTotpEnabled={totpEnabled}
      onLoggedOut={() => setAccessToken(null)}
    />
  );
}
