import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './api/health.controller';
import { AuthController } from './api/auth.controller';
import { TotpController } from './api/totp.controller';
import { PasswordResetController } from './api/password-reset.controller';
import { BlocksController } from './api/blocks.controller';
import { RoomsController } from './api/rooms.controller';
import { RoomsLifecycleController } from './api/rooms-lifecycle.controller';
import { MessagesController } from './api/messages.controller';
import { MessagesGateway } from './api/messages.gateway';
import { InvitesController } from './api/invites.controller';
import { AuthService } from './services/auth.service';
import { InvitesService } from './services/invites.service';
import { TotpService } from './services/totp.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { EmailService } from './services/email.service';
import { BlocksService } from './services/blocks.service';
import { UsersService } from './services/users.service';
import { RoomsService } from './services/rooms.service';
import { MessagesService } from './services/messages.service';
import { ReputationService } from './services/reputation.service';
import { SocketRegistryService } from './services/socket-registry.service';
import { PrismaModule } from './db/prisma.module';

const ACCESS_TOKEN_TTL = '15m';
// Genel varsayılan hız sınırı (IP başına) - hiçbir @Throttle() override'ı
// olmayan her REST route'a otomatik uygulanır. Belirli route'lar (davet
// üretme, signup) kendi @Throttle() dekoratörleriyle daha sıkı bir limit
// alıyor (bkz. invites.controller.ts, auth.controller.ts). M2 Slice C.
const DEFAULT_RATE_LIMIT_TTL_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 100;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: DEFAULT_RATE_LIMIT_TTL_MS,
        limit: DEFAULT_RATE_LIMIT,
      },
    ]),
    PrismaModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    TotpController,
    PasswordResetController,
    BlocksController,
    RoomsController,
    RoomsLifecycleController,
    MessagesController,
    InvitesController,
  ],
  providers: [
    AuthService,
    InvitesService,
    TotpService,
    PasswordResetService,
    EmailVerificationService,
    EmailService,
    BlocksService,
    UsersService,
    RoomsService,
    MessagesService,
    ReputationService,
    SocketRegistryService,
    MessagesGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
