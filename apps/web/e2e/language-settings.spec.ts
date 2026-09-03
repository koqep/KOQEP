import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockRoomEndpoints } from "./support/auth-mocks";

// M9 Slice D1: ayarlar→dil paneli - backend'in PATCH /users/me/locale'i
// (M9 Slice B'den beri hazır ama hiçbir UI onu çağırmıyordu) artık
// gerçekten bir arayüzden tetikleniyor. `dict`'in RoomView'da myProfile.
// locale'den türetildiğini de dolaylı kanıtlıyor - Türkçe'ye geçince
// panel BAŞLIĞI da (aynı render'da, "language" → "dil") değişiyor.
async function login(page: import("@playwright/test").Page) {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "user",
        mutedUntil: null,
        muteReason: null,
        locale: "en",
      },
    }),
  );
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();
}

test("dil_panelinde_turkceye_gecince_patch_gonderilir_ve_arayuz_turkceye_doner", async ({
  page,
}) => {
  await login(page);

  let patchedBody: { locale?: string } | undefined;
  await page.route("**/users/me/locale", async (route) => {
    patchedBody = route.request().postDataJSON() as { locale?: string };
    await route.fulfill({ json: { ok: true } });
  });

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "settings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "language" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "English" })).toBeVisible();
  await dialog.getByRole("button", { name: "Türkçe" }).click();

  await expect.poll(() => patchedBody?.locale).toBe("tr");
  // Aynı render'da CenteredModal'ın başlığı da (dict RoomView'da
  // myProfile.locale'den türediği için) Türkçe'ye dönüyor.
  await expect(page.getByText("KOQEP · dil")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Türkçe" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "English" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("ingilizce_secili_olarak_baslar", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "settings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "language" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "English" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "Türkçe" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
