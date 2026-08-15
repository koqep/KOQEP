import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
}

test("liste_bosken_bos_durum_mesaji_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();

  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();
});

test("mevcut_engellenenler_listede_gorunur", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: ["a@koqep.local", "b@koqep.local"] }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();

  await expect(page.getByText("a@koqep.local")).toBeVisible();
  await expect(page.getByText("b@koqep.local")).toBeVisible();
});

test("email_girip_engelleyince_listeye_eklenir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/users/block", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();
  await page.getByLabel("e-posta").fill("kotu@koqep.local");
  await page.getByRole("button", { name: "engelle", exact: true }).click();

  await expect(page.getByText("kotu@koqep.local")).toBeVisible();
  await expect(page.getByLabel("e-posta")).toHaveValue("");
});

test("bilinmeyen_email_engellenemez_hata_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/users/block", (route) =>
    route.fulfill({
      status: 404,
      json: { message: "Kullanıcı bulunamadı." },
    }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();
  await page.getByLabel("e-posta").fill("yok@koqep.local");
  await page.getByRole("button", { name: "engelle", exact: true }).click();

  await expect(page.getByText("Kullanıcı bulunamadı.")).toBeVisible();
  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();
});

test("engeli_kaldirinca_listeden_cikar", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: ["kotu@koqep.local"] }),
  );
  await page.route("**/users/unblock", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();
  await expect(page.getByText("kotu@koqep.local")).toBeVisible();

  await page.getByRole("button", { name: "engeli kaldır" }).click();

  await expect(page.getByText("kotu@koqep.local")).toHaveCount(0);
  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();
  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();

  await page.getByRole("button", { name: "kapat" }).click();

  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});

test("oda_butonuna_basinca_acik_panel_kapanip_sohbete_doner", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "engellenenler" }).click();
  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();

  // Panel açıkken zaten aktif olan (tek) odanın butonuna basmak - "geri
  // dönme" için ilk akla gelen tepki - paneli kapatıp sohbete dönmeli.
  await page.getByRole("button", { name: "#test-oda" }).click();

  await expect(page.getByText("henüz kimseyi engellemedin")).toHaveCount(0);
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
});

test("iki_adimli_dogrulama_paneli_acikken_engellenenlere_gecince_yer_degistirir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "iki adımlı doğrulama" }).click();
  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "engellenenler" }).click();

  await expect(
    page.getByRole("button", { name: "kurulumu başlat" }),
  ).toHaveCount(0);
  await expect(page.getByText("henüz kimseyi engellemedin")).toBeVisible();
});
