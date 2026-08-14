import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockAuthRefreshUnavailable } from "./support/auth-mocks";

// M6 Slice D: RoomHeader.tsx'in üç flex satırı (header/nav/aksiyon div'i)
// flex-wrap OLMADAN 375px'te taşıyordu - bu test önce KIRMIZI çıkıp
// gerçek taşmayı kanıtladı, flex-wrap eklenince YEŞİLE döndü
// (testing.md: önce hatayı gösteren test, sonra düzeltme).
test("giris_formu_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
  await page.goto("/");

  await expect(page.getByLabel("e-posta")).toBeInViewport();
  await expect(page.getByLabel("şifre")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "giriş yap" }),
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
  await page.getByLabel("e-posta").fill("test@koqep.local");
  await page.getByLabel("şifre").fill("a-strong-password");
  await page.getByRole("button", { name: "giriş yap" }).click();
  await expect(page.getByPlaceholder("mesaj yaz...")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "#genel" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "+ yeni oda" }),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "çıkış" })).toBeInViewport();
});
