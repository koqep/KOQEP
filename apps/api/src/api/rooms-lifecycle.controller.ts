import { Controller, Post, UseGuards } from '@nestjs/common';
import { RoomsService } from '../services/rooms.service';
import { CronSecretGuard } from './cron-secret.guard';

@Controller('internal/rooms')
@UseGuards(CronSecretGuard)
export class RoomsLifecycleController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('lifecycle-sweep')
  async lifecycleSweep(): Promise<{ archived: number; deleted: number }> {
    const { archivedCount } = await this.roomsService.archiveSilentRooms();
    const { deletedCount } = await this.roomsService.purgeArchivedRooms();
    return { archived: archivedCount, deleted: deletedCount };
  }
}
