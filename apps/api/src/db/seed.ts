import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEV_USER_EMAIL,
  DEV_USER_PASSWORD,
  DEV_ROOM_NAME,
  DEV_INVITE_CODES,
} from './dev-seed.constants';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const passwordHash = await argon2.hash(DEV_USER_PASSWORD);

  const devUser = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: { passwordHash },
    create: { email: DEV_USER_EMAIL, passwordHash },
  });

  await prisma.room.upsert({
    where: { name: DEV_ROOM_NAME },
    update: {},
    create: { name: DEV_ROOM_NAME },
  });

  for (const code of DEV_INVITE_CODES) {
    await prisma.invite.upsert({
      where: { code },
      update: {},
      create: { code, issuedById: devUser.id },
    });
  }

  console.log(
    `Seed tamam. Deneme daveti: ${DEV_INVITE_CODES[0]} (dev kullanıcı: ${DEV_USER_EMAIL} / ${DEV_USER_PASSWORD})`,
  );

  await prisma.$disconnect();
}

void main();
