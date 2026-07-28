import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './api/health.controller';
import { AuthController } from './api/auth.controller';
import { RoomsController } from './api/rooms.controller';
import { MessagesController } from './api/messages.controller';
import { MessagesGateway } from './api/messages.gateway';
import { AuthService } from './services/auth.service';
import { RoomsService } from './services/rooms.service';
import { MessagesService } from './services/messages.service';
import { PrismaModule } from './db/prisma.module';

const ACCESS_TOKEN_TTL = '24h';

// M0'ın seed'lenmiş dev-login'i kimlik doğrulaması istemiyor (M1'e kadar
// bilinçli bir kapsam kararı). Staging/public bir URL'de bunu herkese açık
// bırakmamak için route'un kendisi ENABLE_DEV_LOGIN=true değilse hiç
// kaydolmuyor (404 döner, 401 değil - route'un var olduğunu bile
// doğrulamaz). M1'de gerçek auth gelince bu satır ve AuthController
// tamamen kaldırılacak (bkz. docs/milestones/M1-auth-invites.md).
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
    ...(isDevLoginEnabled ? [AuthController] : []),
    RoomsController,
    MessagesController,
  ],
  providers: [AuthService, RoomsService, MessagesService, MessagesGateway],
})
export class AppModule {}
