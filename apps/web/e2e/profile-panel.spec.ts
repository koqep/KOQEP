import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

interface MockMessage {
  id: string;
  content: string;
  authorUsername: string | null;
  createdAt: string;
}

async function loginWithMessages(
  page: Page,
  messages: MockMessage[],
): Promise<void> {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role: "user" },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "general", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({
      json: {
        messages: messages.map((m) => ({
          roomId: "room-1",
          editedAt: null,
          ...m,
        })),
        nextCursor: null,
      },
    }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("hesap_menusunden_kendi_profilini_acar", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/test/profile", (route) =>
    route.fulfill({
      json: {
        username: "test",
        createdAt: "2025-06-15T00:00:00.000Z",
        level: 4,
        totalXp: 320,
        xpProgressPercent: 50,
      },
    }),
  );

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "profile" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("test", { exact: true })).toBeVisible();
  await expect(dialog.getByText("joined June 15, 2025")).toBeVisible();
  await expect(dialog.getByText("level 4 — 320 XP")).toBeVisible();
});

// M13 Slice E: seviye/XP çubuğu - yüzde backend'den geliyor
// (xpProgressPercent), frontend sadece görüntülüyor.
test("seviye_xp_cubugu_backendden_gelen_yuzdeyle_gorunur", async ({
  page,
}) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/test/profile", (route) =>
    route.fulfill({
      json: {
        username: "test",
        createdAt: "2025-06-15T00:00:00.000Z",
        level: 4,
        totalXp: 320,
        xpProgressPercent: 28.571428571428573,
      },
    }),
  );

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "profile" }).click();

  const dialog = page.getByRole("dialog");
  const progressbar = dialog.getByRole("progressbar", {
    name: "xp progress to next level",
  });
  await expect(progressbar).toBeVisible();
  await expect(progressbar).toHaveAttribute("aria-valuenow", "29");
});

test("baskasinin_grup_basi_mesajina_tiklayinca_onun_profili_acilir", async ({
  page,
}) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "merhaba",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/baskasi/profile", (route) =>
    route.fulfill({
      json: {
        username: "baskasi",
        createdAt: "2025-03-01T00:00:00.000Z",
        level: 1,
        totalXp: 10,
        xpProgressPercent: (10 / 35) * 100,
      },
    }),
  );

  await page.getByRole("button", { name: /baskasi:/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("baskasi", { exact: true })).toBeVisible();
});

test("silinmis_yazarli_mesaj_tiklanamaz", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "sıradan mesaj",
      authorUsername: null,
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);

  await expect(page.getByText("deleted user:")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /deleted user:/ }),
  ).toHaveCount(0);
});

test("404_kullanici_bulunamadi_mesaji_gosterir", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "merhaba",
      authorUsername: "baskasi",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/baskasi/profile", (route) =>
    route.fulfill({
      status: 404,
      json: { code: "USER_NOT_FOUND", message: "Kullanıcı bulunamadı." },
    }),
  );

  await page.getByRole("button", { name: /baskasi:/ }).click();

  await expect(page.getByText("User not found.")).toBeVisible();
});

test("kendi_mesajina_you_etiketine_tiklamak_da_kendi_profilini_acar", async ({
  page,
}) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "kendi mesajım",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/test/profile", (route) =>
    route.fulfill({
      json: {
        username: "test",
        createdAt: "2025-06-15T00:00:00.000Z",
        level: 4,
        totalXp: 320,
        xpProgressPercent: 50,
      },
    }),
  );

  await page.getByRole("button", { name: /test:/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("test", { exact: true })).toBeVisible();
});

test("buyuk_avatar_5x5_izgarayi_render_eder", async ({ page }) => {
  await loginWithMessages(page, [
    {
      id: "msg-1",
      content: "ilk mesaj",
      authorUsername: "test",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ]);
  await page.route("**/users/test/profile", (route) =>
    route.fulfill({
      json: {
        username: "test",
        createdAt: "2025-06-15T00:00:00.000Z",
        level: 4,
        totalXp: 320,
        xpProgressPercent: 50,
      },
    }),
  );

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "profile" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // 5x5 ızgara = 25 rect render edilir (sadece 3x5=15 hücre BAĞIMSIZ
  // hashleniyor, kalan 10'u ayna-simetri yüzünden değer olarak tekrarlanan
  // ama YİNE DE ayrı render edilen rect'ler - bkz. avatar.ts).
  await expect(dialog.locator("svg rect")).toHaveCount(25);
});
