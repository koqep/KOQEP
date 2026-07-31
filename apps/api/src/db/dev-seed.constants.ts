export const DEV_USER_EMAIL = 'dev@koqep.local';
export const DEV_USER_USERNAME = 'dev';
export const DEV_USER_PASSWORD = 'dev-local-only-password';

// Sadece apps/web/e2e-fullstack/delete-account.spec.ts tarafından kullanılır
// - DEV_USER_EMAIL'i silmek diğer fullstack testlerini (message-editing,
// message-round-trip, room-switching) kırar, bu yüzden ayrı, sarf edilebilir
// bir kullanıcı (M2.5 Slice C).
export const DEV_USER_2_EMAIL = 'dev2@koqep.local';
export const DEV_USER_2_USERNAME = 'dev2';
export const DEV_USER_2_PASSWORD = 'dev-local-only-password-2';

export const DEV_INVITE_CODES = [
  'DEV-INVITE-1',
  'DEV-INVITE-2',
  'DEV-INVITE-3',
  'DEV-INVITE-4',
  'DEV-INVITE-5',
];
