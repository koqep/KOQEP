import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoomPage, RoomsService, RoomSummary } from '../services/rooms.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomCreationThrottlerGuard } from './room-creation-throttler.guard';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // M7a Slice B: scope=mine (varsayılan/eksik/geçersiz) - normal switcher.
  // scope=discoverable - sayfalı, üye olunmayan aktif odalar. scope=all -
  // bugünkü davranış (moderasyon paneli için, üyelikten bağımsız TÜM
  // odalar) - basit string kontrolü, includeArchived'ın bugünkü deseniyle
  // aynı, DTO gerekmiyor.
  @Get()
  listRooms(
    @Req() req: AuthenticatedRequest,
    @Query('scope') scope?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<RoomSummary[] | RoomPage> {
    if (scope === 'discoverable') {
      const parsedLimit = limit ? Number(limit) : undefined;
      return this.roomsService.listDiscoverableRooms(
        req.user.sub,
        cursor,
        Number.isFinite(parsedLimit) && parsedLimit ? parsedLimit : undefined,
      );
    }
    if (scope === 'all') {
      return this.roomsService.listAllRooms(includeArchived === 'true');
    }
    return this.roomsService.listRooms(
      req.user.sub,
      includeArchived === 'true',
    );
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

  @Post(':id/join')
  joinRoom(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<RoomSummary> {
    return this.roomsService.joinRoom(req.user.sub, id);
  }

  @Post(':id/leave')
  async leaveRoom(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.roomsService.leaveRoom(req.user.sub, id);
    return { ok: true };
  }
}
