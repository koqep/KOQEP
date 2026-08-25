import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import {
  writeTrafficLogRow,
  TrafficLogWriteFields,
} from './traffic-log-writer.util';

interface CreatedTrafficLogRow {
  serviceType: string;
  ipAddress: string;
  userId: string | null;
  connectionId: string | null;
  bytesTransferred: number | null;
  integrityHash: string;
}

function lastCreatedRow(createMock: jest.Mock): CreatedTrafficLogRow {
  const call = createMock.mock.calls[createMock.mock.calls.length - 1] as [
    { data: CreatedTrafficLogRow },
  ];
  return call[0].data;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const baseFields: TrafficLogWriteFields = {
  serviceType: 'REST',
  ipAddress: '198.51.100.5',
  startedAt: new Date('2026-08-22T10:00:00.000Z'),
  endedAt: new Date('2026-08-22T10:00:00.050Z'),
  connectionId: null,
  bytesTransferred: 42,
  userId: 'user-1',
};

describe('writeTrafficLogRow', () => {
  let createMock: jest.Mock;
  let prismaMock: PrismaService;

  beforeEach(() => {
    createMock = jest.fn().mockResolvedValue(undefined);
    prismaMock = {
      trafficLog: { create: createMock },
    } as unknown as PrismaService;
  });

  it('dogru_alanlarla_satir_yazar', async () => {
    writeTrafficLogRow(prismaMock, baseFields, 'test-context');
    await flushMicrotasks();

    expect(createMock).toHaveBeenCalledTimes(1);
    const row = lastCreatedRow(createMock);
    expect(row.serviceType).toBe('REST');
    expect(row.ipAddress).toBe('198.51.100.5');
    expect(row.userId).toBe('user-1');
    expect(row.bytesTransferred).toBe(42);
    expect(row.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // /auth/delete-account: kendi transaction'ında User'ı hard-delete eden
  // bir handler'dan sonra bu ateşle-unut yazma çalışırsa, userId artık var
  // olmayan bir kullanıcıyı gösterir - gerçek bir e2e koşumunda bulunan bir
  // regresyon (bkz. M6b milestone Plan notları). WS tarafında (Slice D) da
  // AYNI risk var - handleDisconnect senkron değil.
  it('FK_ihlalinde_userId_null_ile_yeniden_dener', async () => {
    const fkError = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint violated',
      { code: 'P2003', clientVersion: 'test' },
    );
    createMock.mockRejectedValueOnce(fkError).mockResolvedValueOnce(undefined);

    writeTrafficLogRow(
      prismaMock,
      { ...baseFields, userId: 'user-deleted' },
      'test-context',
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(lastCreatedRow(createMock).userId).toBeNull();
  });

  it('userId_zaten_null_iken_FK_ihlalinde_yeniden_denemez', async () => {
    const fkError = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint violated',
      { code: 'P2003', clientVersion: 'test' },
    );
    createMock.mockRejectedValueOnce(fkError);
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    writeTrafficLogRow(
      prismaMock,
      { ...baseFields, userId: null },
      'test-context',
    );
    await flushMicrotasks();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    loggerErrorSpy.mockRestore();
  });

  it('yazma_basarisiz_olursa_hatayi_loglar_firlatmaz', async () => {
    createMock.mockRejectedValueOnce(new Error('DB gecici hatasi'));
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      writeTrafficLogRow(prismaMock, baseFields, 'test-context'),
    ).not.toThrow();
    await flushMicrotasks();

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    const [firstArg] = loggerErrorSpy.mock.calls[0] as [string];
    expect(firstArg).toContain('DB gecici hatasi');
    expect(firstArg).toContain('test-context');
    loggerErrorSpy.mockRestore();
  });
});
