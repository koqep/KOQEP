import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
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
import { TrafficLogLifecycleController } from './api/traffic-log-lifecycle.controller';
import { MessagesController } from './api/messages.controller';
import { MessagesGateway } from './api/messages.gateway';
import { ModerationController } from './api/moderation.controller';
import { InvitesController } from './api/invites.controller';
import { MeController } from './api/me.controller';
import { AuthService } from './services/auth.service';
import { InvitesService } from './services/invites.service';
import { MeService } from './services/me.service';
import { TotpService } from './services/totp.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { EmailService } from './services/email.service';
import { BlocksService } from './services/blocks.service';
import { UsersService } from './services/users.service';
import { RoomsService } from './services/rooms.service';
import { MessagesService } from './services/messages.service';
import { ReputationService } from './services/reputation.service';
import { ReportsService } from './services/reports.service';
import { MutesService } from './services/mutes.service';
import { RoomModerationService } from './services/room-moderation.service';
import { ModeratorRoleService } from './services/moderator-role.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { SocketRegistryService } from './services/socket-registry.service';
import { getRealClientIp } from './services/client-ip.util';
import { TrafficLogMiddleware } from './api/traffic-log.middleware';
import { TrafficLogService } from './services/traffic-log.service';
import { PrismaModule } from './db/prisma.module';

const ACCESS_TOKEN_TTL = '15m';
// Genel varsayılan hız sınırı (IP başına) - hiçbir @Throttle() override'ı
// olmayan her REST route'a otomatik uygulanır. Belirli route'lar (signup)
// kendi @Throttle() dekoratörüyle daha sıkı bir limit alıyor
// (auth.controller.ts). Ayrıca WS mesaj gönderimi (ws-throttler.guard.ts),
// oda oluşturma (room-creation-throttler.guard.ts) ve rapor gönderimi
// (report-throttler.guard.ts) bu global limitten BAĞIMSIZ kendi
// guard'larına sahip - "davet üretme" eskiden burada listeliydi ama M4
// Slice B'de manuel davet endpoint'i tamamen kaldırıldı, bu limit artık
// yok (M6 Slice B'de bulunup düzeltildi, bkz. docs/STATE.md). M2 Slice C.
const DEFAULT_RATE_LIMIT_TTL_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 100;

@Module({
  imports: [
    SentryModule.forRoot(),
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
        // M6b Slice A: trust proxy hiç ayarlı değildi - varsayılan req.ip
        // Render'ın kendi LB'sinin (tek) IP'sini görüyordu, yani bu global
        // limit fiilen TÜM istemciler için PAYLAŞILAN tek bir havuz gibi
        // davranıyor olabilirdi. getRealClientIp Render'ın X-Forwarded-For
        // deseninden gerçek istemci IP'sini okuyor (client-ip.util.ts).
        getTracker: (req: {
          headers?: Record<string, string | string[] | undefined>;
          socket?: { remoteAddress?: string };
        }) =>
          getRealClientIp(
            req.headers?.['x-forwarded-for'],
            req.headers?.['cf-connecting-ip'],
            req.socket?.remoteAddress,
          ),
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
    TrafficLogLifecycleController,
    MessagesController,
    ModerationController,
    InvitesController,
    MeController,
  ],
  providers: [
    AuthService,
    InvitesService,
    MeService,
    TotpService,
    PasswordResetService,
    EmailVerificationService,
    EmailService,
    BlocksService,
    UsersService,
    RoomsService,
    TrafficLogService,
    MessagesService,
    ReputationService,
    ReportsService,
    MutesService,
    RoomModerationService,
    ModeratorRoleService,
    PasswordPolicyService,
    SocketRegistryService,
    MessagesGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // M6 Slice B: HttpException'lar (bu kod tabanındaki neredeyse tüm domain
    // hataları - "Mesaj bulunamadı" vb.) beklenen kontrol akışı sayılıp
    // Sentry'ye GİTMİYOR, sadece gerçekten beklenmeyen istisnalar gidiyor -
    // bilinçli davranış, SentryGlobalFilter'ın kendi kaynağında doğrulandı.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
  ],
})
export class AppModule implements NestModule {
  // M6b Slice C: Guard'lardan ÖNCE çalışır - 401/429 gibi Guard'ların
  // reddettiği istekler de TrafficLog'a düşer (bkz. traffic-log.middleware.ts).
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TrafficLogMiddleware).forRoutes('*');
  }
}
