"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "../../lib/api";
import { readStoredLocale, detectBrowserLocale, translations } from "../../lib/i18n";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");

  // M9 Slice D2 (Dalga A): ResetPasswordView.tsx'in AYNI deseni - kendi
  // route'u, AppShell zincirinin dışı.
  const locale = readStoredLocale() ?? detectBrowserLocale();
  const dict = translations[locale];

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch(() => {
        // Backend'in bu uç nokta için tek gerçek hata durumu var
        // (geçersiz/süresi dolmuş/kullanılmış token) - mesajını olduğu
        // gibi göstermek yerine sabit bir metin kullanıyoruz, code/message
        // hiç okunmuyor (bilinçli tasarım, M9 Slice D2'de de DEĞİŞMEDİ).
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">{dict.common.invalidLink}</p>
        <Link href="/app" className="mt-4 text-muted hover:text-neutral-400">
          {dict.common.backToLogin}
        </Link>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">{dict.verifyEmail.successMessage}</p>
        <Link href="/app" className="mt-4 text-muted hover:text-neutral-400">
          {dict.common.backToLogin}
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-red-400">{dict.verifyEmail.errorMessage}</p>
        <Link href="/app" className="mt-4 text-muted hover:text-neutral-400">
          {dict.common.backToLogin}
        </Link>
      </main>
    );
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <p className="text-neutral-400">{dict.verifyEmail.verifying}</p>
    </main>
  );
}
