import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './api/health.controller';
import { AuthController } from './api/auth.controller';
import { AuthService } from './services/auth.service';
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
  controllers: [HealthController, AuthController],
  providers: [AuthService],
})
export class AppModule {}
