import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';
import { backfillMessageContentPii } from './../src/db/backfill-message-content-pii';

const AUTHOR_DELETED_CONTENT = '[Bu mesaj yazarı tarafından silindi.]';

// M6c Slice C: backfillMessageContentPii'nin gerçek DB satırları üzerinde
// çalıştığını kanıtlar - deleteAccount() Slice C'den ÖNCE canlıyken silinmiş
// bir hesabın (authorId:null) yapısal PII içeren içeriğini simüle eder,
// backfill'in onu redakte ettiğini VE ikinci koşunun idempotent olduğunu
// (zaten redakte edilmiş satırlara tekrar dokunmadığını) doğrular.
describe('Mesaj içeriği PII backfill (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('authorId_null_satirlarda_yapisal_pii_redakte_eder_temiz_olana_dokunmaz_idempotenttir', async () => {
    const room = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });

    // authorId:null - uygulamanın kendi deleteAccount() akışını BAYPAS
    // ederek doğrudan Prisma ile yazılıyor, Slice C ÖNCESİ silinmiş bir
    // hesabın geride bıraktığı satırı simüle ediyor.
    const dirtyMessage = await prisma.message.create({
      data: {
        roomId: room.id,
        authorId: null,
        content: `eski mesaj - ulaş ${randomUUID()}@ornek.com`,
      },
    });
    const cleanMessage = await prisma.message.create({
      data: { roomId: room.id, authorId: null, content: 'sıradan eski mesaj' },
    });
    const dirtyEdit = await prisma.messageEdit.create({
      data: {
        messageId: cleanMessage.id,
        previousContent: '0555 123 45 67 den ara',
      },
    });
    const dirtyReport = await prisma.report.create({
      data: {
        messageId: cleanMessage.id,
        reportedContent: 'iletisim@ornek.com',
      },
    });

    const firstRun = await backfillMessageContentPii(prisma);
    expect(firstRun.messagesRedacted).toBeGreaterThanOrEqual(1);
    expect(firstRun.messageEditsRedacted).toBeGreaterThanOrEqual(1);
    expect(firstRun.reportsRedacted).toBeGreaterThanOrEqual(1);

    const redactedMessage = await prisma.message.findUniqueOrThrow({
      where: { id: dirtyMessage.id },
    });
    expect(redactedMessage.content).toBe(AUTHOR_DELETED_CONTENT);

    const untouchedMessage = await prisma.message.findUniqueOrThrow({
      where: { id: cleanMessage.id },
    });
    expect(untouchedMessage.content).toBe('sıradan eski mesaj');

    const redactedEdit = await prisma.messageEdit.findUniqueOrThrow({
      where: { id: dirtyEdit.id },
    });
    expect(redactedEdit.previousContent).toBe(AUTHOR_DELETED_CONTENT);

    const redactedReport = await prisma.report.findUniqueOrThrow({
      where: { id: dirtyReport.id },
    });
    expect(redactedReport.reportedContent).toBe(AUTHOR_DELETED_CONTENT);

    // İdempotentlik: ikinci koşu bu ÜÇ satırı ARTIK PII olarak görmüyor
    // (içerik zaten placeholder) - sayaç bu satırlar için tekrar artmıyor.
    const secondRun = await backfillMessageContentPii(prisma);
    expect(secondRun.messagesRedacted).toBe(0);
    expect(secondRun.messageEditsRedacted).toBe(0);
    expect(secondRun.reportsRedacted).toBe(0);
  });
});
