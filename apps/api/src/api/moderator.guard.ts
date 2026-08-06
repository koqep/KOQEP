import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import type { AuthenticatedRequest } from './jwt-auth.guard';

// getMessageEditHistory'nin (messages.service.ts) inline role !== 'moderator'
// kontrolünü aynen ama reusable bir CanActivate olarak - SADECE yeni
// moderatör-only endpoint'lerde kullanılıyor. getMessageEditHistory'nin
// kendi guard'ları BİLEREK değiştirilmedi - o metot yazar-VEYA-moderatör
// izin veriyor, bu guard'ı orada blanket kullanmak yazarın kendi geçmişini
// görmesini kırardı. Her zaman JwtAuthGuard'dan SONRA kullanılmalı ki
// req.user zaten set edilmiş olsun.
@Injectable()
export class ModeratorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requester = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { role: true },
    });
    if (requester?.role !== 'moderator') {
      throw new ForbiddenException('Bu işlem için moderatör yetkisi gerekli.');
    }
    return true;
  }
}
