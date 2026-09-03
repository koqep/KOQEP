import { ExecutionContext, HttpException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RoomJoinThrottlerGuard } from './room-join-throttler.guard';

// M9 Slice C: report-throttler.guard.ts/room-creation-throttler.guard.ts'in
// e2e testleri ZATEN aynı HttpException({code:'RATE_LIMITED',...}, 429)
// şeklini kanıtlıyor (üçü de BİREBİR yapısal kopya) - bu dosya SADECE
// room-join-throttler.guard.ts'in kendi hiç test edilmemiş dalını,
// storage'ı mock'layarak izole doğruluyor.
describe('RoomJoinThrottlerGuard', () => {
  function buildContext(userId: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: userId } }),
      }),
      getClass: () => ({ name: 'RoomsController' }),
      getHandler: () => ({ name: 'join' }),
    } as unknown as ExecutionContext;
  }

  it('limit_asilinca_rate_limited_code_ile_429_atar', async () => {
    const storageMock: Partial<ThrottlerStorage> = {
      increment: jest.fn().mockResolvedValue({
        totalHits: 11,
        timeToExpire: 3600,
        isBlocked: true,
        timeToBlockExpire: 3600,
      }),
    };
    const guard = new RoomJoinThrottlerGuard(storageMock as ThrottlerStorage);

    await expect(guard.canActivate(buildContext('user-1'))).rejects.toThrow(
      HttpException,
    );
    await expect(
      guard.canActivate(buildContext('user-1')),
    ).rejects.toMatchObject({
      response: { code: 'RATE_LIMITED' },
      status: 429,
    });
  });

  it('limit_altindayken_izin_verir', async () => {
    const storageMock: Partial<ThrottlerStorage> = {
      increment: jest.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 3600,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const guard = new RoomJoinThrottlerGuard(storageMock as ThrottlerStorage);

    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });
});
