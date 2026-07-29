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
