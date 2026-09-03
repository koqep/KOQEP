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
    // M9 Slice D2 (Dalga A): AuthView/ResetPasswordView'ın PAYLAŞTIĞI
    // fallback + AuthView/ResetPasswordView/VerifyEmailView'ın (3 dosya)
    // BİREBİR aynı metinleri - kopya yerine tek sözlük girdisi.
    connectionError: string;
    backToLogin: string;
    invalidLink: string;
  };
  authPageShell: {
    tagline: string;
    backToHome: string;
    help: string;
  };
  authView: {
    logIn: string;
    signUp: string;
    send: string;
    promptSignUp: string;
    promptResetPassword: string;
    promptLogIn: string;
    inviteCodeLabel: string;
    inviteCodeHelp: string;
    emailLabel: string;
    usernameLabel: string;
    passwordLabel: string;
    authenticatorCodeLabel: string;
    termsPrefix: string;
    termsLink: string;
    termsAnd: string;
    privacyLink: string;
    forgotPassword: string;
    resetRequestedMessage: string;
    signupCompleteMessage: string;
  };
  resetPassword: {
    title: string;
    passwordLabel: string;
    successMessage: string;
    submitButton: string;
  };
  verifyEmail: {
    successMessage: string;
    errorMessage: string;
    verifying: string;
  };
  // Opsiyonel tüketim (bkz. PasswordInput.tsx) - 6 çağırandan sadece
  // 2'si (AuthView, ResetPasswordView) bu dalgada dict geçiyor, diğer 4
  // (D3/D4/D6'nın işi) `dict` vermeden bugünkü İngilizce fallback'e düşer.
  passwordInput: {
    hide: string;
    show: string;
    hidePassword: string;
    showPassword: string;
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
      connectionError: "Connection error. Try again.",
      backToLogin: "back to login",
      invalidLink: "Invalid link.",
    },
    authPageShell: {
      tagline: "text-based chat · invite-only",
      backToHome: "back to home",
      help: "help",
    },
    authView: {
      logIn: "log in",
      signUp: "sign up",
      send: "send",
      promptSignUp: "$ sign up",
      promptResetPassword: "$ reset password",
      promptLogIn: "$ log in",
      inviteCodeLabel: "invite code",
      inviteCodeHelp: "Ask someone already on KOQEP for an invite code.",
      emailLabel: "email",
      usernameLabel: "username",
      passwordLabel: "password",
      authenticatorCodeLabel: "authenticator code",
      termsPrefix: "I have read and accept the",
      termsLink: "Terms of Service",
      termsAnd: "and",
      privacyLink: "Privacy Policy",
      forgotPassword: "forgot your password?",
      resetRequestedMessage:
        "If this email is registered, a reset link has been sent.",
      signupCompleteMessage:
        "Click the link sent to your email to complete your signup.",
    },
    resetPassword: {
      title: "new password",
      passwordLabel: "new password",
      successMessage: "Your password has been updated.",
      submitButton: "update password",
    },
    verifyEmail: {
      successMessage: "Your email is verified. You can log in now.",
      errorMessage: "This link is invalid or has expired.",
      verifying: "verifying...",
    },
    passwordInput: {
      hide: "hide",
      show: "show",
      hidePassword: "hide password",
      showPassword: "show password",
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
      connectionError: "Bağlantı hatası. Tekrar dene.",
      backToLogin: "girişe dön",
      invalidLink: "Geçersiz bağlantı.",
    },
    authPageShell: {
      tagline: "sadece metin · davetle katılım",
      backToHome: "ana sayfaya dön",
      help: "yardım",
    },
    authView: {
      logIn: "giriş yap",
      signUp: "kayıt ol",
      send: "gönder",
      promptSignUp: "$ kayıt ol",
      promptResetPassword: "$ şifreyi sıfırla",
      promptLogIn: "$ giriş yap",
      inviteCodeLabel: "davet kodu",
      inviteCodeHelp: "KOQEP'te zaten olan birinden davet kodu iste.",
      emailLabel: "e-posta",
      usernameLabel: "kullanıcı adı",
      passwordLabel: "şifre",
      authenticatorCodeLabel: "kimlik doğrulayıcı kodu",
      termsPrefix: "Şunu okudum ve kabul ediyorum:",
      termsLink: "Kullanım Şartları",
      termsAnd: "ve",
      privacyLink: "Gizlilik Politikası",
      forgotPassword: "şifreni mi unuttun?",
      resetRequestedMessage:
        "Bu e-posta kayıtlıysa, bir sıfırlama bağlantısı gönderildi.",
      signupCompleteMessage:
        "Kaydını tamamlamak için e-postana gönderilen bağlantıya tıkla.",
    },
    resetPassword: {
      title: "yeni şifre",
      passwordLabel: "yeni şifre",
      successMessage: "Şifren güncellendi.",
      submitButton: "şifreyi güncelle",
    },
    verifyEmail: {
      successMessage: "E-postan doğrulandı. Şimdi giriş yapabilirsin.",
      errorMessage: "Bu bağlantı geçersiz veya süresi dolmuş.",
      verifying: "doğrulanıyor...",
    },
    passwordInput: {
      hide: "gizle",
      show: "göster",
      hidePassword: "şifreyi gizle",
      showPassword: "şifreyi göster",
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
