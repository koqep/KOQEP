import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invite } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async findRedeemableInvite(code: string): Promise<Invite> {
    const invite = await this.prisma.invite.findUnique({ where: { code } });

    if (!invite) {
      throw new NotFoundException('Davet kodu bulunamadı.');
    }
    if (invite.usedAt) {
      throw new ConflictException('Bu davet kodu zaten kullanılmış.');
    }

    return invite;
  }
}
