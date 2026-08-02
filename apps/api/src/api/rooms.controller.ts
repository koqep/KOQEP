import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoomsService, RoomSummary } from '../services/rooms.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomCreationThrottlerGuard } from './room-creation-throttler.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  listRooms(
    @Query('includeArchived') includeArchived?: string,
  ): Promise<RoomSummary[]> {
    return this.roomsService.listRooms(includeArchived === 'true');
  }

  @Post()
  @UseGuards(RoomCreationThrottlerGuard)
  createRoom(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomSummary> {
    return this.roomsService.createRoom(
      req.user.sub,
      dto.name,
      dto.description,
    );
  }
}
