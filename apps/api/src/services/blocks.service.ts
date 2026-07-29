import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedEmail: string): Promise<void> {
    const blockedUser = await this.findUserOrThrow(blockedEmail);
    if (blockedUser.id === blockerId) {
      throw new ConflictException('Kendini engelleyemezsin.');
    }

    await this.prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId: blockedUser.id },
      },
      update: {},
      create: { blockerId, blockedId: blockedUser.id },
    });
  }

  async unblock(blockerId: string, blockedEmail: string): Promise<void> {
    const blockedUser = await this.prisma.user.findUnique({
      where: { email: blockedEmail },
    });
    if (!blockedUser) {
      return;
    }

    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId: blockedUser.id },
    });
  }

  async listBlockedEmails(blockerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      include: { blocked: { select: { email: true } } },
    });
    return rows.map((row) => row.blocked.email);
  }

  async getBlockedAuthorIds(blockerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      select: { blockedId: true },
    });
    return rows.map((row) => row.blockedId);
  }

  async getBlockerIdsOf(authorId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockedId: authorId },
      select: { blockerId: true },
    });
    return rows.map((row) => row.blockerId);
  }

  private async findUserOrThrow(email: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return user;
  }
}
