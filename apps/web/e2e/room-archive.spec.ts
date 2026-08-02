import { test, expect } from "@playwright/test";

test("arsivi_goster_toggle_ile_arsivlenmis_oda_gorunur_ve_salt_okunur_composer_gosterir", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    }),
  );
  await page.route("**/rooms*", async (route) => {
    const url = new URL(route.request().url());
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const rooms = [
      { id: "room-general", name: "general", status: "active" },
      ...(includeArchived
        ? [{ id: "room-eski", name: "eski-oda", status: "archived" }]
        : []),
    ];
    await route.fulfill({ json: rooms });
  });
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/");
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "#eski-oda" }),
  ).not.toBeVisible();

  await page.getByRole("button", { name: "arşivi göster" }).click();

  const archivedButton = page.getByRole("button", {
    name: "#eski-oda (arşiv)",
  });
  await expect(archivedButton).toBeVisible();

  await archivedButton.click();

  await expect(page.getByText("bu oda arşivlenmiş, sadece okunabilir")).toBeVisible();
  await expect(page.getByPlaceholder("mesaj yaz...")).not.toBeVisible();
});
