import { test, expect, type Page } from "@playwright/test";

async function login(
  page: Page,
  role: "user" | "moderator",
  messageAuthorEmail: string,
) {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: { accessToken: "fake-access-token", refreshToken: "fake-refresh-token" },
    }),
  );
  await page.route("**/users/me", (route) =>
    route.fulfill({ json: { email: "test@koqep.local", role } }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({ json: [{ id: "room-1", name: "general" }] }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: "msg-1",
            content: "test mesajı",
            createdAt: new Date().toISOString(),
            authorEmail: messageAuthorEmail,
            roomId: "room-1",
          },
        ],
        nextCursor: null,
      },
    }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByText("test mesajı")).toBeVisible();
}

test("kendi_mesajinda_duzenle_ve_gecmis_butonlari_gorunur_duzenle_formu_dolu_acilir", async ({
  page,
}) => {
  await login(page, "user", "test@koqep.local");

  await expect(page.getByRole("button", { name: "düzenle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "geçmiş" })).toBeVisible();

  await page.getByRole("button", { name: "düzenle" }).click();

  await expect(page.getByLabel("mesajı düzenle")).toHaveValue("test mesajı");

  await page.getByRole("button", { name: "iptal" }).click();

  await expect(page.getByRole("button", { name: "düzenle" })).toBeVisible();
});

test("baskasinin_mesajinda_sirali_kullanici_ne_duzenle_ne_gecmis_gorur", async ({
  page,
}) => {
  await login(page, "user", "baskasi@koqep.local");

  await expect(page.getByRole("button", { name: "düzenle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "geçmiş" })).toHaveCount(0);
});

test("baskasinin_mesajinda_moderator_gecmisi_gorur_ama_duzenleyemez", async ({
  page,
}) => {
  await login(page, "moderator", "baskasi@koqep.local");

  await expect(page.getByRole("button", { name: "düzenle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "geçmiş" })).toBeVisible();
});

test("gecmis_butonuna_basinca_onceki_icerik_listelenir", async ({ page }) => {
  await login(page, "user", "test@koqep.local");
  await page.route("**/rooms/*/messages/*/edits", (route) =>
    route.fulfill({
      json: [
        { previousContent: "eski içerik", editedAt: new Date().toISOString() },
      ],
    }),
  );

  await page.getByRole("button", { name: "geçmiş" }).click();

  await expect(page.getByText("eski içerik")).toBeVisible();
});
