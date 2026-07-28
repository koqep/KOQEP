import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller';
import { PrismaModule } from './db/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
