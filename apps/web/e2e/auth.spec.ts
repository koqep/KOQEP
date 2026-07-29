import { test, expect } from "@playwright/test";

async function mockRoomEndpoints(page: import("@playwright/test").Page) {
  await page.route("**/rooms", (route) =>
    route.fulfill({ json: [{ id: "room-1", name: "test-oda" }] }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
}

test("kayit_basarili_olunca_oda_ekranina_gecer", async ({ page }) => {
  await page.route("**/auth/signup", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByRole("button", { name: "hesabın yok mu? kayıt ol" }).click();

  await page.getByLabel("davet kodu").fill("DEV-INVITE-1");
  await page.getByLabel("e-posta").fill("yeni@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "kayıt ol" }).click();

  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});

test("yanlis_bilgiler_hata_gosterir_totp_alani_gorunmez", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "INVALID_CREDENTIALS",
        message: "E-posta veya şifre hatalı.",
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("yanlis-sifre");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();
  await expect(page.getByLabel("totp kodu")).toHaveCount(0);
});

test("totp_gerekince_alan_belirir_dogru_kodla_giris_tamamlanir", async ({
  page,
}) => {
  let loginCallCount = 0;
  await page.route("**/auth/login", (route) => {
    loginCallCount += 1;
    if (loginCallCount === 1) {
      return route.fulfill({
        status: 401,
        json: {
          code: "TOTP_REQUIRED",
          message: "Geçerli bir TOTP kodu gerekli.",
        },
      });
    }
    return route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    });
  });
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  const totpField = page.getByLabel("totp kodu");
  await expect(totpField).toBeVisible();
  await totpField.fill("123456");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
  expect(loginCallCount).toBe(2);
});
