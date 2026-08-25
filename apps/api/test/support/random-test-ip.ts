import { randomInt } from 'crypto';

// M6b Slice D: paralel koşan e2e dosyalarının (jest-e2e.json'da runInBand
// yok, ayrı worker süreçleri) çarpışmayan sahte X-Forwarded-For IP'lere
// ihtiyacı var - küçük bir aralık (ör. sadece RFC 5737 203.0.113.0/24,
// 254 değer) dosyalar arası çarpışabiliyor (gerçek bir e2e koşumunda
// bulundu: traffic-log-rest.e2e-spec.ts'in health testi, traffic-log-ws.
// e2e-spec.ts'in AYNI rastgele ürettiği IP'yle çarpıştı). İlk oktet
// 220-254 aralığında - client-ip.util.ts'in PRIVATE_IPV4_RANGES
// (10/8, 172.16/12, 192.168/16, 127/8) ve CLOUDFLARE_IPV4_RANGES'inin
// (en yüksek ilk oktet: 198) HİÇBİRİYLE örtüşmüyor, getRealClientIp bu
// IP'yi olduğu gibi döndürür. Kalan üç oktet tam rastgele - ~500 milyon
// kombinasyon, çarpışma ihtimali ihmal edilebilir.
export function randomTestIp(): string {
  const first = randomInt(220, 255);
  const second = randomInt(0, 256);
  const third = randomInt(0, 256);
  const fourth = randomInt(0, 256);
  return `${first}.${second}.${third}.${fourth}`;
}
