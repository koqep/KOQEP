import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoomsService, RoomSummary } from '../services/rooms.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  listRooms(): Promise<RoomSummary[]> {
    return this.roomsService.listRooms();
  }
}
