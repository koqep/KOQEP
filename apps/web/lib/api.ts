const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// M7a Slice A (ADR-0002'yi bitirmek): refresh token + CSRF eşleştirme
// değeri artık httpOnly cookie'de - JS bunları hiç okumuyor/taşımıyor.
// credentials:'include' her istekte bu cookie'lerin (apps/web'in farklı
// origin'inden) gönderilip alınabilmesi için gerekli.
const CSRF_COOKIE_NAME = "koqep_csrf";

// Backend'in INVALID_TOKEN_CODE'uyla (auth.service.ts) AYNI değer - SADECE
// "access token'ın kendisi geçersiz/süresi dolmuş" anlamına gelen 401'lerde
// set ediliyor, TOTP_REQUIRED/INVALID_CREDENTIALS gibi domain 401'lerinde
// DEĞİL. Retry mantığı bu yüzden çıplak status===401 yerine bu code'u
// kontrol ediyor - aksi halde ör. "yanlış TOTP kodu" hatası sessizce
// "oturum yenilenemedi" hatasına dönüşürdü.
const INVALID_TOKEN_CODE = "INVALID_TOKEN";

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function sendJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string | string[];
    };
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join(", ")
      : (errorBody.message ?? "Bir şeyler ters gitti.");
    throw new ApiError(message, response.status, errorBody.code);
  }

  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.slice(name.length + 1));
}

// Aynı sekme içinde eş-zamanlı birden fazla 401'in tek bir refresh çağrısını
// paylaşması için (single-flight) - sekmeler-arası yarış backend'in grace-
// period toleransıyla çözülüyor (bkz. AuthService.refresh), bu sadece
// gereksiz paralel çağrıları önleyen ucuz bir hijyen.
let inFlightRefresh: Promise<string> | null = null;

// page.tsx mount'ta bunu kaydeder, yenilenen access token'ı React state'ine
// yazsın diye - bu OLMADAN her interaction access token süresi (15dk)
// dolduktan sonra AYNI eski token'ı prop olarak geçmeye devam eder, her
// çağrı sonsuza dek gereksiz bir 401→refresh→tekrar-dene turu yapardı.
type AccessTokenListener = (accessToken: string) => void;
let onAccessTokenRefreshed: AccessTokenListener | null = null;

export function setAccessTokenRefreshedListener(
  listener: AccessTokenListener | null,
): void {
  onAccessTokenRefreshed = listener;
}

export async function refreshAccessToken(): Promise<string> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-Csrf-Token"] = csrfToken;
    }
    const { accessToken } = await sendJson<{ accessToken: string }>(
      "/auth/refresh",
      { method: "POST", headers, body: JSON.stringify({}) },
    );
    onAccessTokenRefreshed?.(accessToken);
    return accessToken;
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

// authedPostJson/authedGetJson: 401 alınca (süresi dolmuş access token)
// refreshAccessToken() denenir, başarılıysa orijinal istek YENİ token'la
// BİR KEZ tekrar edilir - kullanıcı aktif bir oturum ortasında sessizce
// oturumda kalır (bkz. docs/decisions/ADR-0002 Addendum).
async function authedPostJson<T>(
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const buildInit = (token: string): RequestInit => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  try {
    return await sendJson<T>(path, buildInit(accessToken));
  } catch (error) {
    if (error instanceof ApiError && error.code === INVALID_TOKEN_CODE) {
      const freshToken = await refreshAccessToken();
      return sendJson<T>(path, buildInit(freshToken));
    }
    throw error;
  }
}

async function authedGetJson<T>(path: string, accessToken: string): Promise<T> {
  const buildInit = (token: string): RequestInit => ({
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  try {
    return await sendJson<T>(path, buildInit(accessToken));
  } catch (error) {
    if (error instanceof ApiError && error.code === INVALID_TOKEN_CODE) {
      const freshToken = await refreshAccessToken();
      return sendJson<T>(path, buildInit(freshToken));
    }
    throw error;
  }
}

export async function signup(input: {
  inviteCode: string;
  email: string;
  username: string;
  password: string;
  acceptedTerms: boolean;
}): Promise<void> {
  await postJson("/auth/signup", input);
}

export async function verifyEmail(token: string): Promise<void> {
  await postJson("/auth/verify-email", { token });
}

export function login(input: {
  email: string;
  password: string;
  totpCode?: string;
}): Promise<TokenPair> {
  return postJson<TokenPair>("/auth/login", input);
}

// M7a Slice A: refresh token artık httpOnly cookie'de - parametre almıyor,
// backend cookie'den okuyor. CSRF header'ı refreshAccessToken'ınkiyle aynı
// desen (bkz. ADR-0002 Addendum).
export async function logout(): Promise<void> {
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-Csrf-Token"] = csrfToken;
  }
  await sendJson("/auth/logout", {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await postJson("/auth/password-reset/request", { email });
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  await postJson("/auth/password-reset/confirm", { token, newPassword });
}

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
}

export function setupTotp(accessToken: string): Promise<TotpSetup> {
  return authedPostJson<TotpSetup>("/auth/totp/setup", accessToken);
}

export function enableTotp(
  accessToken: string,
  totpCode: string,
): Promise<string[]> {
  return authedPostJson<string[]>("/auth/totp/enable", accessToken, {
    totpCode,
  });
}

export async function disableTotp(
  accessToken: string,
  totpCode: string,
): Promise<void> {
  await authedPostJson("/auth/totp/disable", accessToken, { totpCode });
}

export async function deleteAccount(
  accessToken: string,
  password: string,
  totpCode?: string,
): Promise<void> {
  await authedPostJson("/auth/delete-account", accessToken, {
    password,
    totpCode,
  });
}

export async function blockUser(
  accessToken: string,
  email: string,
): Promise<void> {
  await authedPostJson("/users/block", accessToken, { email });
}

export async function unblockUser(
  accessToken: string,
  email: string,
): Promise<void> {
  await authedPostJson("/users/unblock", accessToken, { email });
}

export function listBlockedUsers(accessToken: string): Promise<string[]> {
  return authedGetJson<string[]>("/users/blocked", accessToken);
}

export interface UserProfile {
  email: string;
  username: string;
  role: "user" | "moderator";
  mutedUntil: string | null;
}

export function getCurrentUser(accessToken: string): Promise<UserProfile> {
  return authedGetJson<UserProfile>("/users/me", accessToken);
}

export interface MessageEdit {
  previousContent: string;
  editedAt: string;
}

export function getMessageEditHistory(
  accessToken: string,
  roomName: string,
  messageId: string,
): Promise<MessageEdit[]> {
  return authedGetJson<MessageEdit[]>(
    `/rooms/${roomName}/messages/${messageId}/edits`,
    accessToken,
  );
}

export interface InviteDto {
  code: string;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export function listInvites(accessToken: string): Promise<InviteDto[]> {
  return authedGetJson<InviteDto[]>("/invites", accessToken);
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  lastActivityAt: string;
  status: "active" | "archived" | "deleted";
}

export function listRooms(
  accessToken: string,
  includeArchived?: boolean,
): Promise<Room[]> {
  const query = includeArchived ? "?includeArchived=true" : "";
  return authedGetJson<Room[]>(`/rooms${query}`, accessToken);
}

// M7a Slice B (ADR-0009): moderasyon paneli üyelikten bağımsız TÜM odaları
// yönetebilmeli - scope=all, listRooms'un (artık üyelik-scoped) "mine"
// çağrısından AYRI tutuluyor ki switcher'ın kodu hiç değişmesin.
export function listAllRoomsForModeration(
  accessToken: string,
  includeArchived?: boolean,
): Promise<Room[]> {
  const query = includeArchived
    ? "?scope=all&includeArchived=true"
    : "?scope=all";
  return authedGetJson<Room[]>(`/rooms${query}`, accessToken);
}

export interface RoomPage {
  rooms: Room[];
  nextCursor: string | null;
}

export function listDiscoverableRooms(
  accessToken: string,
  cursor?: string,
): Promise<RoomPage> {
  const params = new URLSearchParams({ scope: "discoverable" });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return authedGetJson<RoomPage>(`/rooms?${params.toString()}`, accessToken);
}

export function joinRoom(accessToken: string, roomId: string): Promise<Room> {
  return authedPostJson<Room>(`/rooms/${roomId}/join`, accessToken);
}

export async function leaveRoom(
  accessToken: string,
  roomId: string,
): Promise<void> {
  await authedPostJson(`/rooms/${roomId}/leave`, accessToken);
}

export function createRoom(
  accessToken: string,
  name: string,
  description?: string,
): Promise<Room> {
  return authedPostJson<Room>("/rooms", accessToken, {
    name,
    description: description || undefined,
  });
}

export async function reportMessage(
  accessToken: string,
  roomName: string,
  messageId: string,
  reason?: string,
): Promise<void> {
  await authedPostJson(
    `/rooms/${roomName}/messages/${messageId}/report`,
    accessToken,
    reason ? { reason } : undefined,
  );
}

export interface ReportSummary {
  id: string;
  createdAt: string;
  reason: string | null;
  reportedContent: string;
  reportedUsername: string | null;
  reportedUserId: string | null;
  // Backend'in 7 günlük penceresinde bu kullanıcıya karşı açılmış,
  // BİRBİRİNDEN FARKLI raporcu sayısı - tüm-zamanlar sayısı DEĞİL.
  distinctReporterCount: number;
  isFlagged: boolean;
}

export function listOpenReports(
  accessToken: string,
): Promise<ReportSummary[]> {
  return authedGetJson<ReportSummary[]>("/moderation/reports", accessToken);
}

export async function removeReportedContent(
  accessToken: string,
  reportId: string,
): Promise<void> {
  await authedPostJson(
    `/moderation/reports/${reportId}/remove-content`,
    accessToken,
  );
}

export async function dismissReport(
  accessToken: string,
  reportId: string,
): Promise<void> {
  await authedPostJson(`/moderation/reports/${reportId}/dismiss`, accessToken);
}

export async function muteUser(
  accessToken: string,
  userId: string,
  durationHours: number,
): Promise<{ mutedUntil: string }> {
  return authedPostJson(`/moderation/users/${userId}/mute`, accessToken, {
    durationHours,
  });
}

export async function unmuteUser(
  accessToken: string,
  userId: string,
): Promise<void> {
  await authedPostJson(`/moderation/users/${userId}/unmute`, accessToken);
}

export interface ModeratorRoleResult {
  id: string;
  email: string;
  role: "user" | "moderator";
}

// M7a Slice C: deleteAccount'un AYNI şifre+opsiyonel-TOTP reauth deseni -
// kalıcı bir yetki-yükseltme aksiyonu. TOTP_REQUIRED hatası ApiError.code
// üzerinden ayırt edilebiliyor (authedPostJson'ın INVALID_TOKEN_CODE
// ayrımıyla AYNI mekanizma, burada domain hatası olduğu için retry
// tetiklenmiyor).
export function assignModerator(
  accessToken: string,
  email: string,
  password: string,
  totpCode?: string,
): Promise<ModeratorRoleResult & { alreadyModerator: boolean }> {
  return authedPostJson(`/moderation/users/assign-moderator`, accessToken, {
    email,
    password,
    totpCode,
  });
}

// Reauth İSTEMİYOR - yetki azaltan yön kendi kendini iyileştiren bir hata.
export function revokeModerator(
  accessToken: string,
  email: string,
): Promise<ModeratorRoleResult & { wasNotModerator: boolean }> {
  return authedPostJson(`/moderation/users/revoke-moderator`, accessToken, {
    email,
  });
}

export function renameRoom(
  accessToken: string,
  roomId: string,
  name: string,
): Promise<Room> {
  return authedPostJson<Room>(`/moderation/rooms/${roomId}/rename`, accessToken, {
    name,
  });
}

export function archiveRoom(accessToken: string, roomId: string): Promise<Room> {
  return authedPostJson<Room>(`/moderation/rooms/${roomId}/archive`, accessToken);
}

export async function deleteRoom(
  accessToken: string,
  roomId: string,
): Promise<void> {
  await authedPostJson(`/moderation/rooms/${roomId}/delete`, accessToken);
}
