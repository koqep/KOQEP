"use client";

import { useEffect, useState } from "react";
import AuthView from "./components/AuthView";
import RoomView from "./components/RoomView";
import { refreshAccessToken, setAccessTokenRefreshedListener } from "../lib/api";

export default function Home() {
  // M7a Slice A (ADR-0002'yi bitirmek): access token hâlâ SADECE bellek-içi
  // (localStorage/sessionStorage'a hiç yazılmaz - THREAT-MODEL satır 4'teki
  // XSS blast radius'unu küçültür) ama artık sabit değil: mount'ta ve 401
  // alan her istekte httpOnly refresh-token cookie'siyle sessizce yenileniyor
  // (bkz. lib/api.ts refreshAccessToken) - sekme kapatma/reload/`/privacy`
  // gibi başka bir route'a gidip geri dönme artık oturumu düşürmüyor.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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
        <p className="text-muted">yükleniyor...</p>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <AuthView
        onAuthenticated={(tokens, nextTotpEnabled) => {
          setAccessToken(tokens.accessToken);
          setTotpEnabled(nextTotpEnabled);
        }}
      />
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
