import { test, expect, type Page } from "@playwright/test";

// M9 Slice D1: RoomView.tsx'in WS exception handler'ı sadeleştirilip
// eksik 2 dalı (MESSAGE_INVALID_CONTENT/ROOM_ACCESS_DENIED) kazandı -
// bu dosya gerçek backend'in `hasExcessiveCombiningMarks` doğrulamasını
// (apps/api/src/services/content-validation.util.ts, THREAT-MODEL'in
// zalgo koruması) tetikleyip yeni dalın GERÇEKTEN doğru mesajı ürettiğini
// kanıtlıyor - room-moderation.service.spec.ts'in AYNI zalgo desenini
// (20 birleşik işaret, sınır 5) kullanıyor. Frontend'de bu içeriği
// engelleyen bir ön-kontrol YOK (message-round-trip.spec.ts'in
// composer'ı bilerek), yani mesaj gerçekten WS'e ulaşıp reddediliyor.
const DEV_USER_EMAIL = "dev@koqep.local";
const DEV_USER_PASSWORD = "dev-local-only-password";

async function loginAsDevUser(page: Page): Promise<void> {
  await page.getByLabel("email").fill(DEV_USER_EMAIL);
  await page.getByLabel("password").fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "log in" }).click();
  await expect(page.getByPlaceholder("write a message...")).toBeEnabled({
    timeout: 15000,
  });
}

test("zalgo_icerik_gonderince_yeni_eklenen_dal_dogru_ingilizce_mesaji_gosterir", async ({
  page,
}) => {
  await page.goto("/app");
  await loginAsDevUser(page);

  const zalgoContent = "z" + "́".repeat(20);
  const input = page.getByPlaceholder("write a message...");
  await input.fill(zalgoContent);
  await page.getByRole("button", { name: "send" }).click();

  await expect(
    page.getByText("Your message contains invalid characters."),
  ).toBeVisible({ timeout: 10000 });
});
