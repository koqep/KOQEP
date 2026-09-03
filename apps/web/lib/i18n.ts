// M9 Slice A: sözlük altyapısının iskeleti - kütüphane değil düz TS
// sözlük (2026-09-02 kapsam turu kararı, docs/milestones/M9-i18n.md).
// M9 Slice B: `readStoredLocale`/`storeLocale` - localStorage↔User.locale
// senkronu, AuthView.tsx (login anında ipucu) + RoomView.tsx (giriş
// sonrası ayna) tarafından kullanılıyor.
// M9 Slice D1: `Dictionary` artık gerçek metin taşıyor - RoomView bir kez
// `translations[locale]`'i çözüp `dict` PROP'u olarak child'lara geçiriyor
// (t(key)-fonksiyonu YOK, TypeScript'in Record<Locale,Dictionary> eksik-
// anahtar garantisi böylece korunuyor). Bu SADECE birkaç temsili
// component'e bağlı (D1'in kapsamı) - kalan ~28 dosya D2+'ın işi.

export type Locale = "en" | "tr";
export const DEFAULT_LOCALE: Locale = "en";

export interface Dictionary {
  common: {
    cancel: string;
    loading: string;
  };
  // CenteredModal'ın paylaşılan şell'i - "KOQEP · {title}" şablonu marka
  // adı taşıdığı için değişmiyor, sadece "close" aria-label'i çevriliyor.
  centeredModal: {
    close: string;
  };
  // RoomView'ın CenteredModal'a geçirdiği panel başlıkları - TÜM 9 mevcut
  // panel + yeni "language" paneli. Panellerin KENDİ İÇERİĞİ (bu dosyaların
  // ~28'i) D2+'a kadar İngilizce kalıyor, sadece başlık çevriliyor.
  panelTitles: {
    totp: string;
    blocked: string;
    invites: string;
    deleteAccount: string;
    createRoom: string;
    discoverRooms: string;
    profile: string;
    settings: string;
    feedback: string;
    language: string;
  };
  settings: {
    twoFactorAuthentication: string;
    blocked: string;
    invites: string;
    deleteAccount: string;
    language: string;
  };
  languageSettings: {
    description: string;
    english: string;
    turkish: string;
    error: string;
  };
  accountMenu: {
    trigger: string;
    ariaLabel: string;
    profile: string;
    settings: string;
    feedback: string;
    logOut: string;
  };
  topBar: {
    openRoomList: string;
    newRoom: string;
    explore: string;
    moderation: string;
    moderationWithCount: string;
  };
  chatPanel: {
    messageCouldNotBeSent: string;
  };
}

export const translations: Record<Locale, Dictionary> = {
  en: {
    common: {
      cancel: "cancel",
      loading: "loading...",
    },
    centeredModal: {
      close: "close",
    },
    panelTitles: {
      totp: "two-factor authentication",
      blocked: "blocked",
      invites: "invites",
      deleteAccount: "delete account",
      createRoom: "new room",
      discoverRooms: "discover rooms",
      profile: "profile",
      settings: "settings",
      feedback: "feedback",
      language: "language",
    },
    settings: {
      twoFactorAuthentication: "two-factor authentication",
      blocked: "blocked",
      invites: "invites",
      deleteAccount: "delete account",
      language: "language",
    },
    languageSettings: {
      description: "Choose the language used across KOQEP.",
      english: "English",
      turkish: "Türkçe",
      error: "Connection error. Try again.",
    },
    accountMenu: {
      trigger: "account",
      ariaLabel: "account",
      profile: "profile",
      settings: "settings",
      feedback: "feedback",
      logOut: "log out",
    },
    topBar: {
      openRoomList: "open room list",
      newRoom: "+ new room",
      explore: "explore",
      moderation: "moderation",
      moderationWithCount: "moderation [{n}]",
    },
    chatPanel: {
      messageCouldNotBeSent: "Message could not be sent.",
    },
  },
  tr: {
    common: {
      cancel: "vazgeç",
      loading: "yükleniyor...",
    },
    centeredModal: {
      close: "kapat",
    },
    panelTitles: {
      totp: "iki adımlı doğrulama",
      blocked: "engellenenler",
      invites: "davetler",
      deleteAccount: "hesabı sil",
      createRoom: "yeni oda",
      discoverRooms: "odaları keşfet",
      profile: "profil",
      settings: "ayarlar",
      feedback: "geri bildirim",
      language: "dil",
    },
    settings: {
      twoFactorAuthentication: "iki adımlı doğrulama",
      blocked: "engellenenler",
      invites: "davetler",
      deleteAccount: "hesabı sil",
      language: "dil",
    },
    languageSettings: {
      description: "KOQEP genelinde kullanılacak dili seç.",
      english: "English",
      turkish: "Türkçe",
      error: "Bağlantı hatası. Tekrar dene.",
    },
    accountMenu: {
      trigger: "hesap",
      ariaLabel: "hesap",
      profile: "profil",
      settings: "ayarlar",
      feedback: "geri bildirim",
      logOut: "çıkış yap",
    },
    topBar: {
      openRoomList: "oda listesini aç",
      newRoom: "+ yeni oda",
      explore: "keşfet",
      moderation: "moderasyon",
      moderationWithCount: "moderasyon [{n}]",
    },
    chatPanel: {
      messageCouldNotBeSent: "Mesaj gönderilemedi.",
    },
  },
};

// `{ad}` yer tutucularını değiştirir - dictionary değerleri HER ZAMAN düz
// string kalır (next-intl'in ICU gücü gerekmiyor, Slice A'nın "düz
// sözlük" kararıyla aynı ruh), parametreli metinler (ör. "moderation
// [{n}]", "max {max} characters") bu fonksiyonla çözülür.
export function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

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
