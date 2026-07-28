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
    RoomsController,
    MessagesController,
  ],
  providers: [AuthService, RoomsService, MessagesService, MessagesGateway],
})
export class AppModule {}
