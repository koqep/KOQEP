import { RoomsService } from './rooms.service';
import { PrismaService } from '../db/prisma.service';

describe('RoomsService', () => {
  function buildService(prismaMock: Partial<PrismaService>): RoomsService {
    return new RoomsService(prismaMock as PrismaService);
  }

  it('odalari_isme_gore_alfabetik_dondurur', async () => {
    const findManyMock = jest.fn().mockResolvedValue([
      { id: 'room-general', name: 'general' },
      { id: 'room-meta', name: 'meta' },
    ]);
    const prismaMock: Partial<PrismaService> = {
      room: {
        findMany: findManyMock,
      } as unknown as PrismaService['room'],
    };

    const service = buildService(prismaMock);
    const rooms = await service.listRooms();

    expect(findManyMock).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(rooms).toEqual([
      { id: 'room-general', name: 'general' },
      { id: 'room-meta', name: 'meta' },
    ]);
  });
});
