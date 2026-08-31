"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import AsciiBackground from "./AsciiBackground";

// M11b Slice D: terms/privacy'nin (4 dosya) ortak görsel chrome'u -
// LandingPage.tsx'in marka başlığı + buton stili + ASCII arka planı
// yeniden kullanılıyor. Sayfa metni (children) server component olarak
// KALIYOR, sadece bu ince kabuk client sınırını taşıyor.
//
// Canvas burada `fixed` (LandingPage.tsx'te `absolute` idi) - legal
// sayfalar landing'in tek-ekranlık hero'sunun aksine uzun (3000-4000px),
// `absolute` ile sayfa boyunca büyüseydi çizilen hücre sayısı 4-5 kata
// çıkardı. `fixed` viewport boyutunda sabit kalıyor, sayfa altında da
// aynı ucuzlukta. `h-full w-full` ŞART - `canvas` bir "replaced element",
// `inset-0` TEK BAŞINA (width/height auto) onu viewport'a GERMEZ, kendi
// içsel 300x150 boyutunda sol-üstte bırakır (gerçek bir ekran görüntüsüyle
// bulundu).
//
// Marka bloğu bilerek <h1> DEĞİL <div> - sayfanın kendi <h1>'i (ör.
// "# kullanım şartları") tek semantik başlık olarak kalmalı, iki <h1>
// a11y/SEO kokusu olurdu (LandingPage.tsx'te KOQEP'in kendisi <h1>
// olabiliyor çünkü orada başka bir h1 yok).
interface Props {
  subtitle: string;
  lang?: "tr";
  homeLabel: string;
  switchHref: string;
  switchLabel: string;
  children: ReactNode;
}

export default function LegalPageShell({
  subtitle,
  lang,
  homeLabel,
  switchHref,
  switchLabel,
  children,
}: Props) {
  return (
    <>
      <AsciiBackground className="pointer-events-none fixed inset-0 h-full w-full" />
      <main
        lang={lang}
        className="animate-fade-in relative z-10 mx-auto max-w-2xl p-4 text-neutral-400"
      >
        <div className="mb-8">
          <div className="text-neutral-200" style={{ letterSpacing: "0.05em" }}>
            <span className="text-lg font-bold">KOQEP</span>{" "}
            <span className="terminal-cursor inline-block h-4 w-2 bg-neutral-400 align-middle" />
          </div>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>

        {children}

        <div className="mt-8 flex gap-3 text-xs">
          <Link
            href="/"
            className="bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100"
          >
            {homeLabel}
          </Link>
          <Link
            href={switchHref}
            className="border border-neutral-800 px-4 py-1.5 text-neutral-400 hover:border-neutral-600"
          >
            {switchLabel}
          </Link>
        </div>
      </main>
    </>
  );
}
