import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockAuthRefreshUnavailable } from "./support/auth-mocks";

// M6 Slice D: RoomHeader.tsx'in üç flex satırı (header/nav/aksiyon div'i)
// flex-wrap OLMADAN 375px'te taşıyordu - bu test önce KIRMIZI çıkıp
// gerçek taşmayı kanıtladı, flex-wrap eklenince YEŞİLE döndü
// (testing.md: önce hatayı gösteren test, sonra düzeltme).
test("giris_formu_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
  await page.goto("/");

  await expect(page.getByLabel("email")).toBeInViewport();
  await expect(page.getByLabel("password")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "log in" }),
  ).toBeInViewport();
});

test("oda_basligi_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "genel", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "#genel" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "+ new room" }),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "log out" })).toBeInViewport();
});
