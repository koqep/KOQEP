import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AppModule as AppModuleType } from './../src/app.module';
import { DEV_USER_EMAIL } from './../src/db/dev-seed.constants';

// jest.isolateModules + require: ENABLE_DEV_LOGIN'e gore AppModule'un
// controllers dizisi module-load aninda sabitleniyor, bu yuzden her
// senaryo icin modulu env degeri degistikten sonra taze yuklemek gerekiyor.
function loadFreshAppModule(): typeof AppModuleType {
  let loaded: typeof AppModuleType | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./../src/app.module') as {
      AppModule: typeof AppModuleType;
    };
    loaded = mod.AppModule;
  });
  if (!loaded) {
    throw new Error('AppModule yüklenemedi.');
  }
  return loaded;
}

describe('Dev-login env gate (e2e)', () => {
  const originalValue = process.env.ENABLE_DEV_LOGIN;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL, passwordHash: 'test-not-a-real-hash' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.ENABLE_DEV_LOGIN;
    } else {
      process.env.ENABLE_DEV_LOGIN = originalValue;
    }
  });

  it('ENABLE_DEV_LOGIN_false_iken_route_kayitli_degil_404_doner', async () => {
    process.env.ENABLE_DEV_LOGIN = 'false';
    const AppModule = loadFreshAppModule();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: INestApplication<App> = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).post('/auth/dev-login').expect(404);

    await app.close();
  });

  it('ENABLE_DEV_LOGIN_true_iken_route_kayitli_ve_calisiyor', async () => {
    process.env.ENABLE_DEV_LOGIN = 'true';
    const AppModule = loadFreshAppModule();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: INestApplication<App> = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).post('/auth/dev-login').expect(201);

    await app.close();
  });
});
