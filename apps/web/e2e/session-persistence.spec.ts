import { test, expect } from "@playwright/test";
import { mockRoomEndpoints } from "./support/auth-mocks";

// M7a Slice A (ADR-0002'yi bitirmek): page.tsx artık mount'ta /auth/refresh'i
// sessizce dener - üretimde bu, httpOnly refresh-token cookie'sinin hâlâ
// geçerli olup olmadığını kontrol eder. Bu testler o mount-time bootstrap
// mantığını doğrudan test ediyor (gerçek cross-origin cookie mekaniği değil
// - o zaten apps/api'nin kendi e2e süitinde, Set-Cookie bayraklarıyla
// birlikte doğrulanıyor).

test("gecerli_oturumla_sayfaya_girince_giris_formu_gorunmeden_oda_gorunumune_gecer", async ({
  page,
}) => {
  await page.route("**/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken: "fake-access-token" } }),
  );
  await mockRoomEndpoints(page);

  await page.goto("/app");

  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  await expect(page.getByTestId("auth-email-input")).toHaveCount(0);
});

test("gecersiz_oturumla_sayfaya_girince_giris_formu_gorunur", async ({
  page,
}) => {
  await page.route("**/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );

  await page.goto("/app");

  await expect(page.getByTestId("auth-email-input")).toBeVisible();
  await expect(page.getByTestId("chat-panel-composer-input")).toHaveCount(0);
});

test("sayfa_reload_sonrasi_oturum_hala_acik_giris_formuna_donmez", async ({
  page,
}) => {
  let hasSession = false;

  await page.route("**/auth/login", (route) => {
    hasSession = true;
    return route.fulfill({
      json: {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
      },
    });
  });
  await page.route("**/auth/refresh", (route) => {
    if (!hasSession) {
      return route.fulfill({ status: 401, json: {} });
    }
    return route.fulfill({ json: { accessToken: "fake-access-token-2" } });
  });
  await mockRoomEndpoints(page);

  await page.goto("/app");
  await page.getByTestId("auth-email-input").fill("test@koqep.local");
  await page.getByTestId("auth-password").fill("a-strong-password");
  await page.getByTestId("auth-submit-button").click();
  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();

  // React state (bellek-içi access token) reload'da TAMAMEN sıfırlanır -
  // page.tsx'in mount-time bootstrap'ı /auth/refresh'i tekrar dener, bu
  // sefer BAŞARILI (üretimde: httpOnly cookie reload'dan etkilenmez).
  await page.reload();

  await expect(page.getByTestId("chat-panel-composer-input")).toBeVisible();
  await expect(page.getByTestId("auth-email-input")).toHaveCount(0);
});
