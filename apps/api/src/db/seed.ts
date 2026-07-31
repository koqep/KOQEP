import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEV_USER_EMAIL,
  DEV_USER_USERNAME,
  DEV_USER_PASSWORD,
  DEV_USER_2_EMAIL,
  DEV_USER_2_USERNAME,
  DEV_USER_2_PASSWORD,
  DEV_INVITE_CODES,
} from './dev-seed.constants';
import { CORE_ROOM_NAMES } from './core-rooms.constants';

// Bu script her deploy'da (render.yaml preDeployCommand) production'a karşı da
// çalışıyor. Dev kullanıcı + davet kodları git'te düz metin sabitler - opt-in
// olmalı ki bilinen kimlik bilgileri/davet kodları production'da sessizce
// oluşmasın. Varsayılan (env yok) = KAPALI, sadece elle SEED_DEV_FIXTURES=true
// ile açılır. Oda her zaman oluşur - auth'tan bağımsız çekirdek altyapı.
const shouldSeedDevFixtures = process.env.SEED_DEV_FIXTURES === 'true';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  for (const name of CORE_ROOM_NAMES) {
    await prisma.room.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  if (!shouldSeedDevFixtures) {
    console.log(
      'Seed tamam (sadece oda). Dev kullanıcı ve davet kodları SEED_DEV_FIXTURES=true değilse oluşturulmaz.',
    );
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await argon2.hash(DEV_USER_PASSWORD);

  const devUser = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: { passwordHash },
    create: {
      email: DEV_USER_EMAIL,
      username: DEV_USER_USERNAME,
      passwordHash,
      // M2.5 Slice B'den beri login() emailVerifiedAt olmayan kullanıcıyı
      // reddediyor. Mevcut satırlar migration'ın backfill'iyle doğrulandı
      // ama TAZE bir DB'de (CI'ın her koşuda sıfırdan kurduğu Postgres
      // container'ı gibi) bu upsert'in create dalı ilk kez çalışıyor - o
      // yüzden burada da açıkça set edilmeli, yoksa dev kullanıcı hep
      // EMAIL_NOT_VERIFIED ile giriş yapamaz.
      emailVerifiedAt: new Date(),
    },
  });

  for (const code of DEV_INVITE_CODES) {
    await prisma.invite.upsert({
      where: { code },
      update: {},
      create: { code, issuedById: devUser.id },
    });
  }

  // Sarf edilebilir ikinci dev kullanıcı - sadece
  // apps/web/e2e-fullstack/delete-account.spec.ts bunu gerçekten siliyor.
  // upsert olduğu için bir önceki koşuda silinmişse burada kendiliğinden
  // yeniden oluşur (M2.5 Slice C).
  const passwordHash2 = await argon2.hash(DEV_USER_2_PASSWORD);
  await prisma.user.upsert({
    where: { email: DEV_USER_2_EMAIL },
    update: { passwordHash: passwordHash2 },
    create: {
      email: DEV_USER_2_EMAIL,
      username: DEV_USER_2_USERNAME,
      passwordHash: passwordHash2,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(
    `Seed tamam. Deneme daveti: ${DEV_INVITE_CODES[0]} (dev kullanıcı: ${DEV_USER_EMAIL} / ${DEV_USER_PASSWORD})`,
  );

  await prisma.$disconnect();
}

void main();
