// M6 Slice C: 8 dosyada birebir tekrar eden input stilinden çıkarıldı.
// Odak göstergesi focus-visible:border-neutral-100 + ring-offset ile - eski
// focus:border-neutral-600 arka plana karşı ~2.53:1'di (WCAG 2.4.11'i
// geçmiyordu), yeni border ~3.63:1. ring-offset border ile ring arasına
// arka-plan renginde bir boşluk sokuyor, aynı renkte olsalar bile ikisi
// tek kalın çizgi değil iki ayrı eşmerkezli şekil olarak okunuyor.
export const inputClassName =
  "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus-visible:border-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-100 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";
