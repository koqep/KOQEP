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

  async listBlockedUsers(
    blockerId: string,
  ): Promise<Array<{ email: string; username: string }>> {
    // Block.blockedId onDelete:Cascade (schema.prisma) - engellenen bir
    // hesap silinirse bu satır da birlikte silinir, yani `username` burada
    // ADR-0005'in "yazar bağlantısı anonimleşir" durumuna hiç düşmez, her
    // zaman canlı bir kullanıcıya ait, non-null bir değer.
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      include: { blocked: { select: { email: true, username: true } } },
    });
    return rows.map((row) => ({
      email: row.blocked.email,
      username: row.blocked.username,
    }));
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
