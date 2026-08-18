import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// M7a Slice F: HaveIBeenPwned'in k-anonymity range API'si SHA-1 istiyor -
// SHA-256 değil, PasswordPolicyService bunu kullanıyor.
export function sha1Hex(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

// M6 Slice E (ADR-0008): TOTP secret'larını alan-seviyesinde şifreler.
// argon2 burada işe yaramaz - tek yönlü, ama kod doğrulaması secret'ı
// GERİ DÖNDÜRÜLEBİLİR şekilde okuyabilmeyi gerektiriyor.
const TOTP_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const TOTP_ENCRYPTION_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;

function getTotpEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOTP_ENCRYPTION_KEY ortam değişkeni tanımlı değil.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== TOTP_ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY base64 çözüldüğünde ${TOTP_ENCRYPTION_KEY_BYTES} byte olmalı, ${key.length} byte geldi.`,
    );
  }
  return key;
}

// Saklama formatı: "iv:authTag:ciphertext", üçü de base64. Bu üç-segmentli
// şekil aynı zamanda decryptTotpSecret/isTotpSecretEncrypted'ın eski
// düz-metin (hiç ':' içermeyen base32) satırları ayırt etmesinin dayanağı.
export function encryptTotpSecret(plaintext: string): string {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv(
    TOTP_ENCRYPTION_ALGORITHM,
    getTotpEncryptionKey(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((buf) => buf.toString('base64'))
    .join(':');
}

export function isTotpSecretEncrypted(stored: string): boolean {
  return stored.split(':').length === 3;
}

// M6 Slice E (ADR-0008): GERİYE-UYUMLU (tolerant) - üç-segmentli şifreli
// formatta DEĞİLSE değeri OLDUĞU GİBİ döndürür (henüz backfill edilmemiş
// eski bir düz-metin satır). Bu tolerans, backfill script'i ile kod
// deploy'u arasında kesin bir sıralama zorunluluğunu ortadan kaldırıyor -
// KALICI bırakılıyor, sonradan kaldırılacak bir "contract" adımı yok.
export function decryptTotpSecret(stored: string): string {
  if (!isTotpSecretEncrypted(stored)) {
    return stored;
  }

  const [ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const decipher = createDecipheriv(
    TOTP_ENCRYPTION_ALGORITHM,
    getTotpEncryptionKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
