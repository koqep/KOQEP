import { test, expect } from "@playwright/test";
import { mockAuthRefreshUnavailable } from "./support/auth-mocks";

test.beforeEach(async ({ page }) => {
  await mockAuthRefreshUnavailable(page);
});

test("ana_sayfada_tanitim_metni_ve_giris_formu_birlikte_gorunur", async ({
  page,
}) => {
  await page.goto("/");

  // Erişilebilir ad "# KOQEP" ("#" span'ı + metin birleşiyor) - exact:true
  // şart, aksi halde AuthView'ın kendi "# koqep" başlığı (lowercase) case-
  // insensitive substring eşleşmesiyle aynı anda yakalanıp strict-mode
  // ihlaline yol açardı (STATE.md'nin kurulu getByText/getByRole tuzağı).
  await expect(
    page.getByRole("heading", { name: "# KOQEP", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "giriş yap" }),
  ).toBeVisible();
});

test("tanitimdaki_hukuki_linkler_ingilizce_sayfalara_gider", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute(
    "href",
    "/terms/en",
  );
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "/privacy/en",
  );
});
