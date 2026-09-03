import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../db/prisma.service';
import { SocketRegistryService } from './socket-registry.service';

describe('RoomsService', () => {
  function buildService(
    prismaMock: Partial<PrismaService>,
    socketRegistryMock: Partial<SocketRegistryService> = {
      getSockets: () => [],
    },
  ): RoomsService {
    return new RoomsService(
      prismaMock as PrismaService,
      socketRegistryMock as SocketRegistryService,
    );
  }

  describe('listRooms (benim odalarım)', () => {
    it('odalari_isme_gore_alfabetik_dondurur_varsayilan_aktif_ve_uyelik_filtreyle', async () => {
      const findManyMock = jest.fn().mockResolvedValue([
        {
          id: 'room-general',
          name: 'general',
          description: null,
          lastActivityAt: new Date('2026-01-01'),
          status: 'active',
          passwordHash: null,
        },
        {
          id: 'room-meta',
          name: 'meta',
          description: 'meta konusu',
          lastActivityAt: new Date('2026-01-02'),
          status: 'active',
          passwordHash: null,
        },
      ]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findMany: findManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const rooms = await service.listRooms('user-1');

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: 'active', members: { some: { userId: 'user-1' } } },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
          status: true,
          announcement: true,
          passwordHash: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(rooms).toHaveLength(2);
      expect(rooms[0]).not.toHaveProperty('passwordHash');
      expect(rooms[0].hasPassword).toBe(false);
    });

    it('includeArchived_true_iken_arsivlenmisleri_de_dahil_eder', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findMany: findManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      await service.listRooms('user-1', true);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['active', 'archived'] },
            members: { some: { userId: 'user-1' } },
          },
        }),
      );
    });
  });

  describe('listAllRooms (moderasyon - uyelikten bagimsiz)', () => {
    it('uyelik_filtresi_olmadan_tum_odalari_dondurur', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: { findMany: findManyMock } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      await service.listAllRooms(true);

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: { in: ['active', 'archived'] } },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
          status: true,
          announcement: true,
          passwordHash: true,
        },
        orderBy: [{ lastActivityAt: 'desc' }, { name: 'asc' }],
      });
    });
  });

  describe('listDiscoverableRooms', () => {
    it('uye_olunmayan_aktif_odalari_dondurur_includeArchivedi_yok_sayar', async () => {
      const findManyMock = jest.fn().mockResolvedValue([
        {
          id: 'room-1',
          name: 'elden-ring',
          description: null,
          lastActivityAt: new Date('2026-01-01'),
          status: 'active',
          passwordHash: null,
        },
      ]);
      const prismaMock: Partial<PrismaService> = {
        room: { findMany: findManyMock } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const page = await service.listDiscoverableRooms('user-1');

      expect(findManyMock).toHaveBeenCalledWith({
        where: { status: 'active', members: { none: { userId: 'user-1' } } },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
          status: true,
          announcement: true,
          passwordHash: true,
        },
        orderBy: [{ lastActivityAt: 'desc' }, { name: 'asc' }],
        take: 31,
      });
      expect(page).toEqual({
        rooms: [
          expect.objectContaining({
            name: 'elden-ring',
            hasPassword: false,
          }) as unknown,
        ],
        nextCursor: null,
      });
    });

    it('limitten_fazla_satir_donerse_nextCursor_dolu_gelir_fazla_satir_kesilir', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({
        id: `room-${i}`,
        name: `oda-${i}`,
        description: null,
        lastActivityAt: new Date('2026-01-01'),
        status: 'active' as const,
        passwordHash: null,
      }));
      const findManyMock = jest.fn().mockResolvedValue(rows);
      const prismaMock: Partial<PrismaService> = {
        room: { findMany: findManyMock } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const page = await service.listDiscoverableRooms('user-1', undefined, 2);

      expect(page.rooms).toHaveLength(2);
      expect(page.nextCursor).toBe('oda-1');
    });

    it('cursor_verilince_name_alaninda_prisma_cursor_kullanir', async () => {
      const findManyMock = jest.fn().mockResolvedValue([]);
      const prismaMock: Partial<PrismaService> = {
        room: { findMany: findManyMock } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      await service.listDiscoverableRooms('user-1', 'oda-1', 10);

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { name: 'oda-1' },
          skip: 1,
          take: 11,
        }),
      );
    });
  });

  describe('joinRoom', () => {
    it('idempotent_uyelik_yaratir_ve_acik_soketleri_odaya_katar', async () => {
      const room = {
        id: 'room-1',
        name: 'elden-ring',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash: null,
      };
      const findUniqueOrThrowMock = jest.fn().mockResolvedValue(room);
      const upsertMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: findUniqueOrThrowMock,
        } as unknown as PrismaService['room'],
        roomMember: {
          upsert: upsertMock,
        } as unknown as PrismaService['roomMember'],
      };
      const joinMock = jest.fn();
      const socketRegistryMock: Partial<SocketRegistryService> = {
        getSockets: () => [{ join: joinMock } as never],
      };

      const service = buildService(prismaMock, socketRegistryMock);
      const result = await service.joinRoom('user-1', 'room-1');

      expect(upsertMock).toHaveBeenCalledWith({
        where: { userId_roomId: { userId: 'user-1', roomId: 'room-1' } },
        create: { userId: 'user-1', roomId: 'room-1' },
        update: {},
      });
      expect(joinMock).toHaveBeenCalledWith('room-1');
      expect(result).toEqual({
        ...room,
        passwordHash: undefined,
        hasPassword: false,
      });
    });

    // M11c Slice A: kod tabanına eklenen İLK gerçek erişim-gating.
    it('sifreli_odaya_dogru_sifreyle_katilir', async () => {
      const passwordHash = await argon2.hash('dogru-sifre');
      const room = {
        id: 'room-1',
        name: 'gizli-oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash,
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        roomMember: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['roomMember'],
      };

      const service = buildService(prismaMock);
      const result = await service.joinRoom('user-1', 'room-1', 'dogru-sifre');

      expect(result.hasPassword).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('sifreli_odaya_yanlis_sifreyle_katilma_denemesini_reddeder', async () => {
      const passwordHash = await argon2.hash('dogru-sifre');
      const room = {
        id: 'room-1',
        name: 'gizli-oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash,
      };
      const upsertMock = jest.fn();
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        roomMember: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: upsertMock,
        } as unknown as PrismaService['roomMember'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.joinRoom('user-1', 'room-1', 'yanlis-sifre'),
      ).rejects.toMatchObject({
        response: { code: 'ROOM_PASSWORD_INCORRECT' },
      });
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it('sifreli_odaya_sifre_verilmeden_katilma_denemesini_reddeder', async () => {
      const passwordHash = await argon2.hash('dogru-sifre');
      const room = {
        id: 'room-1',
        name: 'gizli-oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash,
      };
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        roomMember: {
          findUnique: jest.fn().mockResolvedValue(null),
        } as unknown as PrismaService['roomMember'],
      };

      const service = buildService(prismaMock);

      await expect(service.joinRoom('user-1', 'room-1')).rejects.toMatchObject({
        response: { code: 'ROOM_PASSWORD_INCORRECT' },
      });
    });

    it('zaten_uye_olan_sifreli_odaya_sifre_istemeden_tekrar_katilir', async () => {
      const passwordHash = await argon2.hash('dogru-sifre');
      const room = {
        id: 'room-1',
        name: 'gizli-oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash,
      };
      const upsertMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(room),
        } as unknown as PrismaService['room'],
        roomMember: {
          // Zaten üye - upsert'in KENDİSİ bunu tekrar sorgulayacak olsa da
          // findUnique burada "önceki üyelik kontrolü" için ayrıca çağrılıyor.
          findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }),
          upsert: upsertMock,
        } as unknown as PrismaService['roomMember'],
      };

      const service = buildService(prismaMock);
      const result = await service.joinRoom('user-1', 'room-1');

      expect(result.hasPassword).toBe(true);
      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('cekirdek_olmayan_odada_uyeligi_kaldirir_ve_acik_soketleri_odadan_cikarir', async () => {
      const findUniqueOrThrowMock = jest
        .fn()
        .mockResolvedValue({ name: 'elden-ring' });
      const deleteManyMock = jest.fn().mockResolvedValue({ count: 1 });
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: findUniqueOrThrowMock,
        } as unknown as PrismaService['room'],
        roomMember: {
          deleteMany: deleteManyMock,
        } as unknown as PrismaService['roomMember'],
      };
      const leaveMock = jest.fn();
      const socketRegistryMock: Partial<SocketRegistryService> = {
        getSockets: () => [{ leave: leaveMock } as never],
      };

      const service = buildService(prismaMock, socketRegistryMock);
      await service.leaveRoom('user-1', 'room-1');

      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', roomId: 'room-1' },
      });
      expect(leaveMock).toHaveBeenCalledWith('room-1');
    });

    it('cekirdek_odadan_ayrilma_denemesini_reddeder', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'general' }),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.leaveRoom('user-1', 'room-general'),
      ).rejects.toMatchObject({
        response: { code: 'CORE_ROOM_LEAVE_FORBIDDEN' },
      });
    });
  });

  describe('createRoom', () => {
    it('oda_olusturur_ve_olusturanin_soketlerini_katar', async () => {
      const room = {
        id: 'room-1',
        name: 'elden-ring',
        description: 'Elden Ring tartışması',
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash: null,
      };
      const findFirstMock = jest.fn().mockResolvedValue(null);
      const createMock = jest.fn().mockResolvedValue(room);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: findFirstMock,
          create: createMock,
        } as unknown as PrismaService['room'],
      };
      const joinMock = jest.fn();
      const socketRegistryMock: Partial<SocketRegistryService> = {
        getSockets: () => [{ join: joinMock } as never],
      };

      const service = buildService(prismaMock, socketRegistryMock);
      const result = await service.createRoom(
        'user-1',
        'elden-ring',
        'Elden Ring tartışması',
      );

      expect(findFirstMock).toHaveBeenCalledWith({
        where: { name: { equals: 'elden-ring', mode: 'insensitive' } },
      });
      expect(createMock).toHaveBeenCalledWith({
        data: {
          name: 'elden-ring',
          description: 'Elden Ring tartışması',
          passwordHash: undefined,
          creatorId: 'user-1',
          members: { create: { userId: 'user-1' } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
          status: true,
          announcement: true,
          passwordHash: true,
        },
      });
      expect(joinMock).toHaveBeenCalledWith('room-1');
      expect(result).toEqual({
        ...room,
        passwordHash: undefined,
        hasPassword: false,
      });
    });

    // M11c Slice A: verilen şifre auth.service.ts'in AYNI argon2.hash
    // deseniyle hash'lenip Room.passwordHash'e yazılıyor.
    it('sifre_verilince_hashlenip_saklanir', async () => {
      const room = {
        id: 'room-1',
        name: 'gizli-oda',
        description: null,
        lastActivityAt: new Date(),
        status: 'active',
        passwordHash: 'irrelevant-mocked-return',
      };
      const createMock = jest.fn().mockResolvedValue(room);
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: createMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const result = await service.createRoom(
        'user-1',
        'gizli-oda',
        undefined,
        'oda-sifresi',
      );

      const call = createMock.mock.calls[0] as [
        { data: { passwordHash?: string } },
      ];
      const passwordHash = call[0].data.passwordHash;
      expect(passwordHash).toBeDefined();
      expect(passwordHash).not.toBe('oda-sifresi');
      await expect(argon2.verify(passwordHash!, 'oda-sifresi')).resolves.toBe(
        true,
      );
      expect(result.hasPassword).toBe(true);
    });

    it('reddeder_buyuk_kucuk_harf_farkli_ama_ayni_ismi_on_kontrolde', async () => {
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing-room' }),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.createRoom('user-1', 'General'),
      ).rejects.toMatchObject({ response: { code: 'ROOM_NAME_TAKEN' } });
    });

    it('reddeder_yarisi_kaybedilen_ismi_p2002_backstopuyla', async () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['name'] } },
      );
      const prismaMock: Partial<PrismaService> = {
        room: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockRejectedValue(uniqueError),
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);

      await expect(
        service.createRoom('user-1', 'general'),
      ).rejects.toMatchObject({ response: { code: 'ROOM_NAME_TAKEN' } });
    });
  });

  describe('archiveSilentRooms', () => {
    it('14_gunden_eski_odalari_cekirdek_disinda_arsivler', async () => {
      const now = new Date('2026-08-15T00:00:00.000Z');
      const updateManyMock = jest.fn().mockResolvedValue({ count: 3 });
      const prismaMock: Partial<PrismaService> = {
        room: {
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const result = await service.archiveSilentRooms(now);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          status: 'active',
          lastActivityAt: { lt: new Date('2026-08-01T00:00:00.000Z') },
          name: { notIn: ['general', 'meta'] },
        },
        data: { status: 'archived', archivedAt: now },
      });
      expect(result).toEqual({ archivedCount: 3 });
    });

    it('now_verilmezse_gercek_saati_kullanir', async () => {
      let capturedArchivedAt: Date | undefined;
      const updateManyMock = jest
        .fn()
        .mockImplementation((args: { data: { archivedAt: Date } }) => {
          capturedArchivedAt = args.data.archivedAt;
          return Promise.resolve({ count: 0 });
        });
      const prismaMock: Partial<PrismaService> = {
        room: {
          updateMany: updateManyMock,
        } as unknown as PrismaService['room'],
      };

      const service = buildService(prismaMock);
      const before = Date.now();
      await service.archiveSilentRooms();
      const after = Date.now();

      expect(capturedArchivedAt).toBeDefined();
      const usedNow = capturedArchivedAt!.getTime();
      expect(usedNow).toBeGreaterThanOrEqual(before);
      expect(usedNow).toBeLessThanOrEqual(after);
    });
  });

  describe('purgeArchivedRooms', () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    const cutoff = new Date('2026-06-16T00:00:00.000Z'); // now - 60 gün
    const oldArchivedAt = new Date('2026-06-01T00:00:00.000Z');

    function buildPurgeMock(
      candidates: {
        id: string;
        archivedAt: Date | null;
        lastViewedAt: Date | null;
      }[],
      recheckResult: {
        id: string;
        archivedAt: Date | null;
        lastViewedAt: Date | null;
      }[],
    ): {
      prismaMock: Partial<PrismaService>;
      outerFindManyMock: jest.Mock;
      recheckFindManyMock: jest.Mock;
      messageEditDeleteManyMock: jest.Mock;
      messageDeleteManyMock: jest.Mock;
      roomDeleteManyMock: jest.Mock;
      transactionMock: jest.Mock;
    } {
      const outerFindManyMock = jest.fn().mockResolvedValue(candidates);
      const recheckFindManyMock = jest.fn().mockResolvedValue(recheckResult);
      const messageEditDeleteManyMock = jest
        .fn()
        .mockResolvedValue({ count: 0 });
      const messageDeleteManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const roomDeleteManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const txMock = {
        room: { findMany: recheckFindManyMock, deleteMany: roomDeleteManyMock },
        message: { deleteMany: messageDeleteManyMock },
        messageEdit: { deleteMany: messageEditDeleteManyMock },
      };
      const transactionMock = jest
        .fn()
        .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock));
      const prismaMock: Partial<PrismaService> = {
        room: {
          findMany: outerFindManyMock,
        } as unknown as PrismaService['room'],
        $transaction: transactionMock,
      };
      return {
        prismaMock,
        outerFindManyMock,
        recheckFindManyMock,
        messageEditDeleteManyMock,
        messageDeleteManyMock,
        roomDeleteManyMock,
        transactionMock,
      };
    }

    it('hic_goruntulenmemis_arsivlenmis_odayi_siler', async () => {
      const candidate = {
        id: 'room-1',
        archivedAt: oldArchivedAt,
        lastViewedAt: null,
      };
      const {
        prismaMock,
        outerFindManyMock,
        messageEditDeleteManyMock,
        messageDeleteManyMock,
        roomDeleteManyMock,
      } = buildPurgeMock([candidate], [candidate]);

      const service = buildService(prismaMock);
      const result = await service.purgeArchivedRooms(now);

      expect(outerFindManyMock).toHaveBeenCalledWith({
        where: { status: 'archived', archivedAt: { lt: cutoff } },
        select: { id: true, archivedAt: true, lastViewedAt: true },
      });
      expect(messageEditDeleteManyMock).toHaveBeenCalledWith({
        where: { message: { roomId: { in: ['room-1'] } } },
      });
      expect(messageDeleteManyMock).toHaveBeenCalledWith({
        where: { roomId: { in: ['room-1'] } },
      });
      expect(roomDeleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['room-1'] } },
      });
      expect(result).toEqual({ deletedCount: 1 });
    });

    it('arsivden_once_goruntulenmis_ama_sonra_hic_goruntulenmemis_odayi_siler', async () => {
      const candidate = {
        id: 'room-1',
        archivedAt: oldArchivedAt,
        lastViewedAt: new Date('2026-05-01T00:00:00.000Z'), // archivedAt'ten önce
      };
      const { prismaMock, roomDeleteManyMock } = buildPurgeMock(
        [candidate],
        [candidate],
      );

      const service = buildService(prismaMock);
      const result = await service.purgeArchivedRooms(now);

      expect(roomDeleteManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['room-1'] } },
      });
      expect(result).toEqual({ deletedCount: 1 });
    });

    it('arsivden_sonra_goruntulenmis_odayi_hic_transactiona_girmeden_atlar', async () => {
      const candidate = {
        id: 'room-1',
        archivedAt: oldArchivedAt,
        lastViewedAt: new Date('2026-07-01T00:00:00.000Z'), // archivedAt'ten sonra
      };
      const { prismaMock, transactionMock, outerFindManyMock } = buildPurgeMock(
        [candidate],
        [candidate],
      );

      const service = buildService(prismaMock);
      const result = await service.purgeArchivedRooms(now);

      expect(outerFindManyMock).toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });

    it('aday_yoksa_transactiona_hic_girmez', async () => {
      const { prismaMock, transactionMock } = buildPurgeMock([], []);

      const service = buildService(prismaMock);
      const result = await service.purgeArchivedRooms(now);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });

    it('toctou_disi_sorguda_uygun_gorunen_ama_transaction_icindeki_recheckte_artik_uygun_olmayan_odayi_silmez', async () => {
      // Aday-seçme sorgusu sırasında hiç görüntülenmemiş görünüyordu, ama
      // transaction içindeki recheck'te (aradan biri odayı görüntülemiş
      // gibi simüle ediliyor) artık arşivden SONRA görüntülenmiş -
      // silinMEmeli.
      const staleOuterView = {
        id: 'room-1',
        archivedAt: oldArchivedAt,
        lastViewedAt: null,
      };
      const freshRecheckView = {
        id: 'room-1',
        archivedAt: oldArchivedAt,
        lastViewedAt: new Date('2026-08-14T00:00:00.000Z'), // recheck anında görüntülenmiş
      };
      const {
        prismaMock,
        messageEditDeleteManyMock,
        messageDeleteManyMock,
        roomDeleteManyMock,
      } = buildPurgeMock([staleOuterView], [freshRecheckView]);

      const service = buildService(prismaMock);
      const result = await service.purgeArchivedRooms(now);

      expect(messageEditDeleteManyMock).not.toHaveBeenCalled();
      expect(messageDeleteManyMock).not.toHaveBeenCalled();
      expect(roomDeleteManyMock).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedCount: 0 });
    });
  });
});
