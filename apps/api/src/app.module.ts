import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './api/health.controller';
import { AuthController } from './api/auth.controller';
import { DevAuthController } from './api/dev-auth.controller';
import { TotpController } from './api/totp.controller';
import { RoomsController } from './api/rooms.controller';
import { MessagesController } from './api/messages.controller';
import { MessagesGateway } from './api/messages.gateway';
import { AuthService } from './services/auth.service';
import { InvitesService } from './services/invites.service';
import { TotpService } from './services/totp.service';
import { RoomsService } from './services/rooms.service';
import { MessagesService } from './services/messages.service';
import { PrismaModule } from './db/prisma.module';

const ACCESS_TOKEN_TTL = '15m';

// M0'ın seed'lenmiş dev-login'i kimlik doğrulaması istemiyor. Gerçek
// /auth/signup ve /auth/login (AuthController) her zaman açık; dev-login
// (DevAuthController) sadece ENABLE_DEV_LOGIN=true iken kaydolur (404
// döner, 401 değil - route'un var olduğunu bile doğrulamaz). Frontend
// gerçek signup/login'e geçince DevAuthController tamamen silinecek
// (bkz. docs/milestones/M1-auth-invites.md).
const isDevLoginEnabled = process.env.ENABLE_DEV_LOGIN === 'true';

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
    PrismaModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    ...(isDevLoginEnabled ? [DevAuthController] : []),
    TotpController,
    RoomsController,
    MessagesController,
  ],
  providers: [
    AuthService,
    InvitesService,
    TotpService,
    RoomsService,
    MessagesService,
    MessagesGateway,
  ],
})
export class AppModule {}
