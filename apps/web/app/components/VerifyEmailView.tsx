"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "../../lib/api";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");

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
        // gibi göstermek yerine sabit bir İngilizce metin kullanıyoruz,
        // bu sayfa Slice G'den beri İngilizce (backend mesajları henüz
        // değil).
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <main
        lang="en"
        className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4"
      >
        <p className="text-neutral-400">Invalid link.</p>
        <Link href="/" className="mt-4 text-muted hover:text-neutral-400">
          back to login
        </Link>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main
        lang="en"
        className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4"
      >
        <p className="text-neutral-400">
          Your email is verified. You can log in now.
        </p>
        <Link href="/" className="mt-4 text-muted hover:text-neutral-400">
          back to login
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main
        lang="en"
        className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4"
      >
        <p className="text-red-400">
          This link is invalid or has expired.
        </p>
        <Link href="/" className="mt-4 text-muted hover:text-neutral-400">
          back to login
        </Link>
      </main>
    );
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <p className="text-neutral-400">verifying...</p>
    </main>
  );
}
