import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { BlockUserDto } from './dto/block-user.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { BlocksService } from '../services/blocks.service';
import {
  UsersService,
  UserProfile,
  PublicUserProfile,
} from '../services/users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(
    private readonly blocksService: BlocksService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest): Promise<UserProfile> {
    return this.usersService.getProfile(req.user.sub);
  }

  // M9 Slice B: kullanıcının kendi dilini ayarlardan değiştirmesi için -
  // User.locale'in zaten SAHİBİ olduğu için doğal yer burası. Kötüye
  // kullanılabilir bir eylem değil, ek bir throttler guard gerekmiyor
  // (sadece controller-seviyesi JwtAuthGuard).
  @Patch('me/locale')
  async updateLocale(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateLocaleDto,
  ): Promise<{ ok: true }> {
    await this.usersService.updateLocale(req.user.sub, dto.locale);
    return { ok: true };
  }

  // M10 Faz 2 Slice D+E: başkasının profili - public-safe alan seti,
  // UsersService.getPublicProfile'ın kendisi email/mutedUntil/muteReason
  // döndürmüyor (handler'da ek bir filtreleme gerekmiyor).
  @Get(':username/profile')
  getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfile> {
    return this.usersService.getPublicProfile(username);
  }

  @Post('block')
  async block(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BlockUserDto,
  ): Promise<{ ok: true }> {
    await this.blocksService.block(req.user.sub, dto.email);
    return { ok: true };
  }

  @Post('unblock')
  async unblock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BlockUserDto,
  ): Promise<{ ok: true }> {
    await this.blocksService.unblock(req.user.sub, dto.email);
    return { ok: true };
  }

  @Get('blocked')
  listBlocked(
    @Req() req: AuthenticatedRequest,
  ): Promise<Array<{ email: string; username: string }>> {
    return this.blocksService.listBlockedUsers(req.user.sub);
  }
}
