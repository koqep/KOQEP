import { PrismaClient } from '@prisma/client';
import { DEV_USER_EMAIL } from './dev-seed.constants';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: { email: DEV_USER_EMAIL },
  });

  await prisma.$disconnect();
}

void main();
