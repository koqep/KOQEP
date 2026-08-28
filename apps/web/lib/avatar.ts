// M10 Faz 2 Slice D+E: deterministik avatar - saf `id → desen` fonksiyonu,
// hiçbir şey saklanmıyor/hesaplanmıyor, client-side üretiliyor (Faz 1
// kararı). Seed olarak kullanıcı ID'si DEĞİL `username` kullanılıyor - web
// istemcisinde mesaj yazarları için authorId hiç yok (backend'in
// toMessageDto'su bilerek göndermiyor), UsersService.getProfile'ın select'i
// de id döndürmüyor. username @unique + hesap silinince (ADR-0005) o hesabın
// TÜM geçmiş mesajlarının authorUsername'ı null'a dönüyor (zaten "deleted
// user" render ediliyor) - yani canlı, null-olmayan bir authorUsername HER
// ZAMAN o an o adı taşıyan TEK canlı hesaba karşılık gelir, eski/yeniden-
// kullanılmış bir isimle asla karışmaz. Backend'e dokunmadan güvenli/yeterli.
//
// Bu dosya HAM hücre verisi (0-3 ton indeksi) döndürüyor, render KARARINI
// (unicode karakter mi, SVG rect mi) vermiyor - render `apps/web/app/
// components/Avatar.tsx`'te.

const SHADES_COUNT = 4;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

const LARGE_GRID_ROWS = 5;
const LARGE_GRID_HALF_COLS = 3; // 3 benzersiz + 2 aynalı = 5 sütun

// Profil paneli için büyük ızgara - 5x5 ayna-simetrik (GitHub identicon
// mantığı, dikey eksende ayna simetrisi). 3x5=15 bağımsız hücre, 4^15
// kombinasyon - pratikte çakışmasız.
export function generateLargeAvatarGrid(seed: string): number[][] {
  const rows: number[][] = [];
  for (let r = 0; r < LARGE_GRID_ROWS; r++) {
    const half: number[] = [];
    for (let c = 0; c < LARGE_GRID_HALF_COLS; c++) {
      half.push(hashString(`${seed}:${r}:${c}`) % SHADES_COUNT);
    }
    rows.push([...half, ...half.slice(0, -1).reverse()]);
  }
  return rows;
}

const SMALL_GLYPH_LENGTH = 6;

// Mesaj listesi + hesap menüsü için küçük ızgara - BÜYÜK ızgaradan bir satır
// KESMİYOR, ayrı/aynalanmamış bir hash namespace'i kullanıyor. Neden: bir
// ayna-simetrik satırın SADECE 3 bağımsız hücresi var ([c0,c1,c2,c1,c0]),
// 5^3=125 sabit desen - milestone'un kendi 500-kullanıcı hedefinde
// ortalama ~4 kullanıcı aynı küçük avatarı paylaşırdı (doğum günü paradoksu).
// Bağımsız 6 hücrelik dizi çok daha fazla kombinasyon veriyor - "aynı
// kullanıcı her yerde aynı avatarı görür" (determinizm) korunuyor, sadece
// "küçük büyüğün birebir bir parçası" özelliği (hiçbir yerde vaat edilmemişti)
// düşüyor. seed null ise (myProfile henüz yüklenmemiş - TopBar/AccountMenu
// Slice A'dan beri her zaman mount'lu, SADECE AccountMenu'den erişilebilir
// bu yol - MessageItem'ın kendi ternary'si null seed'i hiç buraya
// göndermiyor) null döner, "boş avatar nasıl görünür" kararı render
// katmanına (Avatar.tsx) bırakılıyor.
export function generateSmallAvatarGrid(seed: string | null): number[] | null {
  if (seed === null) return null;
  const cells: number[] = [];
  for (let i = 0; i < SMALL_GLYPH_LENGTH; i++) {
    cells.push(hashString(`${seed}:small:${i}`) % SHADES_COUNT);
  }
  return cells;
}
