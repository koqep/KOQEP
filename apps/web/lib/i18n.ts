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
    // M9 Slice D2 (Ayar panelleri): AuthView + TotpSettingsView (×2) +
    // DeleteAccountView'ın PAYLAŞTIĞI - eskiden authView'a özeldi.
    authenticatorCodeLabel: string;
    // M9 Slice D2 (Ayar panelleri): AuthView + BlockedUsersView'ın
    // PAYLAŞTIĞI - eskiden authView'a özeldi.
    emailLabel: string;
    // M9 Slice D2 (Oda panelleri): AuthView + DiscoverRoomsView'ın
    // (katılma formu) PAYLAŞTIĞI - eskiden authView'a özeldi.
    // CreateRoomView'ın "password (optional)"ı FARKLI metin, kendi
    // namespace'inde kalıyor.
    passwordLabel: string;
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
    usernameLabel: string;
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
  totpSettings: {
    recoveryCodesWarning: string;
    savedIt: string;
    onDescription: string;
    turnOff: string;
    qrAlt: string;
    secretKeyHint: string;
    enable: string;
    offDescription: string;
    startSetup: string;
  };
  blockedUsers: {
    block: string;
    emptyList: string;
    unblock: string;
  };
  invite: {
    policyParagraph: string;
    emptyList: string;
    used: string;
    revoked: string;
    available: string;
  };
  deleteAccount: {
    permanentWarning: string;
    redactCheckboxLabel: string;
    currentPasswordLabel: string;
    submitButton: string;
    preConfirmParagraph: string;
    deleteButton: string;
  };
  profile: {
    joined: string;
    levelXp: string;
    xpProgressAriaLabel: string;
  };
  feedback: {
    description: string;
    writeEmail: string;
  };
  createRoom: {
    roomNameLabel: string;
    descriptionLabel: string;
    passwordLabel: string;
    nameInvalidError: string;
    passwordTooShortError: string;
    dailyLimitError: string;
    createButton: string;
  };
  discoverRooms: {
    emptyList: string;
    lastActive: string;
    passwordProtected: string;
    joinButton: string;
    joiningButton: string;
    cancelButton: string;
    showMoreButton: string;
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
      authenticatorCodeLabel: "authenticator code",
      emailLabel: "email",
      passwordLabel: "password",
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
      usernameLabel: "username",
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
    totpSettings: {
      recoveryCodesWarning:
        "These codes won't be shown again. Save them somewhere now.",
      savedIt: "saved it",
      onDescription: "Two-factor authentication is currently on.",
      turnOff: "turn off authenticator",
      qrAlt: "authenticator QR code",
      secretKeyHint:
        "secret key to enter manually into your authenticator app:",
      enable: "enable",
      offDescription: "Two-factor authentication is currently off.",
      startSetup: "start setup",
    },
    blockedUsers: {
      block: "block",
      emptyList: "you haven't blocked anyone yet",
      unblock: "unblock",
    },
    invite: {
      policyParagraph:
        "if someone you invited gets moderated (muted), one of your unused invites gets revoked; if you have no unused invites left, your next earned invite is deducted instead.",
      emptyList:
        "you haven't earned any invites yet — they'll show up here as you send messages and level up.",
      used: "used",
      revoked: "revoked",
      available: "available",
    },
    deleteAccount: {
      permanentWarning: "This is permanent.",
      redactCheckboxLabel:
        "also remove my message content (recommended) — unchecked, your messages stay visible to others, only your username is removed",
      currentPasswordLabel: "current password",
      submitButton: "permanently delete my account",
      preConfirmParagraph:
        "Deleting your account is permanent and cannot be undone. Your email, username, and password are removed entirely. You'll be able to choose whether your message content is also removed.",
      deleteButton: "delete my account",
    },
    profile: {
      joined: "joined {date}",
      levelXp: "level {level} — {xp} XP",
      xpProgressAriaLabel: "xp progress to next level",
    },
    feedback: {
      description:
        "found a bug, have an idea, or something feels off? we read every message.",
      writeEmail: "write an email",
    },
    createRoom: {
      roomNameLabel: "room name",
      descriptionLabel: "description (optional)",
      passwordLabel: "password (optional)",
      nameInvalidError: "Room name can only contain letters, numbers, - and _.",
      passwordTooShortError: "Room password must be at least {min} characters.",
      dailyLimitError: "You can create at most 1 room per day. Try again later.",
      createButton: "create",
    },
    discoverRooms: {
      emptyList: "no other active rooms to discover",
      lastActive: "last active: {relative}",
      passwordProtected: "password protected",
      joinButton: "join",
      joiningButton: "joining...",
      cancelButton: "cancel",
      showMoreButton: "show more",
    },
  },
  tr: {
    common: {
      cancel: "vazgeç",
      loading: "yükleniyor...",
      connectionError: "Bağlantı hatası. Tekrar dene.",
      backToLogin: "girişe dön",
      invalidLink: "Geçersiz bağlantı.",
      authenticatorCodeLabel: "kimlik doğrulayıcı kodu",
      emailLabel: "e-posta",
      passwordLabel: "şifre",
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
      usernameLabel: "kullanıcı adı",
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
    totpSettings: {
      recoveryCodesWarning:
        "Bu kodlar bir daha gösterilmeyecek. Şimdi bir yere kaydet.",
      savedIt: "kaydettim",
      onDescription: "İki adımlı doğrulama şu an açık.",
      turnOff: "kimlik doğrulayıcıyı kapat",
      qrAlt: "kimlik doğrulayıcı QR kodu",
      secretKeyHint:
        "kimlik doğrulayıcı uygulamana elle girmek için gizli anahtar:",
      enable: "etkinleştir",
      offDescription: "İki adımlı doğrulama şu an kapalı.",
      startSetup: "kuruluma başla",
    },
    blockedUsers: {
      block: "engelle",
      emptyList: "henüz kimseyi engellemedin",
      unblock: "engeli kaldır",
    },
    invite: {
      policyParagraph:
        "davet ettiğin biri moderasyona uğrarsa (susturulursa) kullanılmamış davetlerinden biri iptal edilir; hiç kullanılmamış daveti kalmadıysa bir sonraki kazanacağın davetten düşülür.",
      emptyList:
        "henüz hiç davet kazanmadın — mesaj gönderip seviye atladıkça burada görünecekler.",
      used: "kullanıldı",
      revoked: "iptal edildi",
      available: "kullanılabilir",
    },
    deleteAccount: {
      permanentWarning: "Bu işlem kalıcıdır.",
      redactCheckboxLabel:
        "mesaj içeriğimi de kaldır (önerilir) — işaretlemezsen mesajların başkalarına görünmeye devam eder, sadece kullanıcı adın kaldırılır",
      currentPasswordLabel: "mevcut şifre",
      submitButton: "hesabımı kalıcı olarak sil",
      preConfirmParagraph:
        "Hesabını silmek kalıcıdır ve geri alınamaz. E-postan, kullanıcı adın ve şifren tamamen kaldırılır. Mesaj içeriğinin de kaldırılıp kaldırılmayacağını seçebileceksin.",
      deleteButton: "hesabımı sil",
    },
    profile: {
      joined: "katılma tarihi {date}",
      levelXp: "seviye {level} — {xp} XP",
      xpProgressAriaLabel: "sonraki seviyeye XP ilerlemesi",
    },
    feedback: {
      description:
        "bir hata mı buldun, bir fikrin mi var, yoksa bir şeyler tuhaf mı geldi? her mesajı okuyoruz.",
      writeEmail: "e-posta yaz",
    },
    createRoom: {
      roomNameLabel: "oda adı",
      descriptionLabel: "açıklama (opsiyonel)",
      passwordLabel: "şifre (opsiyonel)",
      nameInvalidError: "Oda adı sadece harf, rakam, - ve _ içerebilir.",
      passwordTooShortError: "Oda şifresi en az {min} karakter olmalı.",
      dailyLimitError: "Günde en fazla 1 oda oluşturabilirsin. Daha sonra tekrar dene.",
      createButton: "oluştur",
    },
    discoverRooms: {
      emptyList: "keşfedilecek başka aktif oda yok",
      lastActive: "son aktivite: {relative}",
      passwordProtected: "şifreli",
      joinButton: "katıl",
      joiningButton: "katılıyor...",
      cancelButton: "vazgeç",
      showMoreButton: "daha fazla göster",
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
