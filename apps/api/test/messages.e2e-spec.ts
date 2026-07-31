import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import {
  DEV_USER_EMAIL,
  DEV_USER_USERNAME,
} from './../src/db/dev-seed.constants';

describe('Messages REST (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let roomId: string;
  const roomName = `test-room-${randomUUID()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    const jwtService = moduleFixture.get(JwtService);

    const user = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: {
        email: DEV_USER_EMAIL,
        username: DEV_USER_USERNAME,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const room = await prisma.room.create({ data: { name: roomName } });
    roomId = room.id;

    const base = new Date('2026-01-01T00:00:00.000Z').getTime();
    for (let i = 0; i < 3; i++) {
      await prisma.message.create({
        data: {
          content: `mesaj-${i}`,
          roomId,
          createdAt: new Date(base + i * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { roomId } });
    await prisma.room.delete({ where: { id: roomId } });
    await app.close();
  });

  it('doner_mesajlari_eskiden_yeniye_sirali', async () => {
    const response = await request(app.getHttpServer())
      .get(`/rooms/${roomName}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      messages: { content: string }[];
      nextCursor: string | null;
    };
    expect(body.messages.map((m) => m.content)).toEqual([
      'mesaj-0',
      'mesaj-1',
      'mesaj-2',
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it('reddeder_token_olmadan', async () => {
    await request(app.getHttpServer())
      .get(`/rooms/${roomName}/messages`)
      .expect(401);
  });

  it('limit_parametresini_uygular_ve_nextCursor_doner', async () => {
    const response = await request(app.getHttpServer())
      .get(`/rooms/${roomName}/messages?limit=2`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      messages: { content: string }[];
      nextCursor: string | null;
    };
    expect(body.messages).toHaveLength(2);
    expect(body.messages.map((m) => m.content)).toEqual(['mesaj-1', 'mesaj-2']);
    expect(body.nextCursor).not.toBeNull();
  });

  it('donen_nextCursor_gercekten_bir_sonraki_daha_eski_sayfayi_getirir', async () => {
    const firstPage = await request(app.getHttpServer())
      .get(`/rooms/${roomName}/messages?limit=2`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const firstBody = firstPage.body as {
      messages: { content: string }[];
      nextCursor: string | null;
    };
    expect(firstBody.messages.map((m) => m.content)).toEqual([
      'mesaj-1',
      'mesaj-2',
    ]);
    expect(firstBody.nextCursor).not.toBeNull();

    const secondPage = await request(app.getHttpServer())
      .get(`/rooms/${roomName}/messages?limit=2&cursor=${firstBody.nextCursor}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const secondBody = secondPage.body as {
      messages: { content: string }[];
      nextCursor: string | null;
    };
    expect(secondBody.messages.map((m) => m.content)).toEqual(['mesaj-0']);
    expect(secondBody.nextCursor).toBeNull();
  });

  it('doner_404_var_olmayan_oda_icin', async () => {
    await request(app.getHttpServer())
      .get(`/rooms/hic-yok-${randomUUID()}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
