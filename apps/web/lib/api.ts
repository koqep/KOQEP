const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string | string[];
    };
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join(", ")
      : (errorBody.message ?? "Bir şeyler ters gitti.");
    throw new ApiError(message, errorBody.code);
  }

  return (await response.json()) as T;
}

export function signup(input: {
  inviteCode: string;
  email: string;
  password: string;
}): Promise<TokenPair> {
  return postJson<TokenPair>("/auth/signup", input);
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
