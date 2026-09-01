import { test, expect } from "@playwright/test";
import { mockAuthSuccess, mockAuthRefreshUnavailable } from "./support/auth-mocks";

// M11b Slice A: yeni landing sayfası (3 sütunlu özellik ızgarası + TR/EN
// kutusu + iki CTA butonu) 375px'te taşmadan görünmeli - M6 Slice D'nin
// AYNI kategoride gerçek bir regresyon bulduğu yer burası, bilerek atlanmadı.
test("landing_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "TR" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "EN" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "log in" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "sign up" })).toBeInViewport();
  await expect(
    page.getByText("Invite-only entry", { exact: true }),
  ).toBeInViewport();
});

// M6 Slice D: RoomHeader.tsx'in üç flex satırı (header/nav/aksiyon div'i)
// flex-wrap OLMADAN 375px'te taşıyordu - bu test önce KIRMIZI çıkıp
// gerçek taşmayı kanıtladı, flex-wrap eklenince YEŞİLE döndü
// (testing.md: önce hatayı gösteren test, sonra düzeltme).
test("giris_formu_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
  await page.goto("/app");

  await expect(page.getByLabel("email")).toBeInViewport();
  await expect(page.getByLabel("password")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "log in" }),
  ).toBeInViewport();
});

// M10 Faz 2 Slice B: oda listesi artık TopBar'da değil, dikey RoomSidebar'da
// - masaüstünde sabit `<aside>`, mobilde `md:hidden` hamburger ile açılan
// bir SidePanel overlay'i (bkz. bir sonraki test). Bu test SADECE TopBar'ın
// kendisinin 375px'te taşmadan görünmesini doğruluyor.
test("topbar_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "genel", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "open room list" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "+ new room" }),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "account" })).toBeInViewport();
});

// M10 Faz 2 Slice B: mobilde oda listesi varsayılan gizli, hamburger ile
// SidePanel overlay'i olarak açılıyor - bir oda seçilince handleRoomSwitch
// zaten requestClosePanel()'i ilk satırda çağırdığı için overlay otomatik
// kapanıyor (Slice A'nın kanıtlanmış mekanizması, ek kod yok).
test("mobil_oda_listesi_hamburger_ile_acilir_oda_secilince_kapanir", async ({
  page,
}) => {
  await mockAuthSuccess(page);
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "genel", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  await page.getByRole("button", { name: "open room list" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const roomButton = dialog.getByRole("button", { name: "#genel" });
  await expect(roomButton).toBeInViewport();

  await roomButton.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// M10 Faz 2 Slice A: SidePanel'in w-full max-w-md kombinasyonu 375px'te
// AYRI bir media query olmadan doğal olarak tam ekrana düşmeli.
// M13 Slice A: temsilci artık "moderation" - TOTP CenteredModal'a
// taşındı (bilerek FARKLI mobil davranış, kendi testi
// centered-modal.spec.ts'te), SidePanel'de SADECE moderation + mobil
// sidebar kaldı.
test("side_panel_375px_genislikte_tam_ekrana_genisler", async ({ page }) => {
  await mockAuthSuccess(page);
  await page.route("**/users/me", (route) =>
    route.fulfill({
      json: {
        email: "test@koqep.local",
        username: "test",
        role: "moderator",
        mutedUntil: null,
      },
    }),
  );
  await page.route("**/moderation/reports", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/rooms", (route) =>
    route.fulfill({
      json: [{ id: "room-1", name: "genel", status: "active" }],
    }),
  );
  await page.route("**/rooms/*/messages", (route) =>
    route.fulfill({ json: { messages: [], nextCursor: null } }),
  );

  await page.goto("/app");
  await page.getByLabel("email").fill("test@koqep.local");
  await page.getByLabel("password").fill("a-strong-password");
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeVisible();

  await page.getByRole("button", { name: "moderation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  // Alt-piksel yuvarlama olabilir (ör. 374.9999... ya da 375.00001...) -
  // tam eşitlik yerine ±1px tolerans.
  expect(box?.width).toBeGreaterThan(374);
  expect(box?.width).toBeLessThan(376);
});

// M11b Slice D: legal sayfalar artık LegalPageShell.tsx'in KOQEP marka
// bloğu + pill-buton footer'ını taşıyor - landing_375px testiyle aynı
// kategoride, temsili olarak /terms üzerinde doğrulanıyor. Sayfa uzun
// (3000+px) olduğu için footer başlangıçta viewport dışında - önce
// scrollIntoViewIfNeeded ile scroll edilip ORADA taşma kontrol ediliyor.
test("legal_sayfa_375px_genislikte_tasmadan_gorunur", async ({ page }) => {
  await page.goto("/terms");

  await expect(page.getByText("KOQEP", { exact: true })).toBeInViewport();

  const homeLink = page.getByRole("link", { name: "ana sayfaya dön" });
  await homeLink.scrollIntoViewIfNeeded();
  await expect(homeLink).toBeInViewport();
  await expect(
    page.getByRole("link", { name: "Switch to English" }),
  ).toBeInViewport();
});
