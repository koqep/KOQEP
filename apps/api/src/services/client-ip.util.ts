// M6b Slice A (5651 trafik bilgisi saklama): gerçek istemci IP'sini
// Render'ın proxy zincirinden doğru okuyan TEK kaynak. API domaini
// Cloudflare'de DNS-only (gri bulut, founder doğruladı) - Cloudflare istek
// yoluna hiç girmiyor, CF-Connecting-IP HİÇ gelmez, SADECE Render'ın kendi
// proxy katmanı hesaba katılır.
//
// Render'ın kendi resmi yanıtı (community.render.com, "Send the correct
// X_FORWARDED_FOR" özellik talebi, Render temsilcisi Anurag Goel, Mayıs
// 2021): "we set the first IP in the list to the real client IP" - yani
// Render, istemcinin kendi gönderdiği (güvenilmez) X-Forwarded-For'u
// TEMİZLEMEDEN, gerçek istemci IP'sini listenin EN BAŞINA ekliyor. Bu,
// Express'in standart "trust proxy: N" modelinin (sağdan N hop güvenilir
// sayıp bir önceki değeri okuma) TAM TERSİ - bu yüzden Express'in genel
// trust proxy ayarı KULLANILMIYOR, bunun yerine bu özel fonksiyon var.
//
// BU BULGU MAYIS 2021 TARİHLİ, ESKİ - production'da gerçek bir istekle
// doğrulanması gerekiyor (docs/milestones/M6b-traffic-log-5651.md'nin
// founder-task listesi). Doğrulama BAŞARISIZ olursa tek değişmesi gereken
// yer FIRST_ENTRY_IS_REAL_CLIENT_IP sabiti - fonksiyonun geri kalanı ve
// çağıranları etkilenmez.
const FIRST_ENTRY_IS_REAL_CLIENT_IP = true;

export function getRealClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
): string {
  const rawValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const entries = rawValue
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries && entries.length > 0) {
    return FIRST_ENTRY_IS_REAL_CLIENT_IP
      ? entries[0]
      : entries[entries.length - 1];
  }

  return remoteAddress ?? '';
}
