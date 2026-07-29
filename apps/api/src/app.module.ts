import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './api/health.controller';
import { AuthController } from './api/auth.controller';
import { TotpController } from './api/totp.controller';
import { PasswordResetController } from './api/password-reset.controller';
import { BlocksController } from './api/blocks.controller';
import { RoomsController } from './api/rooms.controller';
import { MessagesController } from './api/messages.controller';
import { MessagesGateway } from './api/messages.gateway';
import { AuthService } from './services/auth.service';
import { InvitesService } from './services/invites.service';
import { TotpService } from './services/totp.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailService } from './services/email.service';
import { BlocksService } from './services/blocks.service';
import { RoomsService } from './services/rooms.service';
import { MessagesService } from './services/messages.service';
import { PrismaModule } from './db/prisma.module';

const ACCESS_TOKEN_TTL = '15m';

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
    TotpController,
    PasswordResetController,
    BlocksController,
    RoomsController,
    MessagesController,
  ],
  providers: [
    AuthService,
    InvitesService,
    TotpService,
    PasswordResetService,
    EmailService,
    BlocksService,
    RoomsService,
    MessagesService,
    MessagesGateway,
  ],
})
export class AppModule {}
