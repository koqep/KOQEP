"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import AsciiBackground from "./AsciiBackground";
import { FEEDBACK_EMAIL } from "../../lib/contact";
import type { Dictionary } from "../../lib/i18n";

// M11b Slice E: /app'in giriş/kayıt ekranının chrome'u - LegalPageShell.tsx
// ile AYNI desen (marka bloğu + fixed ASCII arka plan + alt linkler),
// AuthView.tsx SADECE kartın (sekmeler + form) içeriğini üretir.
//
// KOQEP bloğu burada <h1> - LegalPageShell.tsx'in <div>'inin TERSİ: legal
// sayfaların KENDİ anlamlı <h1>'i vardı (iki h1 a11y kokusu olurdu), bu
// ekranın rakip bir başlığı YOK (LandingPage.tsx'teki gibi) - KOQEP tek
// semantik başlık olarak KALABİLİR.
//
// `opacity-50` ek class'ı - AsciiBackground.tsx'in KENDİ iç rgba
// opaklığının ÜSTÜNE bir CSS çarpanı, bileşene DOKUNMADAN "landing'den
// daha soluk" isteğini karşılıyor (form okunabilirliği önceliği).
export default function AuthPageShell({
  children,
  dict,
}: {
  children: ReactNode;
  dict: Dictionary;
}) {
  return (
    <>
      <AsciiBackground className="pointer-events-none fixed inset-0 h-full w-full opacity-50" />
      <main className="animate-fade-in relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-4">
        <div>
          <h1 className="text-neutral-200" style={{ letterSpacing: "0.05em" }}>
            <span className="text-lg font-bold">KOQEP</span>{" "}
            <span className="terminal-cursor inline-block h-4 w-2 bg-neutral-400 align-middle" />
          </h1>
          <p className="text-xs text-muted">{dict.authPageShell.tagline}</p>
        </div>

        {children}

        <div className="flex justify-between text-xs">
          <Link href="/" className="text-muted hover:text-neutral-400">
            <span aria-hidden="true">&lt; </span>
            {dict.authPageShell.backToHome}
          </Link>
          <a
            href={`mailto:${FEEDBACK_EMAIL}`}
            className="text-muted hover:text-neutral-400"
          >
            {dict.authPageShell.help}
          </a>
        </div>
      </main>
    </>
  );
}
