import { PrismaClient } from '@prisma/client';
import { DEV_USER_EMAIL, DEV_ROOM_NAME } from './dev-seed.constants';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: { email: DEV_USER_EMAIL },
  });

  await prisma.room.upsert({
    where: { name: DEV_ROOM_NAME },
    update: {},
    create: { name: DEV_ROOM_NAME },
  });

  await prisma.$disconnect();
}

void main();
