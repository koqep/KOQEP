// M9 Slice A: sözlük altyapısının iskeleti - kütüphane değil düz TS
// sözlük (2026-09-02 kapsam turu kararı, docs/milestones/M9-i18n.md).
// `translations`/`Dictionary` HİÇBİR mevcut bileşene bağlanmıyor - Slice D
// bileşenleri gerçek metinleriyle buraya taşıyacak. `Record<Locale,
// Dictionary>` kasıtlı - bir dilde eksik anahtar `npm run typecheck`'i
// doğrudan kırar.
// M9 Slice B: `readStoredLocale`/`storeLocale` - localStorage↔User.locale
// senkronu, AuthView.tsx (login anında ipucu) + RoomView.tsx (giriş
// sonrası ayna) tarafından kullanılıyor.

export type Locale = "en" | "tr";
export const DEFAULT_LOCALE: Locale = "en";

interface Dictionary {
  common: {
    cancel: string;
    loading: string;
  };
}

export const translations: Record<Locale, Dictionary> = {
  en: {
    common: {
      cancel: "cancel",
      loading: "loading...",
    },
  },
  tr: {
    common: {
      cancel: "vazgeç",
      loading: "yükleniyor...",
    },
  },
};

// Giriş yapmamış ziyaretçi için tek seferlik tarayıcı dili algılaması -
// localStorage'a yazma/okuma (kalıcı saklama) Slice B'nin işi, burada
// SADECE tespit.
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return navigator.language.toLowerCase().startsWith("tr")
    ? "tr"
    : DEFAULT_LOCALE;
}

// M9 Slice B: RoomView.tsx'in DRAFT_STORAGE_PREFIX'iyle AYNI "koqep:"
// önek deseni. Giriş öncesi bir önbellek - giriş sonrası SADECE
// User.locale otorite, buraya sadece AYNA olarak yazılır (RoomView.tsx'in
// bootstrap effect'i, storeLocale çağrısıyla).
const LOCALE_STORAGE_KEY = "koqep:locale";

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return value === "en" || value === "tr" ? value : null;
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
