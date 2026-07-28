import { Module } from '@nestjs/common';
import { HealthController } from './api/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
