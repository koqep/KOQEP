import { test, expect } from "@playwright/test";

// M11b Slice A: "/" artık gerçek bir pazarlama landing'i (LandingPage.tsx) -
// LandingIntro.tsx'in eski, AuthView'ın üstünde tanıtım-metni gösterme
// deneyimi kaldırıldı, bu dosya sıfırdan yazıldı. Landing kendi başına
// auth-bootstrap YAPMAZ (bilerek saf statik), bu yüzden mockAuthRefreshUnavailable
// gibi bir mock'a gerek yok - "/"e gitmek DOĞRUDAN landing içeriğini gösterir.

test("varsayilan_dilde_ingilizce_baslik_ve_aciklama_gorunur", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "A text-based community platform that grows by invitation.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("no feeds, no algorithms", { exact: false }),
  ).toBeVisible();
});

test("tr_butonuna_basinca_metin_turkceye_gecer_en_geri_doner", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "TR" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Davetle büyüyen, metin tabanlı bir topluluk platformu.",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "EN" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A text-based community platform that grows by invitation.",
    }),
  ).toBeVisible();
});

test("log_in_ve_sign_up_dogru_app_hedeflerine_gider", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "log in" })).toHaveAttribute(
    "href",
    "/app",
  );
  await expect(page.getByRole("link", { name: "sign up" })).toHaveAttribute(
    "href",
    "/app?mode=signup",
  );
});

test("footer_hukuki_linkleri_dile_gore_dogru_sayfaya_gider", async ({
  page,
}) => {
  await page.goto("/");

  // Varsayılan EN.
  await expect(
    page.getByRole("link", { name: "terms of service" }),
  ).toHaveAttribute("href", "/terms/en");
  await expect(
    page.getByRole("link", { name: "privacy policy" }),
  ).toHaveAttribute("href", "/privacy/en");

  await page.getByRole("button", { name: "TR" }).click();
  await expect(
    page.getByRole("link", { name: "terms of service" }),
  ).toHaveAttribute("href", "/terms");
  await expect(
    page.getByRole("link", { name: "privacy policy" }),
  ).toHaveAttribute("href", "/privacy");
});

test("footer_iletisim_linki_geri_bildirim_adresine_gider", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "contact" })).toHaveAttribute(
    "href",
    "mailto:ussasa155@gmail.com?subject=KOQEP%20support",
  );
});

test("dekoratif_canvas_arka_plani_ekran_okuyucudan_gizli", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
});
