import { test, expect } from "@playwright/test";

test("oda_degistirince_mesaj_listesi_yeni_odaya_gore_guncellenir", async ({
  page,
}) => {
  await page.route("**/auth/login", (route) =>
    route.fulfill({
      json: { accessToken: "fake-access-token", refreshToken: "fake-refresh-token" },
    }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [
        { id: "room-general", name: "general", status: "active" },
        { id: "room-meta", name: "meta", status: "active" },
      ],
    }),
  );
  await page.route("**/rooms/*/messages", async (route) => {
    const url = new URL(route.request().url());
    const roomName = url.pathname.split("/")[2];
    const isMeta = roomName === "meta";
    await route.fulfill({
      json: {
        messages: [
          {
            id: `msg-${roomName}`,
            content: isMeta ? "meta odasindaki mesaj" : "genel odasindaki mesaj",
            createdAt: new Date().toISOString(),
            authorUsername: null,
            roomId: isMeta ? "room-meta" : "room-general",
          },
        ],
        nextCursor: null,
      },
    });
  });

  await page.goto("/");

  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();

  const generalButton = page.getByRole("button", { name: "#general" });
  const metaButton = page.getByRole("button", { name: "#meta" });

  await expect(generalButton).toBeVisible();
  await expect(metaButton).toBeVisible();
  await expect(generalButton).toHaveClass(/text-neutral-200/);
  await expect(page.getByText("genel odasindaki mesaj")).toBeVisible();

  await metaButton.click();

  await expect(metaButton).toHaveClass(/text-neutral-200/);
  await expect(page.getByText("meta odasindaki mesaj")).toBeVisible();
  await expect(page.getByText("genel odasindaki mesaj")).not.toBeVisible();
});
