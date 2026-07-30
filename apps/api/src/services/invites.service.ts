import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invite } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../db/prisma.service';

const INVITE_CODE_BYTES = 12;

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

  async createInvite(issuedById: string): Promise<{ code: string }> {
    const code = randomBytes(INVITE_CODE_BYTES).toString('base64url');
    await this.prisma.invite.create({ data: { code, issuedById } });
    return { code };
  }
}
