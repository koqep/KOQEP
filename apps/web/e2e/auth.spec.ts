import { test, expect } from "@playwright/test";
import {
  mockAuthRefreshUnavailable,
  mockRoomEndpoints,
} from "./support/auth-mocks";

// Bu dosyadaki HER test page.goto("/") çağırıyor - page.tsx'in mount-time
// sessiz-refresh bootstrap'ı (M7a Slice A) bu yüzden her testte tetikleniyor,
// mocklanmazsa gerçek ağa düşer/asılı kalır.
test.beforeEach(async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
});

test("kayit_basarili_olunca_dogrulama_mesaji_gosterir_giris_ekranina_gecmez", async ({
  page,
}) => {
  await page.route("**/auth/signup", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "don't have an account? sign up" }).click();

  await page.getByLabel("invite code").fill("DEV-INVITE-1");
  await page.getByLabel("email").fill("yeni@koqep.local");
  await page.getByLabel("username").fill("yenikullanici");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "sign up" }).click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - e-postayı doğrulaman
  // gerektiğini söyleyen nötr bir mesaj görünür, sohbet ekranına geçmez.
  await expect(
    page.getByText(
      "Click the link sent to your email to complete your signup.",
    ),
  ).toBeVisible();
  await expect(page.getByPlaceholder("write a message...")).toHaveCount(0);
});

test("onay_kutusu_isaretlenmeden_kayit_butonu_devre_disi_kalir", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "don't have an account? sign up" }).click();

  await page.getByLabel("invite code").fill("DEV-INVITE-1");
  await page.getByLabel("email").fill("yeni@koqep.local");
  await page.getByLabel("username").fill("yenikullanici");
  await page.getByLabel("password").fill("a-strong-password");

  await expect(page.getByRole("button", { name: "sign up" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "sign up" })).toBeEnabled();
});

test("kayit_ekraninda_kullanim_sartlari_ve_gizlilik_linkleri_dogru_hedefe_gider", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "don't have an account? sign up" }).click();

  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(
    page.getByRole("link", { name: "Privacy Policy" }),
  ).toHaveAttribute("href", "/privacy");
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
  await page.getByLabel("email").fill("dogrulanmamis@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("yanlis-sifre");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();
  await expect(page.getByLabel("totp code")).toHaveCount(0);
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
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  const totpField = page.getByLabel("totp code");
  await expect(totpField).toBeVisible();
  await totpField.fill("123456");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
  expect(loginCallCount).toBe(2);
});

test("sifremi_unuttum_gonderince_notr_mesaj_gosterir", async ({ page }) => {
  await page.route("**/auth/password-reset/request", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "forgot your password?" }).click();

  await expect(page.getByLabel("password")).toHaveCount(0);
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByRole("button", { name: "send" }).click();

  await expect(
    page.getByText("If this email is registered, a reset link has been sent."),
  ).toBeVisible();

  await page.getByRole("button", { name: "back to login" }).click();
  await expect(page.getByRole("button", { name: "log in" })).toBeVisible();
});
