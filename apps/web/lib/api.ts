const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  const response = await fetch(`${API_URL}${path}`, init);

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

async function authedPostJson<T>(
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  return sendJson<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function authedGetJson<T>(path: string, accessToken: string): Promise<T> {
  return sendJson<T>(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function signup(input: {
  inviteCode: string;
  email: string;
  username: string;
  password: string;
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

export async function logout(refreshToken: string): Promise<void> {
  await postJson("/auth/logout", { refreshToken });
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
