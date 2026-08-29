import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(
  page: Page,
  role: "user" | "moderator",
  messageAuthorUsername: string,
) {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role },
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
        messages: [
          {
            id: "msg-1",
            content: "test mesajı",
            createdAt: new Date().toISOString(),
            authorUsername: messageAuthorUsername,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByText("test mesajı")).toBeVisible();
}

test("kendi_mesajinda_duzenle_ve_gecmis_butonlari_gorunur_duzenle_formu_dolu_acilir", async ({
  page,
}) => {
  await login(page, "user", "test");

  // M11a Slice F: edit/history butonları artık satır hover/focus'ta
  // görünür (Slice C'nin saat deseni) - önce satırı hover'lamak gerekiyor.
  await page.getByText("test mesajı").hover();
  await expect(page.getByRole("button", { name: "edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "history" })).toBeVisible();

  await page.getByRole("button", { name: "edit" }).click();

  await expect(page.getByLabel("edit message")).toHaveValue("test mesajı");

  await page.getByRole("button", { name: "cancel" }).click();

  await page.getByText("test mesajı").hover();
  await expect(page.getByRole("button", { name: "edit" })).toBeVisible();
});

test("baskasinin_mesajinda_sirali_kullanici_ne_duzenle_ne_gecmis_gorur", async ({
  page,
}) => {
  await login(page, "user", "baskasi");

  await expect(page.getByRole("button", { name: "edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "history" })).toHaveCount(0);
});

test("baskasinin_mesajinda_moderator_gecmisi_gorur_ama_duzenleyemez", async ({
  page,
}) => {
  await login(page, "moderator", "baskasi");

  await page.getByText("test mesajı").hover();
  await expect(page.getByRole("button", { name: "edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "history" })).toBeVisible();
});

test("editedAt_dolu_mesajda_duzenlendi_gostergesi_gorunur_bosta_gorunmez", async ({
  page,
}) => {
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
        messages: [
          {
            id: "msg-1",
            content: "duzenlenmis mesaj",
            createdAt: new Date().toISOString(),
            authorUsername: "baskasi",
            roomId: "room-1",
            editedAt: new Date().toISOString(),
          },
          {
            id: "msg-2",
            content: "duzenlenmemis mesaj",
            createdAt: new Date().toISOString(),
            authorUsername: "baskasi",
            roomId: "room-1",
            editedAt: null,
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();

  await expect(
    page.getByText("duzenlenmis mesaj (edited)"),
  ).toBeVisible();
  await expect(page.getByText("duzenlenmemis mesaj")).toBeVisible();
  await expect(
    page.getByText("duzenlenmemis mesaj (edited)"),
  ).toHaveCount(0);
});

test("gecmis_butonuna_basinca_onceki_icerik_listelenir", async ({ page }) => {
  await login(page, "user", "test");
  await page.route("**/rooms/*/messages/*/edits", (route) =>
    route.fulfill({
      json: [
        { previousContent: "eski içerik", editedAt: new Date().toISOString() },
      ],
    }),
  );

  await page.getByText("test mesajı").hover();
  await page.getByRole("button", { name: "history" }).click();

  await expect(page.getByText("eski içerik")).toBeVisible();
});
