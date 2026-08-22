// M6b Slice A (5651 trafik bilgisi saklama): gerçek istemci IP'sini
// Render+Cloudflare proxy zincirinden GÜVENLİ (sahtelenemez) şekilde okuyan
// TEK kaynak.
//
// DÜZELTME (2026-08-22, founder'ın production doğrulaması): Render'ın
// Mayıs 2021 tarihli belgesi ("gerçek IP'yi başa ekliyoruz") ARTIK DOĞRU
// DEĞİL - gerçek log gösterdi ki Render standart "sağdan sona ekleme"
// modelini kullanıyor. AYRICA API domaini DNS-only DEĞİL - gözlenen hop'lar
// (172.69.182.182, 172.71.151.28) cloudflare.com/ips'te yayınlanan
// 172.64.0.0/13 aralığında (2026-08-22'de canlı doğrulandı) - Cloudflare
// gerçekten araya giriyor.
//
// GÜVENLİK TASARIMI - pozisyon-doğrulamalı, sahtelenemez: Render istemcinin
// gönderdiği X-Forwarded-For'u HİÇ temizlemiyor (sadece ekliyor) - yani
// "zincirde bir yerde Cloudflare'e benzeyen bir IP var mı" diye STRING
// İÇERİĞİNDE arama yapmak SAHTELENEBİLİR (biri *.onrender.com'a doğrudan
// bağlanıp kendi isteğine Cloudflare'inkine benzeyen uydurma bir IP
// ekleyebilir). Bunun yerine SAĞDAN SOLA yürünür: her hop KENDİ GERÇEKTEN
// GÖRDÜĞÜ peer'ı ekliyor, istemci bu ekleme noktalarını asla EZEMEZ (sadece
// SOLUNA keyfi veri ekleyebilir, ki oraya hiç bakılmıyor). Bu, *.onrender.com
// açık kalsa BİLE güvenli - doğrudan bağlanan biri sadece KENDİ gerçek
// IP'sini "istemci" olarak rapor ettirir.
const PRIVATE_IPV4_RANGES = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8',
];

// cloudflare.com/ips'ten canlı çekildi (2026-08-22). Cloudflare bu listeyi
// zaman zaman günceller - değişirse bu dizi de güncellenmeli.
const CLOUDFLARE_IPV4_RANGES = [
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '108.162.192.0/18',
  '131.0.72.0/22',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
];

// Bilerek IPv4-only - küçük, bağımlılıksız bir CIDR eşleştirici (yeni paket
// eklenmedi). Bir IPv6 girdisi hiçbir aralığa uymaz (ipv4ToInt null döner),
// bu da onu otomatik olarak "güvenilmeyen" (yani döndürülecek aday) sayar -
// hata FIRLATMAZ, sadece Cloudflare'in kendi IPv6 edge'i nadir bir durumda
// yanlışlıkla "istemci" sayılabilir (veri-kalitesi sınırı, güvenlik açığı
// DEĞİL). CF-Connecting-IP mevcutsa bu durum zaten devreye girmeden önce
// doğru değeri döndürür.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function isInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  if (ipInt === null || networkInt === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function isInAnyRange(ip: string, ranges: string[]): boolean {
  return ranges.some((range) => isInCidr(ip, range));
}

function normalizeHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getRealClientIp(
  forwardedFor: string | string[] | undefined,
  cfConnectingIp: string | string[] | undefined,
  remoteAddress: string | undefined,
): string {
  const rawXff = normalizeHeaderValue(forwardedFor);
  const entries = rawXff
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (isInAnyRange(entry, PRIVATE_IPV4_RANGES)) {
        continue; // Render'ın kendi iç hop'u.
      }
      if (isInAnyRange(entry, CLOUDFLARE_IPV4_RANGES)) {
        // Bu pozisyon sahtelenemez - Render'ın LB'si GERÇEKTEN Cloudflare'den
        // bağlantı aldı. Cloudflare'in kendi garantili header'ı varsa onu
        // tercih et (Cloudflare'in kendi iç hop sayısından bağımsız).
        const cfValue = normalizeHeaderValue(cfConnectingIp);
        if (cfValue) return cfValue;
        continue; // CF-Connecting-IP yok - belki daha fazla Cloudflare iç hop'u var.
      }
      // Ne private ne Cloudflare - güvenilir altyapının GERÇEKTEN gördüğü,
      // istemcinin değiştiremediği son nokta.
      return entry;
    }
  }

  return remoteAddress ?? '';
}
