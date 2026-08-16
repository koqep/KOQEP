import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { AuthService } from './auth.service';

export const MODERATOR_ASSIGNED_ACTION = 'MODERATOR_ASSIGNED';
export const MODERATOR_REVOKED_ACTION = 'MODERATOR_REVOKED';

export interface ModeratorRoleResult {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class ModeratorRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // M7a Slice C: atama, deleteAccount'la AYNI hassasiyet sınıfında (kalıcı,
  // geri döndürülmesi elle-SQL gerektiren bir yetki değişikliği) - şifre+TOTP
  // reauth şart. Ele geçirilmiş bir OTURUM (çalınmış token, XSS) bile gerçek
  // şifre/TOTP olmadan yeni bir moderatör (kalıcı bir arka kapı) atayamaz.
  async assignModerator(
    moderatorId: string,
    password: string,
    totpCode: string | undefined,
    targetEmail: string,
  ): Promise<ModeratorRoleResult & { alreadyModerator: boolean }> {
    await this.authService.verifyCurrentPassword(
      moderatorId,
      password,
      totpCode,
    );

    const target = await this.findUserOrThrow(targetEmail);
    const alreadyModerator = target.role === 'moderator';
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { role: 'moderator' },
      }),
      this.prisma.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: MODERATOR_ASSIGNED_ACTION,
          targetUserId: target.id,
        },
      }),
    ]);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      alreadyModerator,
    };
  }

  // Atamanın aksine reauth İSTEMİYOR - yetki azaltan yön kendi kendini
  // iyileştiren bir hata (yanlışlıkla düşürülen biri başka bir moderatör
  // tarafından tekrar atanabilir), kod tabanındaki diğer hiçbir yetki-
  // azaltma aksiyonu (mute/unmute/archive/delete) de reauth istemiyor.
  async revokeModerator(
    moderatorId: string,
    targetEmail: string,
  ): Promise<ModeratorRoleResult & { wasNotModerator: boolean }> {
    const target = await this.findUserOrThrow(targetEmail);

    // Son moderatör kendini düşüremez - aksi halde sistemde HİÇ moderatör
    // kalmaz ve ModeratorGuard hem assign hem revoke'u herkese kapatır,
    // SQL'siz kurtarma imkansızlaşır. Başkasını düşürmek bu riski hiç
    // taşımıyor (aktör moderatör olarak kalıyor).
    if (target.id === moderatorId) {
      const moderatorCount = await this.prisma.user.count({
        where: { role: 'moderator' },
      });
      if (moderatorCount <= 1) {
        throw new ConflictException(
          'Son moderatör kendi yetkisini kaldıramaz.',
        );
      }
    }

    const wasNotModerator = target.role !== 'moderator';
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { role: 'user' },
      }),
      this.prisma.moderationAuditLog.create({
        data: {
          moderatorId,
          actionType: MODERATOR_REVOKED_ACTION,
          targetUserId: target.id,
        },
      }),
    ]);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      wasNotModerator,
    };
  }

  private async findUserOrThrow(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return user;
  }
}
