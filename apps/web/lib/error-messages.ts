// M9 Slice D1: backend'in `code` alanını kullanıcının seçtiği dilde bir
// mesaja çeviren TEK yer - REST (apps/api/src genelinde) VE WS
// (messages.gateway.ts/ws-throttler.guard.ts) AYNI sözlükten besleniyor,
// çünkü 3 code (RATE_LIMITED/ROOM_ARCHIVED/ROOM_ACCESS_DENIED) ikisi
// arasında BİREBİR paylaşılıyor (M9 Slice C'nin çapraz-transport
// tutarlılık kararı). Liste 2026-09-03'te apps/api/src'te taze bir
// grep'le (`code: 'X'` / `code: X_CODE`) çıkarıldı - 41 REST + 3
// WS-özel (MESSAGE_TOO_LONG/MESSAGE_INVALID_CONTENT/MUTED) = 44
// benzersiz kod. MESSAGE_TOO_LONG'un `{max}` yer tutucusu VAR - diğer
// TÜM kodlar parametresiz düz metin (bkz. i18n.ts'in interpolate'i).

import type { Locale } from "./i18n";

export type ErrorCode =
  | "ANNOUNCEMENT_INVALID_CHARACTERS"
  | "CANNOT_BLOCK_SELF"
  | "CANNOT_REPORT_OWN_MESSAGE"
  | "CORE_ROOM_ACTION_FORBIDDEN"
  | "CORE_ROOM_LEAVE_FORBIDDEN"
  | "CSRF_VALIDATION_FAILED"
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "INVALID_CRON_SECRET"
  | "INVALID_REFRESH_TOKEN"
  | "INVALID_RESET_TOKEN"
  | "INVALID_TOKEN"
  | "INVALID_VERIFICATION_TOKEN"
  | "INVITE_ALREADY_USED"
  | "INVITE_NOT_FOUND"
  | "INVITE_NO_LONGER_VALID"
  | "LAST_MODERATOR_CANNOT_REVOKE_SELF"
  | "MESSAGE_DELETE_FORBIDDEN"
  | "MESSAGE_EDIT_FORBIDDEN"
  | "MESSAGE_HISTORY_FORBIDDEN"
  | "MESSAGE_INVALID_CONTENT"
  | "MESSAGE_NOT_FOUND"
  | "MESSAGE_TOO_LONG"
  | "MODERATOR_ROLE_REQUIRED"
  | "MUTED"
  | "PASSWORD_BREACHED"
  | "RATE_LIMITED"
  | "REPORTED_MESSAGE_GONE"
  | "REPORT_ALREADY_RESOLVED"
  | "REPORT_NOT_FOUND"
  | "ROOM_ACCESS_DENIED"
  | "ROOM_ARCHIVED"
  | "ROOM_NAME_TAKEN"
  | "ROOM_NOT_ACTIVE"
  | "ROOM_NOT_ARCHIVED"
  | "ROOM_NOT_FOUND"
  | "ROOM_PASSWORD_INCORRECT"
  | "TOTP_ALREADY_DISABLED"
  | "TOTP_INVALID_CODE"
  | "TOTP_REQUIRED"
  | "TOTP_SETUP_NOT_STARTED"
  | "USERNAME_TAKEN"
  | "USER_NOT_FOUND";

export const ERROR_MESSAGES: Record<Locale, Record<ErrorCode, string>> = {
  en: {
    ANNOUNCEMENT_INVALID_CHARACTERS: "Announcement contains invalid characters.",
    CANNOT_BLOCK_SELF: "You can't block yourself.",
    CANNOT_REPORT_OWN_MESSAGE: "You can't report your own message.",
    CORE_ROOM_ACTION_FORBIDDEN: "This action isn't allowed on core rooms.",
    CORE_ROOM_LEAVE_FORBIDDEN: "You can't leave a core room.",
    CSRF_VALIDATION_FAILED: "Security check failed. Please try again.",
    EMAIL_NOT_VERIFIED:
      "Check your inbox — you need to verify your email before signing in.",
    EMAIL_TAKEN: "This email is already registered.",
    INVALID_CREDENTIALS: "Incorrect email or password.",
    INVALID_CRON_SECRET: "Invalid cron secret.",
    INVALID_REFRESH_TOKEN: "Your session has expired. Please log in again.",
    INVALID_RESET_TOKEN: "This reset link is invalid or has expired.",
    INVALID_TOKEN: "Your session has expired. Please log in again.",
    INVALID_VERIFICATION_TOKEN:
      "This verification link is invalid or has expired.",
    INVITE_ALREADY_USED: "This invite code has already been used.",
    INVITE_NOT_FOUND: "Invite code not found.",
    INVITE_NO_LONGER_VALID: "This invite code is no longer valid.",
    LAST_MODERATOR_CANNOT_REVOKE_SELF:
      "The last moderator can't remove their own role.",
    MESSAGE_DELETE_FORBIDDEN: "You can only delete your own message.",
    MESSAGE_EDIT_FORBIDDEN: "You can only edit your own message.",
    MESSAGE_HISTORY_FORBIDDEN:
      "You don't have permission to view this message's edit history.",
    MESSAGE_INVALID_CONTENT: "Your message contains invalid characters.",
    MESSAGE_NOT_FOUND: "Message not found.",
    MESSAGE_TOO_LONG: "Message too long (max {max} characters).",
    MODERATOR_ROLE_REQUIRED: "This action requires moderator permissions.",
    MUTED: "You're muted, you can't send messages right now.",
    PASSWORD_BREACHED:
      "This password has appeared in a data breach. Please choose another.",
    RATE_LIMITED: "You're sending requests too fast, slow down.",
    REPORTED_MESSAGE_GONE: "The message this report refers to no longer exists.",
    REPORT_ALREADY_RESOLVED: "This report has already been resolved.",
    REPORT_NOT_FOUND: "Report not found.",
    ROOM_ACCESS_DENIED: "You need to join this room first.",
    ROOM_ARCHIVED: "This room is archived, read-only.",
    ROOM_NAME_TAKEN: "A room with this name already exists.",
    ROOM_NOT_ACTIVE: "Only an active room can be archived.",
    ROOM_NOT_ARCHIVED: "Only an archived room can be deleted.",
    ROOM_NOT_FOUND: "Room not found.",
    ROOM_PASSWORD_INCORRECT: "Incorrect password.",
    TOTP_ALREADY_DISABLED: "The authenticator is already off.",
    TOTP_INVALID_CODE: "Invalid authenticator code.",
    TOTP_REQUIRED: "A verification code is required.",
    TOTP_SETUP_NOT_STARTED: "You need to start authenticator setup first.",
    USERNAME_TAKEN: "This username is already taken.",
    USER_NOT_FOUND: "User not found.",
  },
  tr: {
    ANNOUNCEMENT_INVALID_CHARACTERS: "Duyuru geçersiz karakterler içeriyor.",
    CANNOT_BLOCK_SELF: "Kendini engelleyemezsin.",
    CANNOT_REPORT_OWN_MESSAGE: "Kendi mesajını raporlayamazsın.",
    CORE_ROOM_ACTION_FORBIDDEN: "Çekirdek odalar üzerinde bu işlem yapılamaz.",
    CORE_ROOM_LEAVE_FORBIDDEN: "Çekirdek bir odadan ayrılamazsın.",
    CSRF_VALIDATION_FAILED: "Güvenlik doğrulaması başarısız. Tekrar dene.",
    EMAIL_NOT_VERIFIED:
      "Gelen kutunu kontrol et — giriş yapmadan önce e-postanı doğrulaman gerekiyor.",
    EMAIL_TAKEN: "Bu e-posta zaten kayıtlı.",
    INVALID_CREDENTIALS: "E-posta veya şifre hatalı.",
    INVALID_CRON_SECRET: "Geçersiz cron secret.",
    INVALID_REFRESH_TOKEN: "Oturumun sona erdi. Lütfen tekrar giriş yap.",
    INVALID_RESET_TOKEN: "Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
    INVALID_TOKEN: "Oturumun sona erdi. Lütfen tekrar giriş yap.",
    INVALID_VERIFICATION_TOKEN:
      "Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.",
    INVITE_ALREADY_USED: "Bu davet kodu zaten kullanılmış.",
    INVITE_NOT_FOUND: "Davet kodu bulunamadı.",
    INVITE_NO_LONGER_VALID: "Bu davet kodu artık geçerli değil.",
    LAST_MODERATOR_CANNOT_REVOKE_SELF:
      "Son moderatör kendi yetkisini kaldıramaz.",
    MESSAGE_DELETE_FORBIDDEN: "Sadece kendi mesajını silebilirsin.",
    MESSAGE_EDIT_FORBIDDEN: "Sadece kendi mesajını düzenleyebilirsin.",
    MESSAGE_HISTORY_FORBIDDEN:
      "Bu mesajın düzenleme geçmişini görme yetkin yok.",
    MESSAGE_INVALID_CONTENT: "Mesajın geçersiz karakterler içeriyor.",
    MESSAGE_NOT_FOUND: "Mesaj bulunamadı.",
    MESSAGE_TOO_LONG: "Mesaj çok uzun (en fazla {max} karakter).",
    MODERATOR_ROLE_REQUIRED: "Bu işlem için moderatör yetkisi gerekli.",
    MUTED: "Susturuldun, şu anda mesaj gönderemezsin.",
    PASSWORD_BREACHED:
      "Bu şifre bir veri sızıntısında bulundu. Lütfen başka bir şifre seç.",
    RATE_LIMITED: "Çok fazla istek gönderdin, biraz sonra tekrar dene.",
    REPORTED_MESSAGE_GONE: "Bu raporun bağlı olduğu mesaj artık mevcut değil.",
    REPORT_ALREADY_RESOLVED: "Bu rapor zaten çözülmüş.",
    REPORT_NOT_FOUND: "Rapor bulunamadı.",
    ROOM_ACCESS_DENIED: "Önce bu odaya katılman gerekiyor.",
    ROOM_ARCHIVED: "Bu oda arşivlenmiş, sadece okunabilir.",
    ROOM_NAME_TAKEN: "Bu isimde bir oda zaten var.",
    ROOM_NOT_ACTIVE: "Sadece aktif bir oda arşivlenebilir.",
    ROOM_NOT_ARCHIVED: "Sadece arşivlenmiş bir oda silinebilir.",
    ROOM_NOT_FOUND: "Oda bulunamadı.",
    ROOM_PASSWORD_INCORRECT: "Şifre hatalı.",
    TOTP_ALREADY_DISABLED: "Kimlik doğrulayıcı zaten kapalı.",
    TOTP_INVALID_CODE: "Geçersiz kimlik doğrulayıcı kodu.",
    TOTP_REQUIRED: "Bir doğrulama kodu gerekli.",
    TOTP_SETUP_NOT_STARTED: "Önce kimlik doğrulayıcı kurulumu başlatılmalı.",
    USERNAME_TAKEN: "Bu kullanıcı adı zaten alınmış.",
    USER_NOT_FOUND: "Kullanıcı bulunamadı.",
  },
};

export function translateErrorCode(
  code: string | undefined,
  locale: Locale,
): string | undefined {
  if (!code) return undefined;
  const table = ERROR_MESSAGES[locale];
  return code in table ? table[code as ErrorCode] : undefined;
}
