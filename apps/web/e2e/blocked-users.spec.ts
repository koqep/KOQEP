import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await mockRoomEndpoints(page);

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("liste_bosken_bos_durum_mesaji_gosterir", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "blocked" }).click();

  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("mevcut_engellenenler_listede_gorunur", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: ["a@koqep.local", "b@koqep.local"] }),
  );

  await page.getByRole("button", { name: "blocked" }).click();

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

  await page.getByRole("button", { name: "blocked" }).click();
  await page.getByLabel("email").fill("kotu@koqep.local");
  await page.getByRole("button", { name: "block", exact: true }).click();

  await expect(page.getByText("kotu@koqep.local")).toBeVisible();
  await expect(page.getByLabel("email")).toHaveValue("");
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

  await page.getByRole("button", { name: "blocked" }).click();
  await page.getByLabel("email").fill("yok@koqep.local");
  await page.getByRole("button", { name: "block", exact: true }).click();

  await expect(page.getByText("Kullanıcı bulunamadı.")).toBeVisible();
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("engeli_kaldirinca_listeden_cikar", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: ["kotu@koqep.local"] }),
  );
  await page.route("**/users/unblock", (route) =>
    route.fulfill({ json: { ok: true } }),
  );

  await page.getByRole("button", { name: "blocked" }).click();
  await expect(page.getByText("kotu@koqep.local")).toBeVisible();

  await page.getByRole("button", { name: "unblock" }).click();

  await expect(page.getByText("kotu@koqep.local")).toHaveCount(0);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});

test("kapat_butonu_sohbet_ekranina_doner", async ({ page }) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "blocked" }).click();
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();

  await page.getByRole("button", { name: "close" }).click();

  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});

test("oda_butonuna_basinca_acik_panel_kapanip_sohbete_doner", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "blocked" }).click();
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();

  // Panel açıkken zaten aktif olan (tek) odanın butonuna basmak - "geri
  // dönme" için ilk akla gelen tepki - paneli kapatıp sohbete dönmeli.
  await page.getByRole("button", { name: "#test-oda" }).click();

  await expect(page.getByText("you haven't blocked anyone yet")).toHaveCount(0);
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
});

test("iki_adimli_dogrulama_paneli_acikken_engellenenlere_gecince_yer_degistirir", async ({
  page,
}) => {
  await login(page);
  await page.route("**/users/blocked", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.getByRole("button", { name: "two-factor authentication" }).click();
  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "blocked" }).click();

  await expect(
    page.getByRole("button", { name: "start setup" }),
  ).toHaveCount(0);
  await expect(page.getByText("you haven't blocked anyone yet")).toBeVisible();
});
