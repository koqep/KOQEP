import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

describe('Message edit history access control (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let roomId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
    const room = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // Bu dosya signup/e-posta doğrulama akışını değil düzenleme geçmişi
  // erişim kontrolünü test ediyor - doğrulanmış bir kullanıcıyı doğrudan
  // oluşturup token imzalıyoruz (M2.5 Slice B).
  async function createTestUser(): Promise<{
    id: string;
    email: string;
    accessToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
      },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { id: user.id, email, accessToken };
  }

  async function createMessageWithEditHistory(authorId: string): Promise<{
    messageId: string;
    previousContent: string;
  }> {
    const previousContent = `ilk-hal-${randomUUID()}`;
    const message = await prisma.message.create({
      data: { content: `guncel-hal-${randomUUID()}`, roomId, authorId },
    });
    await prisma.messageEdit.create({
      data: { messageId: message.id, previousContent },
    });
    return { messageId: message.id, previousContent };
  }

  it('yazar_kendi_mesajinin_duzenleme_gecmisini_gorebilir', async () => {
    const author = await createTestUser();
    const { messageId, previousContent } = await createMessageWithEditHistory(
      author.id,
    );

    const response = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(200);

    const edits = response.body as { previousContent: string }[];
    expect(edits.map((e) => e.previousContent)).toContain(previousContent);
  });

  it('moderator_raporlanmis_bir_mesajin_gecmisini_gorebilir', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser();
    await prisma.user.update({
      where: { id: moderator.id },
      data: { role: 'moderator' },
    });
    const { messageId, previousContent } = await createMessageWithEditHistory(
      author.id,
    );
    // M5 Slice A: moderatör erişimi artık bu mesaja ait EN AZ BİR Report
    // satırı gerektiriyor (docs/THREAT-MODEL.md satır 12) - rapor DURUMU
    // önemsiz, sadece var olması yeterli.
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        messageId,
        reportedUserId: author.id,
        reportedContent: 'rapor edilen icerik',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);

    const edits = response.body as { previousContent: string }[];
    expect(edits.map((e) => e.previousContent)).toContain(previousContent);
  });

  it('rapor_olmayan_bir_mesaj_icin_moderator_bile_reddedilir', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser();
    await prisma.user.update({
      where: { id: moderator.id },
      data: { role: 'moderator' },
    });
    const { messageId } = await createMessageWithEditHistory(author.id);

    await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(403);
  });

  it('ne_yazar_ne_moderator_olan_kullanici_reddedilir', async () => {
    const author = await createTestUser();
    const bystander = await createTestUser();
    const { messageId } = await createMessageWithEditHistory(author.id);

    await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${bystander.accessToken}`)
      .expect(403);
  });

  it('bilinmeyen_mesaj_icin_404_doner', async () => {
    const author = await createTestUser();

    await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${randomUUID()}/edits`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(404);
  });
});
