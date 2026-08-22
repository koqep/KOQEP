import { PrismaClient } from '@prisma/client';
import { containsStructuralPii } from '../services/content-redaction.util';
import { AUTHOR_DELETED_CONTENT } from '../services/messages.service';

export interface BackfillMessageContentPiiResult {
  messagesRedacted: number;
  messageEditsRedacted: number;
  reportsRedacted: number;
}

// M6c Slice C (ADR-0005 Addendum #2): deleteAccount() M2.5'ten beri canlı -
// bugün DB'de zaten authorId:null (hesabı silinmiş) mesajlar/edit'ler/rapor
// snapshot'ları var, hiçbiri Slice C'nin yeni otomatik taramasından
// GEÇMEDEN oraya yazıldı. Bu script TÜM bu geçmiş satırları tarar, yapısal
// PII (e-posta/telefon) içerenleri redakte eder. IDEMPOTENT:
// backfill-totp-secrets.ts'in aksine ayrı bir "zaten işlendi" işaretine
// gerek yok - zaten redakte edilmiş içerik regex'e uymaz, ikinci koşu
// doğal olarak no-op.
export async function backfillMessageContentPii(
  prisma: PrismaClient,
): Promise<BackfillMessageContentPiiResult> {
  const orphanedMessages = await prisma.message.findMany({
    where: { authorId: null },
    select: { id: true, content: true },
  });
  const piiMessageIds = orphanedMessages
    .filter((message) => containsStructuralPii(message.content))
    .map((message) => message.id);
  if (piiMessageIds.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: piiMessageIds } },
      data: { content: AUTHOR_DELETED_CONTENT },
    });
  }

  const orphanedEdits = await prisma.messageEdit.findMany({
    where: { message: { authorId: null } },
    select: { id: true, previousContent: true },
  });
  const piiEditIds = orphanedEdits
    .filter((edit) => containsStructuralPii(edit.previousContent))
    .map((edit) => edit.id);
  if (piiEditIds.length > 0) {
    await prisma.messageEdit.updateMany({
      where: { id: { in: piiEditIds } },
      data: { previousContent: AUTHOR_DELETED_CONTENT },
    });
  }

  const orphanedReports = await prisma.report.findMany({
    where: { message: { authorId: null } },
    select: { id: true, reportedContent: true },
  });
  const piiReportIds = orphanedReports
    .filter((report) => containsStructuralPii(report.reportedContent))
    .map((report) => report.id);
  if (piiReportIds.length > 0) {
    await prisma.report.updateMany({
      where: { id: { in: piiReportIds } },
      data: { reportedContent: AUTHOR_DELETED_CONTENT },
    });
  }

  return {
    messagesRedacted: piiMessageIds.length,
    messageEditsRedacted: piiEditIds.length,
    reportsRedacted: piiReportIds.length,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result = await backfillMessageContentPii(prisma);
  console.log(
    `Mesaj içeriği PII backfill tamam. Redakte edilen mesaj: ${result.messagesRedacted}, düzenleme geçmişi: ${result.messageEditsRedacted}, rapor snapshot'ı: ${result.reportsRedacted}.`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  void main();
}
