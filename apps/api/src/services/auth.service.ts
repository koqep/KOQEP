import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { InvitesService } from './invites.service';
import { TotpService } from './totp.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from './email.service';
import { SocketRegistryService } from './socket-registry.service';
import { sha256Hex } from './crypto.util';
import { SignupDto } from '../api/dto/signup.dto';
import { LoginDto } from '../api/dto/login.dto';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly invitesService: InvitesService,
    private readonly totpService: TotpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly emailService: EmailService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  async verifyAccessToken(
    token: string,
  ): Promise<{ sub: string; email: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
    }
  }

  async signup(dto: SignupDto): Promise<void> {
    const invite = await this.invitesService.findRedeemableInvite(
      dto.inviteCode,
    );

    // Case-insensitive ön kontrol - DB'deki unique index case-sensitive,
    // bu yüzden "Alice" ve "alice" birbirini engellemez tek başına. Bu
    // sadece yaygın durumu ucuza yakalar; asıl yarış-durumu koruması
    // aşağıdaki P2002 backstop'u (bkz. isUniqueConstraintError).
    const existingUsername = await this.prisma.user.findFirst({
      where: { username: { equals: dto.username, mode: 'insensitive' } },
    });
    if (existingUsername) {
      throw new ConflictException('Bu kullanıcı adı zaten alınmış.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const userId = randomUUID();

    try {
      await this.prisma.$transaction(async (tx) => {
        // Sıra önemli: usedById FK'si var olan bir User satırını işaret
        // etmeli, o yüzden önce User oluşturulur, davet sonra "claim" edilir.
        // İkisi de aynı transaction'da — claim kaybedilirse (count===0)
        // User da birlikte geri alınır, yetim hesap kalmaz.
        await tx.user.create({
          data: {
            id: userId,
            email: dto.email,
            username: dto.username,
            passwordHash,
            inviterId: invite.issuedById,
            // DTO validasyonu acceptedTerms'in true olduğunu buraya
            // ulaşmadan önce zaten garanti ediyor - koşulsuz damga.
            termsAcceptedAt: new Date(),
          },
        });

        // revokedAt: null - findRedeemableInvite'ın kontrolünden SONRA ama
        // bu transaction'dan ÖNCE bir moderatörün daveti revoke etmesi
        // (M5 Slice E, davetçi hesap verebilirliği) mümkün, savunmacı.
        // count===0 artık "zaten kullanılmış" YA DA "revoke edilmiş"
        // anlamına gelebildiği için mesaj genelleştirildi.
        const claimed = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null, revokedAt: null },
          data: { usedById: userId, usedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new ConflictException('Bu davet kodu artık geçerli değil.');
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('Bu e-posta zaten kayıtlı.');
      }
      if (isUniqueConstraintError(error, 'username')) {
        throw new ConflictException('Bu kullanıcı adı zaten alınmış.');
      }
      throw error;
    }

    // M2.5 Slice B: signup artık token döndürmüyor - hesap doğrulanana
    // kadar giriş yapılamıyor. E-posta gönderim hatası burada BİLEREK
    // yutulmuyor (code-style.md'nin "hata yutma" kuralı) - bu noktada
    // gerçek bir hesap oluşturuldu ve gerçek bir davet tüketildi;
    // gönderim sessizce başarısız olursa kullanıcı asla doğrulayamayan
    // bir hesapla baş başa kalır. requestPasswordReset'in enumeration'a
    // karşı bilinçli sessiz yutma davranışıyla KARIŞTIRILMASIN - o farklı
    // bir tehdit modeline cevap veriyor.
    const rawToken =
      await this.emailVerificationService.createVerificationToken(userId);
    const verifyLink = `${process.env.WEB_ORIGIN}/verify-email?token=${rawToken}`;
    await this.emailService.sendEmailVerificationEmail(dto.email, verifyLink);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const isValid = user
      ? await verifyPasswordSafely(user.passwordHash, dto.password)
      : false;

    if (!user || !isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-posta veya şifre hatalı.',
      });
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'E-postanı doğrulaman gerekiyor.',
      });
    }

    if (this.totpService.isEnabled(user)) {
      const totpValid =
        !!dto.totpCode &&
        (await this.totpService.verifyDuringLogin(user.id, dto.totpCode));
      if (!totpValid) {
        // code alanı Slice E'nin frontend'i için: "yanlış şifre" ile "TOTP
        // gerekli" durumlarını ayırt etmek için mesaj metnine güvenmek
        // kırılgan olurdu (bkz. plan notları) - yapısal bir kontrat.
        throw new UnauthorizedException({
          code: 'TOTP_REQUIRED',
          message: 'Geçerli bir TOTP kodu gerekli.',
        });
      }
    }

    return this.issueTokenPair(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = sha256Hex(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    return this.issueTokenPair(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256Hex(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ADR-0005: hesap düzeyindeki PII'yi hard-delete eder (User satırının
  // kendisi), mesaj içeriği yerinde kalır. Message.authorId zaten
  // ON DELETE SET NULL (messages.service.ts zaten null yazarı
  // "authorUsername: null" olarak dönüyor, MessageItem.tsx zaten "silinmiş
  // kullanıcı" render ediyor). RefreshToken/TotpRecoveryCode/
  // PasswordResetToken/EmailVerificationToken/Block satırları ON DELETE
  // CASCADE ile otomatik siliniyor - "tüm refresh token'ların iptali"
  // görevi, satırların iptal değil komple yok olmasıyla daha güçlü şekilde
  // karşılanıyor. Invite.issuedById de SET NULL - davet hâlâ kullanılabilir
  // kalıyor, sadece "kim yayınladı" bilgisi siliniyor (bkz. milestone Plan
  // notları - GDPR/KVKK silme hakkı, M5'in henüz tasarlanmamış davetçi
  // hesap-verebilirliği fikrinden önceliklidir).
  async deleteAccount(
    userId: string,
    password: string,
    totpCode?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const passwordValid = user
      ? await verifyPasswordSafely(user.passwordHash, password)
      : false;

    if (!user || !passwordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Şifre hatalı.',
      });
    }

    if (this.totpService.isEnabled(user)) {
      const totpValid =
        !!totpCode &&
        (await this.totpService.verifyDuringLogin(user.id, totpCode));
      if (!totpValid) {
        throw new UnauthorizedException({
          code: 'TOTP_REQUIRED',
          message: 'Geçerli bir TOTP kodu gerekli.',
        });
      }
    }

    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      // P2025: satır zaten yok - yarış durumu (aynı 15 dk'lık access
      // token'la ikinci çağrı, ya da bir önceki silmeden sonra). UsersService
      // .getProfile'ın "token doğrulanıyor ama satır yok" durumuyla aynı
      // temiz 401, 500 değil.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UnauthorizedException('Geçersiz veya süresi dolmuş token.');
      }
      throw error;
    }

    // Hesap gerçekten silindi - hâlâ açık olabilecek soketleri (15 dk'lık
    // JWT TTL'i içinde) hemen kapat. M2.5 Slice D: Slice C'nin
    // ertelediği "silinmiş kullanıcının soketi sessizce yutuluyor"
    // sorununun asıl çözümü burası.
    this.socketRegistry.disconnectUser(userId);
  }

  // Kasıtlı olarak her zaman "başarılı" davranır (istisnası: e-posta
  // gönderim hatasını loglar, fırlatmaz) — kullanıcı bulunamadıysa veya
  // e-posta gönderimi başarısız olduysa client'a farklı bir sonuç
  // dönmek, bu endpoint üzerinden hangi e-postaların kayıtlı olduğunu
  // sızdırır (THREAT-MODEL satır 11'in "no enumeration" gereksinimi).
  // Gerçek altyapı hatalarını (DB çökmesi vb.) yutmuyoruz — onlar tüm
  // isteklerde eşit etkili, enumeration riski taşımıyor.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const rawToken = await this.passwordResetService.createResetToken(user.id);
    const resetLink = `${process.env.WEB_ORIGIN}/reset-password?token=${rawToken}`;

    try {
      await this.emailService.sendPasswordResetRequestEmail(
        user.email,
        resetLink,
      );
    } catch (error) {
      this.logger.error(
        `Şifre sıfırlama e-postası gönderilemedi: ${(error as Error).message}`,
      );
    }
  }

  async confirmPasswordReset(
    rawToken: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş sıfırlama bağlantısı.',
      );
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnauthorizedException(
          'Geçersiz veya süresi dolmuş sıfırlama bağlantısı.',
        );
      }

      await tx.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });

      // THREAT-MODEL satır 11: şifre değişince tüm aktif oturumlar iptal
      // edilir. Bu endpoint hiçbir zaman token döndürmez (TOTP açık olsun
      // olmasın) — "sıfırlama tek başına giriş sağlamaz" burada özel bir
      // dallanma değil, yapısal bir sonuç: kullanıcı ayrıca /auth/login'e
      // gitmeli, TOTP kontrolü zaten orada uygulanıyor (Slice B).
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    try {
      await this.emailService.sendPasswordChangedNotificationEmail(user.email);
    } catch (error) {
      this.logger.error(
        `Şifre değişikliği bildirimi gönderilemedi: ${(error as Error).message}`,
      );
    }
  }

  async confirmEmailVerification(rawToken: string): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    const stored = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş doğrulama bağlantısı.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnauthorizedException(
          'Geçersiz veya süresi dolmuş doğrulama bağlantısı.',
        );
      }

      // Şifre sıfırlamanın aksine burada oturum iptali/token yayını YOK -
      // doğrulama sadece giriş kapısını açıyor, kendisi giriş sağlamıyor
      // (confirmPasswordReset'in "sıfırlama tek başına giriş sağlamaz"
      // ilkesiyle aynı, buradaki karşılığı "doğrulama tek başına giriş
      // sağlamaz").
      await tx.user.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}

async function verifyPasswordSafely(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}
