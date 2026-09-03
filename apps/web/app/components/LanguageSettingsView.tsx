"use client";

import { useState } from "react";
import { updateLocale, ApiError } from "../../lib/api";
import { storeLocale, type Locale, type Dictionary } from "../../lib/i18n";

interface Props {
  accessToken: string;
  initialLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
  dict: Dictionary;
}

// TotpSettingsView.tsx'in DESENİ: optimistic update YOK - önce API
// cevabı beklenir, sonra hem yerel state (buton hangisinin aktif
// olduğunu göstersin diye) hem üst seviye (RoomView'ın myProfile'ı,
// onLocaleChange callback'i üzerinden) güncellenir. Kendi dilini
// değiştirmek TOTP/silme gibi hassas bir eylem değil - reauth
// gerekmiyor (backend'in PATCH /users/me/locale'i de aynı gerekçeyle
// ek bir throttler guard taşımıyor, M9 Slice B).
export default function LanguageSettingsView({
  accessToken,
  initialLocale,
  onLocaleChange,
  dict,
}: Props) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(nextLocale: Locale) {
    if (nextLocale === locale || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateLocale(accessToken, nextLocale);
      setLocale(nextLocale);
      onLocaleChange(nextLocale);
      storeLocale(nextLocale);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.languageSettings.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-3 overflow-y-auto py-4 text-neutral-400">
      <p>{dict.languageSettings.description}</p>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => void handleSelect("en")}
          disabled={isSubmitting}
          aria-pressed={locale === "en"}
          className={
            "px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-70 " +
            (locale === "en" ? "text-neutral-200" : "text-muted hover:text-neutral-400")
          }
        >
          {locale === "en" ? "✓ " : ""}
          {dict.languageSettings.english}
        </button>
        <button
          type="button"
          onClick={() => void handleSelect("tr")}
          disabled={isSubmitting}
          aria-pressed={locale === "tr"}
          className={
            "px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-70 " +
            (locale === "tr" ? "text-neutral-200" : "text-muted hover:text-neutral-400")
          }
        >
          {locale === "tr" ? "✓ " : ""}
          {dict.languageSettings.turkish}
        </button>
      </div>
      {error && <p className="text-red-400">{error}</p>}
    </section>
  );
}
