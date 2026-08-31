import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(page: Page, role: "user" | "moderator") {
  await mockAuthSuccess(page);
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

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
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
  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByText("rooms")).toBeVisible();
  await expect(page.getByText("#general (active)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "rename" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "archive", exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "moderation" }).click();

  await page.getByRole("button", { name: "rename" }).click();
  await page.getByLabel("edit room name").fill("duzeltilmis-isim");
  await page.getByRole("button", { name: "save" }).click();

  expect(renameBody).toEqual({ name: "duzeltilmis-isim" });
  await expect(page.getByText("#duzeltilmis-isim (active)")).toBeVisible();
});

test("moderator_oda_duyurusu_ekler_ve_kaldirir", async ({ page }) => {
  await page.route("**/rooms*", (route) =>
    route.fulfill({
      json: [
        {
          id: "room-1",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
          announcement: null,
        },
      ],
    }),
  );
  let announcementBody: unknown;
  await page.route(
    "**/moderation/rooms/room-1/announcement",
    async (route) => {
      announcementBody = route.request().postDataJSON();
      const announcement =
        (announcementBody as { announcement?: string }).announcement ?? null;
      await route.fulfill({
        json: {
          id: "room-1",
          name: "general",
          description: null,
          lastActivityAt: new Date().toISOString(),
          status: "active",
          announcement,
        },
      });
    },
  );
  await login(page, "moderator");
  await page.getByRole("button", { name: "moderation" }).click();

  await expect(page.getByRole("button", { name: "add announcement" })).toBeVisible();
  await page.getByRole("button", { name: "add announcement" }).click();
  await page
    .getByLabel("edit room announcement")
    .fill("Faz 1'e hoş geldiniz!");
  await page.getByRole("button", { name: "save" }).click();

  expect(announcementBody).toEqual({ announcement: "Faz 1'e hoş geldiniz!" });
  await expect(page.getByText("Faz 1'e hoş geldiniz!")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "remove announcement" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "remove announcement" }).click();

  expect(announcementBody).toEqual({});
  await expect(page.getByText("Faz 1'e hoş geldiniz!")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "add announcement" })).toBeVisible();
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
  await page.getByRole("button", { name: "moderation" }).click();

  // Aktif oda: sadece "rename"/"archive" var, "delete" YOK.
  await expect(page.getByRole("button", { name: "delete", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "archive", exact: true }).click();

  await expect(page.getByText("#kotuye-kullanilan (archived)")).toBeVisible();
  await expect(page.getByRole("button", { name: "archive", exact: true })).toHaveCount(0);

  // İki adımlı onay - "cancel" hiçbir şeyi silmiyor.
  await page.getByRole("button", { name: "delete", exact: true }).click();
  await expect(page.getByText("are you sure?", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "cancel" }).click();
  await expect(page.getByText("are you sure?", { exact: false })).toHaveCount(0);
  expect(deleteWasCalled).toBe(false);

  await page.getByRole("button", { name: "delete", exact: true }).click();
  await page.getByRole("button", { name: "yes, delete" }).click();

  expect(deleteWasCalled).toBe(true);
  // "odalar" bölümünün kendi listesi boşaldı - RoomHeader'ın switcher'ı
  // (üstteki "#kotuye-kullanilan" navigasyon butonu) BİLEREK kontrol
  // edilmiyor: o, gerçek WS room:deleted broadcast'iyle güncelleniyor
  // (apps/api/test/room-moderation.e2e-spec.ts'te gerçek soketle
  // kanıtlandı) - bu testte gerçek bir WS bağlantısı yok (sadece mock'lu
  // REST), switcher'ın kendisi bu harness'ta test edilemez.
  await expect(page.getByText("no rooms")).toBeVisible();
});
