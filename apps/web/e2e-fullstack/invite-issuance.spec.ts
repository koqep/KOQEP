import { test, expect } from "@playwright/test";

// M4 Slice B: manuel "davet oluştur" kaldırıldı, davetler artık sadece
// seviye atlayınca otomatik kazanılıyor. Bu yüzden ayrı, sarf edilebilir
// bir kullanıcı kullanıyoruz (apps/api/src/db/dev-seed.constants.ts
// DEV_USER_LEVELUP_*) - seed.ts her koşuda bunu eşiğin TAM BİR MESAJ
// öncesine sıfırlıyor, böylece test tek gerçek mesajla seviye atlatıp
// gerçek bir Invite satırı üretebiliyor (dev@koqep.local'i kullanmadık,
// çünkü diğer fullstack testler de onu kullanıyor - paylaşılan XP durumu
// bu testin güvenilirliğini bozardı).
const DEV_USER_LEVELUP_EMAIL = "levelup@koqep.local";
const DEV_USER_LEVELUP_PASSWORD = "dev-local-only-password-3";

test("seviye_atlayinca_kazanilan_kod_gercek_signupta_gercekten_calisir", async ({
  browser,
}) => {
  const inviterContext = await browser.newContext();
  const inviterPage = await inviterContext.newPage();

  await inviterPage.goto("/");
  await inviterPage.getByLabel("e-posta").fill(DEV_USER_LEVELUP_EMAIL);
  await inviterPage.getByLabel("şifre").fill(DEV_USER_LEVELUP_PASSWORD);
  await inviterPage.getByRole("button", { name: "giriş yap" }).click();
  await expect(inviterPage.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });

  // Seed eşiğin tam bir mesaj öncesine sıfırlıyor - bu tek gerçek mesaj
  // seviye atlatıp aynı transaction'da gerçek bir Invite satırı üretiyor.
  const input = inviterPage.getByPlaceholder("mesaj yaz...");
  await input.fill(`seviye-atlama-${Date.now()}`);
  await inviterPage.getByRole("button", { name: "gönder" }).click();
  await expect(inviterPage.getByText(`seviye-atlama-`)).toBeVisible({
    timeout: 10000,
  });

  await inviterPage.getByRole("button", { name: "invites" }).click();
  // GET /invites en yeniden eskiye sıralıyor - az önce kazanılan davet
  // her zaman ilk satır, önceki bir koşudan kalan satırlardan etkilenmez.
  const inviteRow = inviterPage.getByRole("listitem").first();
  await expect(inviteRow).toBeVisible({ timeout: 10000 });
  const code = (await inviteRow.locator("span").first().textContent())?.trim();
  expect(code).toBeTruthy();

  const newUserContext = await browser.newContext();
  const newUserPage = await newUserContext.newPage();
  await newUserPage.goto("/");
  await newUserPage
    .getByRole("button", { name: "hesabın yok mu? kayıt ol" })
    .click();

  await newUserPage.getByLabel("davet kodu").fill(code as string);
  await newUserPage
    .getByLabel("e-posta")
    .fill(`invited-${Date.now()}@koqep.local`);
  await newUserPage.getByLabel("kullanıcı adı").fill(`invited${Date.now()}`);
  await newUserPage.getByLabel("şifre").fill("a-strong-new-password");
  // M6 Slice A: signup formu artık zorunlu bir onay checkbox'ı içeriyor,
  // işaretlenmeden "kayıt ol" disabled kalıyor.
  await newUserPage.getByRole("checkbox").check();
  await newUserPage.getByRole("button", { name: "kayıt ol" }).click();

  // Signup artık giriş yapmıyor (M2.5 Slice B) - bu testin kanıtladığı şey
  // "gerçek üretilen kod signup'ta gerçekten işe yarıyor mu", giriş akışı
  // ayrı bir testte (email-verification.spec.ts) kanıtlanıyor.
  await expect(
    newUserPage.getByText(
      "Kaydını tamamlamak için e-postana gönderilen bağlantıya tıkla.",
    ),
  ).toBeVisible({ timeout: 15000 });

  // Panel gerçekten kullanılmış durumu yansıtıyor mu - GET /invites'ın
  // gerçek DB durumunu doğru gösterdiğinin kanıtı.
  await inviterPage.reload();
  await inviterPage.getByLabel("e-posta").fill(DEV_USER_LEVELUP_EMAIL);
  await inviterPage.getByLabel("şifre").fill(DEV_USER_LEVELUP_PASSWORD);
  await inviterPage.getByRole("button", { name: "giriş yap" }).click();
  await expect(inviterPage.getByPlaceholder("mesaj yaz...")).toBeEnabled({
    timeout: 15000,
  });
  await inviterPage.getByRole("button", { name: "invites" }).click();
  await expect(
    inviterPage.getByRole("listitem").first().getByText("kullanıldı"),
  ).toBeVisible({ timeout: 10000 });

  await inviterContext.close();
  await newUserContext.close();
});
