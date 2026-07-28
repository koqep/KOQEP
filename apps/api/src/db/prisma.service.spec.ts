import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('kaydeder_ve_geri_okur_oda_ve_mesaji', async () => {
    const room = await prisma.room.create({
      data: { name: `test-room-${randomUUID()}` },
    });

    const message = await prisma.message.create({
      data: { content: 'merhaba dünya', roomId: room.id },
    });

    const found = await prisma.message.findUniqueOrThrow({
      where: { id: message.id },
    });

    expect(found.content).toBe('merhaba dünya');
    expect(found.roomId).toBe(room.id);

    await prisma.message.delete({ where: { id: message.id } });
    await prisma.room.delete({ where: { id: room.id } });
  });

  it('reddeder_var_olmayan_oda_icin_mesaj_olusturmayi', async () => {
    await expect(
      prisma.message.create({
        data: { content: 'kayıp oda', roomId: randomUUID() },
      }),
    ).rejects.toThrow();
  });
});
