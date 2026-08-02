import { test, expect } from "@playwright/test";

async function mockRoomEndpoints(page: import("@playwright/test").Page) {
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "test-oda", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
}

async function loginWithoutTotp(page: import("@playwright/test").Page) {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
}

async function loginWithTotpEnabled(page: import("@playwright/test").Page) {
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
  await page.getByLabel("totp kodu").fill("123456");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
}

test("totp_kapaliyken_panel_kurulum_baslat_gosterir", async ({ page }) => {
  await loginWithoutTotp(page);

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();

  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "TOTP'yi kapat" }),
  ).toHaveCount(0);
});

test("kurulum_baslatinca_secret_ve_qr_ve_kod_alani_gorunur", async ({
  page,
}) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl:
          "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP&issuer=KOQEP",
      },
    }),
  );

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();
  await page.getByRole("button", { name: "kurulumu başlat" }).click();

  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(page.getByLabel("totp kodu")).toBeVisible();
  await expect(page.locator("pre")).not.toBeEmpty();
});

test("dogru_kodla_etkinlestirince_kurtarma_kodlari_gosterilir_sonra_kapat_formuna_gecer", async ({
  page,
}) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP",
      },
    }),
  );
  const recoveryCodes = Array.from(
    { length: 8 },
    (_, index) => `aaaaaa-${index}00000`,
  );
  await page.route("**/auth/totp/enable", (route) =>
    route.fulfill({ json: recoveryCodes }),
  );

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();
  await page.getByRole("button", { name: "kurulumu başlat" }).click();
  await page.getByLabel("totp kodu").fill("654321");
  await page.getByRole("button", { name: "etkinleştir" }).click();

  await expect(
    page.getByText("Bu kodlar bir daha gösterilmeyecek."),
  ).toBeVisible();
  for (const code of recoveryCodes) {
    await expect(page.getByText(code)).toBeVisible();
  }

  await page.getByRole("button", { name: "kaydettim" }).click();

  await expect(
    page.getByRole("button", { name: "TOTP'yi kapat" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toHaveCount(0);
});

test("yanlis_kod_hata_gosterir_kurulum_yeniden_baslamaz", async ({ page }) => {
  await loginWithoutTotp(page);
  await page.route("**/auth/totp/setup", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/KOQEP:test%40koqep.local?secret=JBSWY3DPEHPK3PXP",
      },
    }),
  );
  await page.route("**/auth/totp/enable", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Geçersiz TOTP kodu." },
    }),
  );

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();
  await page.getByRole("button", { name: "kurulumu başlat" }).click();
  await page.getByLabel("totp kodu").fill("000000");
  await page.getByRole("button", { name: "etkinleştir" }).click();

  await expect(page.getByText("Geçersiz TOTP kodu.")).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "etkinleştir" }),
  ).toBeVisible();
});

test("totp_aciksa_panel_dogrudan_kapatma_formuna_gecer_basarili_kapatma_sonrasi_kurulum_baslat_doner", async ({
  page,
}) => {
  await loginWithTotpEnabled(page);
  await page.route("**/auth/totp/disable", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();

  await expect(
    page.getByRole("button", { name: "TOTP'yi kapat" }),
  ).toBeVisible();
  await page.getByLabel("totp kodu").fill("654321");
  await page.getByRole("button", { name: "TOTP'yi kapat" }).click();

  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toBeVisible();
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await loginWithoutTotp(page);

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();
  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "kapat" }).click();

  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});
