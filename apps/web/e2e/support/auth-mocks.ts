import type { Page } from "@playwright/test";

// M7a Slice A (ADR-0002'yi bitirmek): bu repodaki İLK paylaşılan Playwright
// yardımcı modülü. Öncesinde her spec dosyası kendi page.route mock'unu
// kopyalayıp yapıştırıyordu (mockRoomEndpoints bile 5 ayrı dosyada aynen
// tekrarlanmıştı) - bir auth-akışı değişikliği (önce M6 Slice A'nın
// acceptedTerms checkbox'ı, şimdi bu) HER seferinde onlarca dosyaya
// dokunmayı gerektiriyordu. Artık auth-akışına dokunan bir değişiklik
// SADECE bu dosyayı güncellemeyi gerektiriyor.

export interface AuthMockTokens {
  accessToken?: string;
  refreshToken?: string;
}

// page.tsx artık mount'ta /auth/refresh'i sessizce dener (httpOnly cookie
// ile oturum kalıcılığı, bkz. lib/api.ts refreshAccessToken) - bu çağrı
// HER testte tetikleniyor, mocklanmazsa gerçek ağa düşer/asılı kalır.
// Login'i BAŞARILI ya da BAŞARISIZ mock'layan her test bunu (doğrudan ya
// da mockAuthSuccess üzerinden dolaylı olarak) çağırmalı.
export async function mockAuthRefreshUnavailable(page: Page): Promise<void> {
  await page.route("**/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
}

export async function mockAuthSuccess(
  page: Page,
  tokens: AuthMockTokens = {},
): Promise<void> {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: tokens.accessToken ?? "fake-access-token",
        refreshToken: tokens.refreshToken ?? "fake-refresh-token",
      },
    }),
  );
  await mockAuthRefreshUnavailable(page);
}

export async function mockRoomEndpoints(page: Page): Promise<void> {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
}
