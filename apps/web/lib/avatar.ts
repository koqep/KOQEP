// M10 Faz 2 Slice D+E: deterministik ASCII avatar - saf `id → desen`
// fonksiyonu, hiçbir şey saklanmıyor/hesaplanmıyor, client-side üretiliyor
// (Faz 1 kararı). Seed olarak kullanıcı ID'si DEĞİL `username` kullanılıyor -
// web istemcisinde mesaj yazarları için authorId hiç yok (backend'in
// toMessageDto'su bilerek göndermiyor), UsersService.getProfile'ın select'i
// de id döndürmüyor. username @unique + hesap silinince (ADR-0005) o hesabın
// TÜM geçmiş mesajlarının authorUsername'ı null'a dönüyor (zaten "deleted
// user" render ediliyor) - yani canlı, null-olmayan bir authorUsername HER
// ZAMAN o an o adı taşıyan TEK canlı hesaba karşılık gelir, eski/yeniden-
// kullanılmış bir isimle asla karışmaz. Backend'e dokunmadan güvenli/yeterli.

const SHADES = ["░", "▒", "▓", "█"];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

const LARGE_GRID_ROWS = 5;
const LARGE_GRID_HALF_COLS = 3; // 3 benzersiz + 2 aynalı = 5 sütun

// Profil paneli için büyük render - 5x5 ayna-simetrik ızgara (GitHub
// identicon mantığı, dikey eksende ayna simetrisi). 3x5=15 bağımsız hücre,
// 4^15 kombinasyon - pratikte çakışmasız.
export function generateLargeAvatar(seed: string): string[] {
  const rows: string[] = [];
  for (let r = 0; r < LARGE_GRID_ROWS; r++) {
    const half: string[] = [];
    for (let c = 0; c < LARGE_GRID_HALF_COLS; c++) {
      half.push(SHADES[hashString(`${seed}:${r}:${c}`) % SHADES.length]);
    }
    rows.push([...half, ...half.slice(0, -1).reverse()].join(""));
  }
  return rows;
}

const SMALL_GLYPH_LENGTH = 6;

// Mesaj listesi + hesap menüsü için küçük render - BÜYÜK ızgaradan bir satır
// KESMİYOR, ayrı/aynalanmamış bir hash namespace'i kullanıyor. Neden: bir
// ayna-simetrik satırın SADECE 3 bağımsız hücresi var ([c0,c1,c2,c1,c0]),
// 5^3=125 sabit desen - milestone'un kendi 500-kullanıcı hedefinde
// ortalama ~4 kullanıcı aynı küçük avatarı paylaşırdı (doğum günü paradoksu).
// Bağımsız 6 karakterlik dizi çok daha fazla kombinasyon veriyor - "aynı
// kullanıcı her yerde aynı avatarı görür" (determinizm) korunuyor, sadece
// "küçük büyüğün birebir bir parçası" özelliği (hiçbir yerde vaat edilmemişti)
// düşüyor. seed null ise (myProfile henüz yüklenmemiş - TopBar/AccountMenu
// Slice A'dan beri her zaman mount'lu) boşluklarla ÇÖKMEDEN döner.
export function generateSmallAvatar(seed: string | null): string {
  if (seed === null) return " ".repeat(SMALL_GLYPH_LENGTH);
  let glyph = "";
  for (let i = 0; i < SMALL_GLYPH_LENGTH; i++) {
    glyph += SHADES[hashString(`${seed}:small:${i}`) % SHADES.length];
  }
  return glyph;
}
