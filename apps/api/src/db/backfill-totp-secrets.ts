import { PrismaClient } from '@prisma/client';
import {
  encryptTotpSecret,
  isTotpSecretEncrypted,
} from '../services/crypto.util';

export interface BackfillTotpSecretsResult {
  encrypted: number;
  alreadyEncrypted: number;
}

// M6 Slice E (ADR-0008): production'da bugün düz-metin totpSecret satırları
// var - bu onları AES-256-GCM ile şifreler. IDEMPOTENT: zaten şifreli
// (üç ':'-ayrılmış segmentli) satırları ATLAR, her deploy'un
// preDeployCommand'ında tekrar tekrar çalışması güvenli.
// Rollback: bu script'in kendisi geri alınabilir bir şey YAPMIYOR (var olan
// satırları şifreliyor, silmiyor/taşımıyor) - geri almak gerekirse
// decryptTotpSecret ile ters yönde tek seferlik bir script yazılır, burada
// hazır bulunmuyor çünkü normal akışta ihtiyaç duyulmaz.
export async function backfillTotpSecrets(
  prisma: PrismaClient,
): Promise<BackfillTotpSecretsResult> {
  const users = await prisma.user.findMany({
    where: { totpSecret: { not: null } },
    select: { id: true, totpSecret: true },
  });

  let encrypted = 0;
  let alreadyEncrypted = 0;

  for (const user of users) {
    const stored = user.totpSecret;
    if (!stored) {
      continue;
    }
    if (isTotpSecretEncrypted(stored)) {
      alreadyEncrypted += 1;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptTotpSecret(stored) },
    });
    encrypted += 1;
  }

  return { encrypted, alreadyEncrypted };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result = await backfillTotpSecrets(prisma);
  console.log(
    `TOTP secret backfill tamam. Şifrelenen: ${result.encrypted}, zaten şifreliydi: ${result.alreadyEncrypted}.`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  void main();
}
