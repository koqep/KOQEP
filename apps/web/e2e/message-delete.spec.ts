import { test, expect, type Page } from "@playwright/test";
import { mockAuthSuccess } from "./support/auth-mocks";

async function login(
  page: Page,
  role: "user" | "moderator",
  messageAuthorUsername: string,
  mutedUntil: string | null = null,
) {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: { email: "test@koqep.local", username: "test", role, mutedUntil },
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
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByText("test mesajı")).toBeVisible();
}

test("kendi_mesajinda_sil_butonu_iki_adimli_onay_ister_vazgec_geri_alir", async ({
  page,
}) => {
  await login(page, "user", "test");

  await expect(page.getByRole("button", { name: "sil", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "sil", exact: true }).click();

  await expect(page.getByText("emin misin?")).toBeVisible();
  await expect(page.getByRole("button", { name: "evet" })).toBeVisible();

  await page.getByRole("button", { name: "vazgeç" }).click();

  await expect(page.getByText("emin misin?")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "sil", exact: true })).toBeVisible();
});

test("baskasinin_mesajinda_sil_butonu_gorunmez", async ({ page }) => {
  await login(page, "user", "baskasi");

  await expect(page.getByRole("button", { name: "sil", exact: true })).toHaveCount(0);
});

// M7b Slice D2: editMessage'ın mute-reddi TERSİ - susturulmuş kullanıcı
// "düzenle" butonunu göremez ama "sil" butonunu görebilmeli (mute kontrolü
// yok, silme yeni içerik eklemiyor).
test("susturulmus_kullanici_kendi_mesajinda_sil_butonunu_yine_de_gorur", async ({
  page,
}) => {
  const mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await login(page, "user", "test", mutedUntil);

  await expect(page.getByRole("button", { name: "düzenle" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "sil", exact: true })).toBeVisible();
});
