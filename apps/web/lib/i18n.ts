// M9 Slice A: sözlük altyapısının iskeleti - kütüphane değil düz TS
// sözlük (2026-09-02 kapsam turu kararı, docs/milestones/M9-i18n.md).
// Bu dosya HİÇBİR mevcut bileşene bağlanmıyor - Slice D bileşenleri
// gerçek metinleriyle buraya taşıyacak, Slice B locale'in gerçek
// algılama/saklama/senkron mantığını (User.locale + localStorage)
// kuracak. `Record<Locale, Dictionary>` kasıtlı - bir dilde eksik
// anahtar `npm run typecheck`'i doğrudan kırar.

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
