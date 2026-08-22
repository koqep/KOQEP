import { containsStructuralPii } from './content-redaction.util';

describe('containsStructuralPii', () => {
  describe('e-posta eşleşmeli', () => {
    it.each([
      'ben ahmet, ahmet@ornek.com üzerinden ulaşabilirsiniz',
      'iletisim@koqep.local',
      'test.kullanici+etiket@alt.domain.com',
    ])('%s', (content) => {
      expect(containsStructuralPii(content)).toBe(true);
    });
  });

  describe('telefon eşleşmeli', () => {
    it.each([
      '0555 123 45 67',
      '05551234567',
      '+90 555 123 45 67',
      '+905551234567',
      '+1 415 555 2671',
    ])('%s', (content) => {
      expect(containsStructuralPii(content)).toBe(true);
    });
  });

  describe('yanlış-pozitif ÜRETMEMELİ', () => {
    it.each([
      'bugün hava çok güzel',
      'sıradan bir mesaj',
      '2024 yılında başladık',
      'sayfa 42',
      // Baştaki 0/+90 olmadan 5 ile başlayan 10 haneli bir dizi - referans/
      // sipariş numarası gibi görünebilir, telefon SAYILMAMALI.
      'referans kodum 5551234567',
      'oda #general, 35 mesajdan sonra seviye atladım',
    ])('%s', (content) => {
      expect(containsStructuralPii(content)).toBe(false);
    });
  });
});
