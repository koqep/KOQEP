import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role: "user" | "moderator") {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role, mutedUntil: null },
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
}

test("moderator_odalar_bolumunu_gorur", async ({ page }) => {
  await page.route("**/rooms*", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    }),
  );
  await login(page, "moderator");
  await page.getByRole("button", { name: "moderasyon" }).click();

  await expect(page.getByText("odalar")).toBeVisible();
  await expect(page.getByText("#general (active)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "yeniden adlandır" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "arşivle" })).toBeVisible();
});

test("moderator_odayi_yeniden_adlandirir", async ({ page }) => {
  await page.route("**/rooms*", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "kotu-isim",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    }),
  );
  let renameBody: unknown;
  await page.route("**/moderation/rooms/room-1/rename", async (route) => {
    renameBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: "room-1",
        name: "duzeltilmis-isim",
        description: null,
        lastActivityAt: new Date().toISOString(),
        status: "active",
      },
    });
  });
  await login(page, "moderator");
  await page.getByRole("button", { name: "moderasyon" }).click();

  await page.getByRole("button", { name: "yeniden adlandır" }).click();
  await page.getByLabel("oda ismini düzenle").fill("duzeltilmis-isim");
  await page.getByRole("button", { name: "kaydet" }).click();

  expect(renameBody).toEqual({ name: "duzeltilmis-isim" });
  await expect(page.getByText("#duzeltilmis-isim (active)")).toBeVisible();
});

test("moderator_aktif_odayi_arsivler_sonra_arsivlenmis_odayi_iki_adimli_onayla_siler", async ({
  page,
}) => {
  await page.route("**/rooms*", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "kotuye-kullanilan",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
        },
      ],
    }),
  );
  await page.route("**/moderation/rooms/room-1/archive", (route) =>
    route.fulfill({
      json: {
        id: "room-1",
        name: "kotuye-kullanilan",
        description: null,
        lastActivityAt: new Date().toISOString(),
        status: "archived",
      },
    }),
  );
  let deleteWasCalled = false;
  await page.route("**/moderation/rooms/room-1/delete", async (route) => {
    deleteWasCalled = true;
    await route.fulfill({ json: { ok: true } });
  });
  await login(page, "moderator");
  await page.getByRole("button", { name: "moderasyon" }).click();

  // Aktif oda: sadece "yeniden adlandır"/"arşivle" var, "sil" YOK.
  await expect(page.getByRole("button", { name: "sil", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "arşivle" }).click();

  await expect(page.getByText("#kotuye-kullanilan (archived)")).toBeVisible();
  await expect(page.getByRole("button", { name: "arşivle" })).toHaveCount(0);

  // İki adımlı onay - "vazgeç" hiçbir şeyi silmiyor.
  await page.getByRole("button", { name: "sil", exact: true }).click();
  await expect(page.getByText("emin misin?", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "vazgeç" }).click();
  await expect(page.getByText("emin misin?", { exact: false })).toHaveCount(0);
  expect(deleteWasCalled).toBe(false);

  await page.getByRole("button", { name: "sil", exact: true }).click();
  await page.getByRole("button", { name: "evet, sil" }).click();

  expect(deleteWasCalled).toBe(true);
  // "odalar" bölümünün kendi listesi boşaldı - RoomHeader'ın switcher'ı
  // (üstteki "#kotuye-kullanilan" navigasyon butonu) BİLEREK kontrol
  // edilmiyor: o, gerçek WS room:deleted broadcast'iyle güncelleniyor
  // (apps/api/test/room-moderation.e2e-spec.ts'te gerçek soketle
  // kanıtlandı) - bu testte gerçek bir WS bağlantısı yok (sadece mock'lu
  // REST), switcher'ın kendisi bu harness'ta test edilemez.
  await expect(page.getByText("oda yok")).toBeVisible();
});
