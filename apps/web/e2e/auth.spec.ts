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

test("kayit_basarili_olunca_dogrulama_mesaji_gosterir_giris_ekranina_gecmez", async ({
  page,
}) => {
  await page.route("**/auth/signup", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "hesabın yok mu? kayıt ol" }).click();

  await page.getByLabel("davet kodu").fill("DEV-INVITE-1");
  await page.getByLabel("e-posta").fill("yeni@koqep.local");
  await page.getByLabel("kullanıcı adı").fill("yenikullanici");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "kayıt ol" }).click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - e-postayı doğrulaman
  // gerektiğini söyleyen nötr bir mesaj görünür, sohbet ekranına geçmez.
  await expect(
    page.getByText(
      "Kaydını tamamlamak için e-postana gönderilen bağlantıya tıkla.",
    ),
  ).toBeVisible();
  await expect(page.getByPlaceholder("mesaj yaz...")).toHaveCount(0);
});

test("dogrulanmamis_e_posta_ile_giris_hatasi_gosterir", async ({ page }) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "EMAIL_NOT_VERIFIED",
        message: "E-postanı doğrulaman gerekiyor.",
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("dogrulanmamis@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(
    page.getByText("E-postanı doğrulaman gerekiyor."),
  ).toBeVisible();
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

test("sifremi_unuttum_gonderince_notr_mesaj_gosterir", async ({ page }) => {
  await page.route("**/auth/password-reset/request", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "şifreni mi unuttun?" }).click();

  await expect(page.getByLabel("şifre")).toHaveCount(0);
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByRole("button", { name: "gönder" }).click();

  await expect(
    page.getByText("Bu e-posta kayıtlıysa bir sıfırlama bağlantısı gönderildi."),
  ).toBeVisible();

  await page.getByRole("button", { name: "girişe dön" }).click();
  await expect(page.getByRole("button", { name: "giriş yap" })).toBeVisible();
});
