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

  // `landing-heading` orijinalde `getByRole("heading",{name:})` idi -
  // `.toHaveAccessibleName()` doğru eşdeğeri (ikon/önek taşımasa da,
  // auth.spec.ts'teki AYNI dosyalarda tutarlılık için). `landing-
  // description` orijinalde `getByText` idi - `.toContainText()` KALIYOR.
  await expect(page.getByTestId("landing-heading")).toHaveAccessibleName(
    "A text-based community platform that grows by invitation.",
  );
  await expect(page.getByTestId("landing-description")).toContainText(
    "no feeds, no algorithms",
  );
});

test("tr_butonuna_basinca_metin_turkceye_gecer_en_geri_doner", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("landing-locale-tr-button").click();
  await expect(page.getByTestId("landing-heading")).toHaveAccessibleName(
    "Davetle büyüyen, metin tabanlı bir topluluk platformu.",
  );

  await page.getByTestId("landing-locale-en-button").click();
  await expect(page.getByTestId("landing-heading")).toHaveAccessibleName(
    "A text-based community platform that grows by invitation.",
  );
});

test("log_in_ve_sign_up_dogru_app_hedeflerine_gider", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("landing-login-link")).toHaveAttribute(
    "href",
    "/app",
  );
  await expect(page.getByTestId("landing-signup-link")).toHaveAttribute(
    "href",
    "/app?mode=signup",
  );
});

test("footer_hukuki_linkleri_dile_gore_dogru_sayfaya_gider", async ({
  page,
}) => {
  await page.goto("/");

  // Varsayılan EN.
  await expect(page.getByTestId("landing-terms-link")).toHaveAttribute(
    "href",
    "/terms/en",
  );
  await expect(page.getByTestId("landing-privacy-link")).toHaveAttribute(
    "href",
    "/privacy/en",
  );

  await page.getByTestId("landing-locale-tr-button").click();
  await expect(page.getByTestId("landing-terms-link")).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(page.getByTestId("landing-privacy-link")).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("footer_iletisim_linki_geri_bildirim_adresine_gider", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("landing-contact-link")).toHaveAttribute(
    "href",
    "mailto:ussasa155@gmail.com?subject=KOQEP%20support",
  );
});

test("dekoratif_canvas_arka_plani_ekran_okuyucudan_gizli", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("ascii-background")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
