import Link from "next/link";

// M7a Slice G: yeni bileşen, M2 Slice G kararı gereği İngilizce (mevcut
// AuthView Türkçe kalıyor - aynı ekranda bilinçli, geçici bir iki-dillilik,
// BACKLOG B16 tetiklenince ikisi birlikte çevrilecek). WCAG 3.1.2 gereği
// kök eleman lang="en" taşıyor (root <html lang="tr"> içinde alt-ağaç
// işaretleme, DeleteAccountView.tsx/VerifyEmailView.tsx'in aynı deseni).
export default function LandingIntro() {
  return (
    <div lang="en" className="flex flex-col gap-3 text-neutral-400">
      <h1 className="text-neutral-200">
        <span className="text-muted">#</span> KOQEP
      </h1>
      <p>
        An invite-only, text-only, real-time chat for a small, deliberately
        niche community — no feeds, no algorithms, just a terminal and the
        people you were invited by.
      </p>
      <p className="text-xs">
        <Link href="/terms/en" className="text-muted hover:text-neutral-400">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy/en" className="text-muted hover:text-neutral-400">
          Privacy
        </Link>
      </p>
    </div>
  );
}
