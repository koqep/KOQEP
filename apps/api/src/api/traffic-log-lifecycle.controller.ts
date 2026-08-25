import { Controller, Post, UseGuards } from '@nestjs/common';
import { TrafficLogService } from '../services/traffic-log.service';
import { CronSecretGuard } from './cron-secret.guard';

@Controller('internal/traffic-logs')
@UseGuards(CronSecretGuard)
export class TrafficLogLifecycleController {
  constructor(private readonly trafficLogService: TrafficLogService) {}

  @Post('purge')
  async purge(): Promise<{ deleted: number }> {
    const { deletedCount } = await this.trafficLogService.purgeOldRows();
    return { deleted: deletedCount };
  }
}
