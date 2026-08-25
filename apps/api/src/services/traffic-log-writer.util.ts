import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { computeTrafficLogIntegrityHash } from './traffic-log-integrity.util';

const logger = new Logger('TrafficLogWriter');

export interface TrafficLogWriteFields {
  serviceType: string;
  ipAddress: string;
  startedAt: Date | null;
  endedAt: Date | null;
  connectionId: string | null;
  bytesTransferred: number | null;
  userId: string | null;
}

// M6b Slice D: Slice C'nin TrafficLogMiddleware'indeki yazı+P2003-retry
// mantığının çıkarılmış hâli - REST (Slice C) ve WS (messages.gateway.ts)
// AYNI fonksiyonu çağırıyor, davranış tek yerde. /auth/delete-account
// sonrası bulunan FK-ihlali (P2003) retry deseni burada da geçerli - WS
// tarafında da bir bağlantı END'i, o kullanıcının hesabı SİLİNDİKTEN
// SONRA (nadiren ama mümkün - handleDisconnect senkron değil) tetiklenebilir.
export function writeTrafficLogRow(
  prisma: PrismaService,
  fields: TrafficLogWriteFields,
  context: string,
): void {
  const integrityHash = computeTrafficLogIntegrityHash({
    serviceType: fields.serviceType,
    ipAddress: fields.ipAddress,
    startedAt: fields.startedAt,
    endedAt: fields.endedAt,
    connectionId: fields.connectionId,
    userId: fields.userId,
  });

  prisma.trafficLog
    .create({ data: { ...fields, integrityHash } })
    .catch((error: unknown) => {
      if (
        fields.userId !== null &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        writeTrafficLogRow(prisma, { ...fields, userId: null }, context);
        return;
      }
      logger.error(
        `TrafficLog satırı yazılamadı (${context}): ${(error as Error).message}`,
      );
    });
}
