"use client";

import { useState } from "react";
import Link from "next/link";
import AsciiBackground from "./AsciiBackground";
import { FEEDBACK_EMAIL } from "../../lib/contact";

type Locale = "en" | "tr";

interface FeatureCopy {
  label: string;
  body: string;
}

interface LocaleCopy {
  subtitle: string;
  terminalLine: string;
  heading: string;
  description: string;
  features: [FeatureCopy, FeatureCopy, FeatureCopy];
  termsHref: string;
  privacyHref: string;
}

// M11b Slice A: TR/EN kutusu SADECE bu sayfanın kendi metnini + doğru
// dildeki terms/privacy linkini değiştiriyor - "log in"/"sign up"
// düğmelerinin KENDİ metni ve ötesindeki her şey (AuthView, oda arayüzü)
// her zaman İngilizce kalıyor (M9'un tam i18n altyapısı olmadan bunun
// ötesine geçmek "yarım no-op" olurdu, bkz. docs/BACKLOG.md A27 - bu
// kutu ondan farklı çünkü kapsamı gerçekten TAM, kendi sınırının dışına
// hiçbir şey vaat etmiyor). Paylaşılan bir kopya-veri modülü kod
// tabanında hiç yok (terms/page.tsx vs terms/en/page.tsx bilerek
// tamamen ayrı, kopyalanmış JSX) - o deseni buraya taşımak bu kutunun
// dar kapsam kararıyla çelişirdi, tek dosyada bir obje yeterli.
const COPY: Record<Locale, LocaleCopy> = {
  en: {
    subtitle: "text-based chat · invite-only",
    terminalLine: "$ koqep --about",
    heading: "A text-based community platform that grows by invitation.",
    description:
      "An invite-only, text-only, real-time chat for a small, deliberately niche community — no feeds, no algorithms, just a terminal and the people you were invited by.",
    features: [
      {
        label: "Invite-only entry",
        body: "No public sign-up — every account traces back to someone who vouched for you.",
      },
      {
        label: "Text-only",
        body: "No images, no voice, no video — just words, read at your own pace.",
      },
      {
        label: "No algorithm",
        body: "Nothing ranked or hidden — you see what was actually said, in order.",
      },
    ],
    termsHref: "/terms/en",
    privacyHref: "/privacy/en",
  },
  tr: {
    subtitle: "metin tabanlı sohbet · davetle",
    terminalLine: "$ koqep --hakkinda",
    heading: "Davetle büyüyen, metin tabanlı bir topluluk platformu.",
    description:
      "Küçük, bilinçli olarak niş bir topluluk için davetiye ile katılınan, metin tabanlı, gerçek zamanlı bir sohbet — akış yok, algoritma yok, sadece bir terminal ve seni davet eden insanlar.",
    features: [
      {
        label: "Davetle giriş",
        body: "Herkese açık kayıt yok — her hesap, o kişiye kefil olan birine dayanır.",
      },
      {
        label: "Sadece metin",
        body: "Görsel yok, ses yok, video yok — sadece kendi hızında okuyacağın kelimeler.",
      },
      {
        label: "Algoritma yok",
        body: "Hiçbir şey sıralanmaz ya da gizlenmez — söyleneni, sırasıyla, olduğu gibi görürsün.",
      },
    ],
    termsHref: "/terms",
    privacyHref: "/privacy",
  },
};

const localeButtonClassName =
  "px-2 py-0.5 text-xs hover:text-neutral-200";

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const copy = COPY[locale];

  return (
    <div className="relative min-h-dvh">
      <AsciiBackground className="pointer-events-none absolute inset-0 h-full w-full" />
      <div
        // WCAG 3.1.2: kök <html lang="en"> (A15) - varsayılan EN render'da
        // override GEREKMİYOR, sadece TR seçilince bu alt-ağaç lang="tr"
        // alıyor (LandingIntro.tsx'in ESKİ, artık geçersiz yönünün TERSİ).
        lang={locale === "tr" ? "tr" : undefined}
        className="animate-fade-in relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col gap-12 p-4"
      >
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-neutral-200" style={{ letterSpacing: "0.05em" }}>
              <span className="text-lg font-bold">KOQEP</span>{" "}
              <span className="terminal-cursor inline-block h-4 w-2 bg-neutral-400 align-middle" />
            </h1>
            <p className="text-xs text-muted">{copy.subtitle}</p>
          </div>
          <div
            role="group"
            aria-label="language"
            className="flex shrink-0 border border-neutral-800"
          >
            <button
              type="button"
              aria-pressed={locale === "tr"}
              onClick={() => setLocale("tr")}
              className={
                localeButtonClassName +
                " border-r border-neutral-800 " +
                (locale === "tr" ? "text-neutral-200" : "text-muted")
              }
            >
              TR
            </button>
            <button
              type="button"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
              className={
                localeButtonClassName +
                " " +
                (locale === "en" ? "text-neutral-200" : "text-muted")
              }
            >
              EN
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-muted">{copy.terminalLine}</p>
          <h2 className="text-2xl text-neutral-200">{copy.heading}</h2>
          <p className="text-muted">{copy.description}</p>
          <div className="mt-2 flex gap-3">
            <Link
              href="/app"
              className="bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100"
            >
              <span aria-hidden="true">&gt; </span>log in
            </Link>
            <Link
              href="/app?mode=signup"
              className="border border-neutral-800 px-4 py-1.5 text-neutral-400 hover:border-neutral-600"
            >
              <span aria-hidden="true">+ </span>sign up
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {copy.features.map((feature, index) => (
            <div
              key={feature.label}
              className="border border-neutral-800 p-3"
            >
              <p className="text-xs text-muted">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 text-neutral-200">{feature.label}</p>
              <p className="mt-1 text-xs text-muted">{feature.body}</p>
            </div>
          ))}
        </div>

        <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
          <Link href={copy.privacyHref} className="hover:text-neutral-400">
            privacy policy
          </Link>
          <Link href={copy.termsHref} className="hover:text-neutral-400">
            terms of service
          </Link>
          <a
            href={`mailto:${FEEDBACK_EMAIL}?subject=KOQEP%20support`}
            className="hover:text-neutral-400"
          >
            contact
          </a>
          <span>© 2026 KOQEP</span>
        </footer>
      </div>
    </div>
  );
}
