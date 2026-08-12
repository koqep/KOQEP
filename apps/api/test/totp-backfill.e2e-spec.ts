import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Secret, TOTP } from 'otpauth';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { backfillTotpSecrets } from './../src/db/backfill-totp-secrets';
import { decryptTotpSecret } from './../src/services/crypto.util';

// M6 Slice E (ADR-0008): backfillTotpSecrets'ın gerçek bir DB satırı
// üzerinde çalıştığını kanıtlar - düz-metin bir satırı AYNI uygulamanın
// kendi encrypt-yazma yolunu BAYPAS ederek doğrudan Prisma ile yazıp
// (production'daki eski bir satırı simüle eder), backfill'in onu şifrelediğini,
// tekrar çalıştırmanın idempotent olduğunu ve backfill edilmiş satırın
// gerçek bir login+TOTP akışında hâlâ çalıştığını doğrular.
describe('TOTP secret backfill (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('duz_metin_satiri_sifreler_idempotenttir_ve_login_calismaya_devam_eder', async () => {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';
    const passwordHash = await argon2.hash(password);
    const totpSecret = new Secret();

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerifiedAt: new Date(),
        // Uygulamanın kendi savePendingSecret'ı hep şifreli yazıyor -
        // burada DOĞRUDAN Prisma ile düz metin yazarak production'daki
        // henüz backfill edilmemiş eski bir satırı simüle ediyoruz.
        totpSecret: totpSecret.base32,
        totpEnabledAt: new Date(),
      },
    });

    const beforeBackfill = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(beforeBackfill.totpSecret).toBe(totpSecret.base32);

    const firstRun = await backfillTotpSecrets(prisma);
    expect(firstRun.encrypted).toBeGreaterThanOrEqual(1);

    const afterFirstRun = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(afterFirstRun.totpSecret).not.toBe(totpSecret.base32);
    expect(afterFirstRun.totpSecret).not.toBeNull();
    expect(decryptTotpSecret(afterFirstRun.totpSecret as string)).toBe(
      totpSecret.base32,
    );

    // İdempotentlik: ikinci koşu bu satırı TEKRAR şifrelemiyor - AES-GCM
    // rastgele IV kullandığı için yeniden şifrelenseydi saklanan değer
    // DEĞİŞİRDİ (aynı düz metin için bile). Değişmediğini doğrulamak,
    // backfill'in satırı zaten-şifreli diye atladığının kanıtı.
    await backfillTotpSecrets(prisma);
    const afterSecondRun = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(afterSecondRun.totpSecret).toBe(afterFirstRun.totpSecret);

    // Round-trip'in gerçek doğrulaması: backfill edilmiş satır üzerinden
    // gerçek bir login+TOTP akışı hâlâ çalışıyor mu.
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    const totp = new TOTP({ secret: totpSecret });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, totpCode: totp.generate() })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/totp/disable')
      .set({ Authorization: `Bearer ${accessToken}` })
      .send({ totpCode: totp.generate() })
      .expect(201);
  });
});
