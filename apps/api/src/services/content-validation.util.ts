// M7b Slice E: THREAT-MODEL.md'nin açık maddesi - metin-only, monospace-
// terminal-estetikli bir üründe "zalgo" (bir grapheme'e onlarca/yüzlerce
// birleşik işaret yığma) düşük-eforlu bir taciz yöntemi, sadece hedefi
// değil odadaki HERKESİN okuma deneyimini bozuyor. Intl.Segmenter Node
// 22'de native (yeni bağımlılık yok) - her grapheme cluster'ı (temel
// karakter + üzerine binen birleşik işaretler) TEK bir segment olarak
// döndürüyor, cluster'ın codepoint sayısından biri temel karakter,
// gerisi birleşik işaret.
const MAX_COMBINING_MARKS_PER_GRAPHEME = 5;
const graphemeSegmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' });

// Gerçek çok-dilli metin (Vietnamca, Arapça harekeleri, Hintçe birleşik
// ünlüler) grapheme başına genelde 1-4 birleşik işaret kullanır - zalgo
// metni tipik olarak düzinelerce/yüzlerce yığar. 5 cömert bir sınır,
// meşru metni geçirirken gerçek istismarı yakalıyor.
export function hasExcessiveCombiningMarks(content: string): boolean {
  for (const { segment } of graphemeSegmenter.segment(content)) {
    if (Array.from(segment).length - 1 > MAX_COMBINING_MARKS_PER_GRAPHEME) {
      return true;
    }
  }
  return false;
}
