import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { PrismaService } from '../db/prisma.service';
import { TrafficLogMiddleware } from './traffic-log.middleware';

interface CreatedTrafficLogRow {
  serviceType: string;
  ipAddress: string;
  userId: string | null;
  connectionId: string | null;
  bytesTransferred: number | null;
  integrityHash: string;
  startedAt: Date;
  endedAt: Date;
}

function lastCreatedRow(createMock: jest.Mock): CreatedTrafficLogRow {
  const call = createMock.mock.calls[createMock.mock.calls.length - 1] as [
    { data: CreatedTrafficLogRow },
  ];
  return call[0].data;
}

function buildFakeResponse(contentLength?: string): Response {
  const emitter = new EventEmitter() as unknown as Response;
  (emitter as unknown as { getHeader: jest.Mock }).getHeader = jest
    .fn()
    .mockReturnValue(contentLength);
  return emitter;
}

function buildFakeRequest(
  overrides: Partial<Request> & { user?: { sub: string; email: string } } = {},
): Request {
  return {
    path: '/rooms',
    originalUrl: '/rooms',
    headers: {},
    socket: { remoteAddress: '198.51.100.5' },
    ...overrides,
  } as unknown as Request;
}

describe('TrafficLogMiddleware', () => {
  let createMock: jest.Mock;
  let middleware: TrafficLogMiddleware;

  beforeEach(() => {
    createMock = jest.fn().mockResolvedValue(undefined);
    const prismaMock = { trafficLog: { create: createMock } };
    middleware = new TrafficLogMiddleware(
      prismaMock as unknown as PrismaService,
    );
  });

  it('yanit_tamamlaninca_trafficLog_satiri_yazar', async () => {
    const req = buildFakeRequest({
      path: '/rooms',
      user: { sub: 'user-1', email: 'a@example.com' },
    });
    const res = buildFakeResponse('42');
    const next = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    await flushMicrotasks();

    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = lastCreatedRow(createMock);
    expect(payload.serviceType).toBe('REST');
    expect(payload.ipAddress).toBe('198.51.100.5');
    expect(payload.userId).toBe('user-1');
    expect(payload.connectionId).toBeNull();
    expect(payload.bytesTransferred).toBe(42);
    expect(payload.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.startedAt).toBeInstanceOf(Date);
    expect(payload.endedAt).toBeInstanceOf(Date);
  });

  it('health_isteginde_satir_yazilmaz', () => {
    const req = buildFakeRequest({ path: '/', originalUrl: '/health' });
    const res = buildFakeResponse();
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('kimliksiz_istekte_userId_null_kalir', async () => {
    const req = buildFakeRequest({ path: '/auth/login' });
    const res = buildFakeResponse();

    middleware.use(req, res, jest.fn());
    res.emit('finish');
    await flushMicrotasks();

    expect(lastCreatedRow(createMock).userId).toBeNull();
  });

  // Yazma+P2003-retry+hata-loglama davranışı Slice D'de
  // traffic-log-writer.util.ts'e çıkarıldı - o davranışın testleri
  // traffic-log-writer.util.spec.ts'te (writeTrafficLogRow'u doğrudan
  // çağırarak). Burada sadece middleware'in DOĞRU alanlarla çağırdığı
  // test ediliyor.
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
