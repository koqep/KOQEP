import {
  sha256Hex,
  encryptTotpSecret,
  decryptTotpSecret,
  isTotpSecretEncrypted,
} from './crypto.util';

describe('crypto.util', () => {
  describe('sha256Hex', () => {
    it('ayni_girdi_icin_deterministik_sonuc_uretir', () => {
      expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    });

    it('farkli_girdiler_icin_farkli_sonuc_uretir', () => {
      expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
    });
  });

  describe('TOTP secret şifreleme (ADR-0008)', () => {
    const originalKey = process.env.TOTP_ENCRYPTION_KEY;

    beforeAll(() => {
      // Testler kendi anahtarını taşır - gerçek/CI ortam değişkenine bağımlı değil.
      process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    });

    afterAll(() => {
      process.env.TOTP_ENCRYPTION_KEY = originalKey;
    });

    it('sifreleyip_desifre_edince_orijinal_degeri_dondurur', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(decryptTotpSecret(encrypted)).toBe(plaintext);
    });

    it('ayni_girdiyi_iki_kez_sifreleyince_farkli_ciphertext_uretir', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      // Rastgele IV nedeniyle - aynı düz metin her seferinde farklı
      // saklanmalı, yoksa aynı secret'a sahip iki satır DB'de eşleşir olurdu.
      expect(encryptTotpSecret(plaintext)).not.toBe(
        encryptTotpSecret(plaintext),
      );
    });

    it('sifreli_format_uc_segmentli_ve_isTotpSecretEncrypted_dogru_taniyor', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');
      expect(encrypted.split(':')).toHaveLength(3);
      expect(isTotpSecretEncrypted(encrypted)).toBe(true);
    });

    it('duz_metin_bir_degeri_oldugu_gibi_dondurur_geriye_uyumluluk', () => {
      // Backfill edilmemiş eski bir satırı simüle eder - ':' içermeyen
      // base32 secret. Bu tolerans olmadan backfill script'i ile kod
      // deploy'u arasında kesin bir sıralama zorunlu olurdu (ADR-0008).
      const plaintext = 'JBSWY3DPEHPK3PXP';
      expect(isTotpSecretEncrypted(plaintext)).toBe(false);
      expect(decryptTotpSecret(plaintext)).toBe(plaintext);
    });

    it('eksik_anahtarla_aciklayici_bir_hata_firlatir', () => {
      const saved = process.env.TOTP_ENCRYPTION_KEY;
      delete process.env.TOTP_ENCRYPTION_KEY;

      expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow(
        'TOTP_ENCRYPTION_KEY',
      );

      process.env.TOTP_ENCRYPTION_KEY = saved;
    });

    it('yanlis_boyutlu_anahtarla_aciklayici_bir_hata_firlatir', () => {
      const saved = process.env.TOTP_ENCRYPTION_KEY;
      process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');

      expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow(
        'TOTP_ENCRYPTION_KEY',
      );

      process.env.TOTP_ENCRYPTION_KEY = saved;
    });
  });
});
