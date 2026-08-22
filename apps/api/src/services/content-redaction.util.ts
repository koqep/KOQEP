// M6c Slice C (ADR-0005 Addendum #2): deleteAccount()'ta kullanıcı
// redactMessageContent'i işaretlemese bile devreye giren DAR bir otomatik
// güvenlik ağı - sadece YAPISAL kimlik desenlerini (e-posta, telefon)
// yakalıyor. Bağlamsal ifşayı (isim, dolaylı ipucu) YAKALAMAZ - milestone
// dosyasının "Out of scope: %100 otomatik PII tespiti yok" maddesiyle
// tutarlı, best-effort bir kontrol.
//
// URL BİLEREK dahil edilmedi - MessageContent.tsx (M7b Slice E) çıplak
// URL'leri linkify ile tıklanabilir link olarak render ediyor, yani link
// paylaşmak platformda normal/beklenen bir davranış. "URL içeren her mesajı
// redakte et" kuralı sıradan bir haber linkini de kişisel bir profil
// linkini de aynı şekilde (ve çok daha sık ilkini) vururdu.
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Türkiye mobil formatı (05XX XXX XX XX / +905XX...) + genel uluslararası
// +<ülke kodu><10+ hane>. Baştaki '0' YA DA '+90' ZORUNLU - aksi halde
// herhangi bir 10 haneli, 5 ile başlayan sayı dizisi (bir referans/sipariş
// numarası gibi) yanlış-pozitif üretirdi.
const TR_MOBILE_PATTERN =
  /(?:\+90[\s.-]?5\d{2}|\b05\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/;
const INTERNATIONAL_PHONE_PATTERN =
  /\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3,4}[\s.-]?\d{2,4}\b/;

export function containsStructuralPii(content: string): boolean {
  return (
    EMAIL_PATTERN.test(content) ||
    TR_MOBILE_PATTERN.test(content) ||
    INTERNATIONAL_PHONE_PATTERN.test(content)
  );
}
