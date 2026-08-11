"use client";

import { useState } from "react";
import AuthView from "./components/AuthView";
import RoomView from "./components/RoomView";
import type { TokenPair } from "../lib/api";

export default function Home() {
  // Bilerek sadece bellek-içi (React state) - localStorage/sessionStorage'a
  // hiç yazılmaz: ADR-0002'nin nihai hedefi httpOnly cookie (JS erişemez),
  // bellek-içi buna uyumlu bir ara adım - THREAT-MODEL satır 4'teki XSS
  // riskinin blast radius'unu küçültür. Bedeli: reload'da oturum kaybolur.
  const [tokens, setTokens] = useState<TokenPair | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  // GEÇİCİ - Sentry entegrasyonunu production'da doğrulamak için, bu tanı
  // doğrulanınca KALDIRILACAK. useSearchParams gerektirmesin diye (Suspense
  // sınırı istemez) doğrudan window.location.search okunuyor - sadece
  // client'ta render sonrası çalışır, SSR geçişinde window yok, hiç
  // atlanmaz. Render-zamanı bir throw - app/global-error.tsx'in kök error
  // boundary'sini (instrumentation-client.ts'in Sentry.init'iyle birlikte)
  // gerçekten tetikleyip tetiklemediğini kanıtlar. Obscure query param adı
  // kazara tetiklenmesin diye.
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(
      "sentryDebugTrigger",
    ) === "koqep-m6-slice-b-verify"
  ) {
    throw new Error("Sentry entegrasyon doğrulaması - geçici tetikleyici.");
  }

  if (!tokens) {
    return (
      <AuthView
        onAuthenticated={(nextTokens, nextTotpEnabled) => {
          setTokens(nextTokens);
          setTotpEnabled(nextTotpEnabled);
        }}
      />
    );
  }

  return (
    <RoomView
      accessToken={tokens.accessToken}
      refreshToken={tokens.refreshToken}
      initialTotpEnabled={totpEnabled}
      onLoggedOut={() => setTokens(null)}
    />
  );
}
