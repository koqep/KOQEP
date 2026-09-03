import { test, expect, type Page } from "@playwright/test";

// İkinci, sarf edilebilir seed'lenmiş dev kullanıcı
// (apps/api/src/db/dev-seed.constants.ts DEV_USER_2_*) - sadece bu test
// tarafından kullanılıp gerçekten silinir. Birincil dev kullanıcıyı
// (dev@koqep.local) silmek diğer fullstack testlerini kırardı (M2.5 Slice C).
// DEV_USER_2 sadece BU dosyada, sadece TEK bir testte silinmeli - aynı
// hesabı ikinci bir testin de silmeye çalışması "zaten silinmiş hesapla
// giriş" çakışması üretir, bu yüzden M6c Slice B'nin redaksiyon doğrulaması
// AYRI bir test yerine bu testin İÇİNE eklendi.
const DEV_USER_2_EMAIL = "dev2@koqep.local";
const DEV_USER_2_PASSWORD = "dev-local-only-password-2";
const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";

async function loginAsDevUser2(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

async function loginAsDevUser(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

test("hesap_silinince_ayni_bilgilerle_giris_artik_basarisiz_olur_ve_redactMessageContent_varsayilan_acikken_mesaj_icerigi_redakte_edilir", async ({
  browser,
  page,
}) => {
  // M6c Slice B (ADR-0005 Addendum #2): checkbox varsayılan işaretli - bu
  // testte HİÇ dokunulmuyor, "kullanıcı hiçbir şey değiştirmeden sildi"
  // senaryosunun kendisi zaten gerçek default'u sınıyor.
  // #meta'ya BİLEREK geçiliyor (#general DEĞİL) - message-self-delete.spec.ts
  // #general'da AYNI placeholder metnini ("[Bu mesaj yazarı tarafından
  // silindi.]") üretiyor, iki dosya paralel worker'larda aynı odaya
  // yazarsa getByText sayfa-genelinde birden fazla eşleşmeye çarpar
  // (STATE.md'nin "paylaşılan dev odası" tuzağı - burada dosyalar-arası
  // hali).
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/app");
  await loginAsDevUser(otherPage);
  await otherPage.getByRole("button", { name: "#meta" }).click();

  await page.goto("/app");
  await loginAsDevUser2(page);
  await page.getByRole("button", { name: "#meta" }).click();

  const content = `redact-test-${Date.now()}`;
  await page.getByPlaceholder("write a message...").fill(content);
  await page.getByRole("button", { name: "send" }).click();
  await expect(page.getByText(content)).toBeVisible({ timeout: 10000 });
  await expect(otherPage.getByText(content)).toBeVisible({ timeout: 10000 });

  // M10 Faz 2 Slice B: "delete account" artık "account ▾" menüsünün içinde.
  // M13 Slice B: artık "settings" panelinin İÇİNDE (role="button", role=
  // "menuitem" DEĞİL).
  await page.getByRole("button", { name: "account" }).click();
  await page.getByRole("menuitem", { name: "settings" }).click();
  await page.getByRole("button", { name: "delete account" }).click();
  await page.getByRole("button", { name: "delete my account" }).click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByLabel("current password").fill(DEV_USER_2_PASSWORD);
  await page
    .getByRole("button", { name: "permanently delete my account" })
    .click();

  await expect(page.getByLabel("email")).toBeVisible({ timeout: 15000 });
  await expect(page.getByPlaceholder("write a message...")).toHaveCount(0);

  await page.getByLabel("email").fill(DEV_USER_2_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_2_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();

  // M9 Slice D2: AuthView artık `translateErrorCode`'a bağlı - varsayılan
  // (İngilizce) locale'de backend'in HAM Türkçe mesajı yerine doğru
  // çevrilmiş metin gösteriliyor.
  await expect(
    page.getByText("Incorrect email or password."),
  ).toBeVisible({
    timeout: 15000,
  });

  // Redaksiyon auth.service.ts'in kendi transaction'ında düz bir updateMany -
  // messages.service.ts'in editMessage/deleteOwnMessage'ının aksine bir WS
  // yayını TETİKLEMİYOR (bu dilimin kapsamı DIŞINDA, plan onayında yoktu) -
  // bu yüzden diğer sekme reload'dan SONRA gerçek DB durumunu görüyor.
  // Reload React state'ini sıfırlıyor - RoomView.tsx varsayılan olarak
  // ilk odaya (alfabetik, #general) döner, #meta'ya YENİDEN geçilmeli.
  await otherPage.reload();
  await expect(otherPage.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
  await otherPage.getByRole("button", { name: "#meta" }).click();
  // ADR-0005 hard-delete-yok kuralı yüzünden #meta'da bu testin ÖNCEKİ
  // koşularından kalan başka placeholder satırları da birikebilir - ekleme-
  // sadece mesaj listesinde en yeni her zaman en sonda, `.last()` ile
  // SADECE bu testin az önce redakte ettiği satıra daralt (bkz.
  // message-self-delete.spec.ts'teki AYNI gerekçe).
  await expect(
    otherPage.getByText("[Bu mesaj yazarı tarafından silindi.]").last(),
  ).toBeVisible({ timeout: 10000 });
  await expect(otherPage.getByText(content)).toHaveCount(0);

  await otherContext.close();
});
