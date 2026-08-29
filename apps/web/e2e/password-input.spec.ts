import { test, expect } from "@playwright/test";

// M11a devamı: göz ikonu + basılı-tutma (momentary) - login formunun şifre
// alanı üzerinden test ediliyor (PasswordInput'un 4 kullanım yerinden en
// erişilebiliri, login gerektirmiyor).

test("fare_basili_tutunca_sifre_gorunur_birakinca_gizlenir", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  // Erişilebilir ad show/hide arasında değiştiği için TEK bir locator
  // referansı yeterli değil - her adımda GÜNCEL adla yeniden sorgula
  // (Playwright locator'ları tembel ama seçici kriteri sabit kalır).
  const showToggle = page.getByRole("button", { name: "show" });
  const hideToggle = page.getByRole("button", { name: "hide" });

  await input.fill("gizli-sifre");
  await expect(input).toHaveAttribute("type", "password");

  await showToggle.dispatchEvent("mousedown");
  await expect(input).toHaveAttribute("type", "text");
  await expect(hideToggle).toBeVisible();

  await hideToggle.dispatchEvent("mouseup");
  await expect(input).toHaveAttribute("type", "password");
});

test("fare_basiliyken_disari_surukleyince_sifre_gizlenir", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  const showToggle = page.getByRole("button", { name: "show" });
  const hideToggle = page.getByRole("button", { name: "hide" });

  await showToggle.dispatchEvent("mousedown");
  await expect(input).toHaveAttribute("type", "text");

  // mouseup GELMEDEN mouseleave - sürükleyip bırakma senaryosu. React
  // onMouseLeave'i BUBBLING "mouseout" event'ini dinleyerek sentezliyor -
  // ham (bubble'lamayan) "mouseleave" event'ini doğrudan dispatchEvent ile
  // göndermek React'ın senkron handler'ını tetiklemiyor (gerçek bir
  // Playwright koşumuyla bulundu).
  await hideToggle.dispatchEvent("mouseout");
  await expect(input).toHaveAttribute("type", "password");
});

test("klavye_space_basili_tutunca_sifre_gorunur_birakinca_gizlenir", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  const toggle = page.getByRole("button", { name: "show" });

  await toggle.focus();
  await page.keyboard.down(" ");
  await expect(input).toHaveAttribute("type", "text");

  await page.keyboard.up(" ");
  await expect(input).toHaveAttribute("type", "password");
});

test("klavye_enter_basili_tutunca_sifre_gorunur_birakinca_gizlenir", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  const toggle = page.getByRole("button", { name: "show" });

  await toggle.focus();
  await page.keyboard.down("Enter");
  await expect(input).toHaveAttribute("type", "text");

  await page.keyboard.up("Enter");
  await expect(input).toHaveAttribute("type", "password");
});

// Ekran-okuyucuların "etkinleştir" hareketi çoğu zaman gerçek bir
// mousedown/keydown ÜRETMEDEN doğrudan bir `click` event'i gönderir -
// element.click() (native DOM metodu) TAM OLARAK bunu simüle ediyor,
// Playwright'ın .click()'i AKSİNE mousedown/mouseup sentezlemiyor.
test("down_up_izlenmeden_gelen_click_toggle_olarak_davranir_ekran_okuyucu_zarif_bozulma", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  const showToggle = page.getByRole("button", { name: "show" });
  const hideToggle = page.getByRole("button", { name: "hide" });

  await showToggle.evaluate((el: HTMLElement) => el.click());
  await expect(input).toHaveAttribute("type", "text");

  await hideToggle.evaluate((el: HTMLElement) => el.click());
  await expect(input).toHaveAttribute("type", "password");
});

test("gercek_fare_tiklamasi_cift_tetiklenmeden_momentary_davranir", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("password");
  const toggle = page.getByRole("button", { name: "show" });

  // Playwright'ın .click()'i gerçek bir mousedown+mouseup+click sentezler -
  // onClick fallback'i bunu "zaten ele alındı" diye tanıyıp NO-OP olmalı,
  // aksi halde mouseup'ın gizlemesini click'in tekrar açması gerekirdi.
  await toggle.click();
  await expect(input).toHaveAttribute("type", "password");
});
