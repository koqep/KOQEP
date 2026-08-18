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
import { PasswordPolicyService } from './password-policy.service';
import { sha256Hex } from './crypto.util';
import { SignupDto } from '../api/dto/signup.dto';
import { LoginDto } from '../api/dto/login.dto';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// M7a Slice A: iki sekme aynı httpOnly refresh-token cookie'sini paylaşıyor
// (bkz. auth-cookie.util.ts) - biri rotasyon yapınca diğeri artık-revoke-
// edilmiş eski token'la gelebilir. Bu pencere içinde BİR KEZ (RefreshToken.
// graceReusedAt) daha kabul edilir - OAuth ekosisteminde "refresh token
// reuse detection with grace period" olarak bilinen, bilinçli ve dar
// (10sn + tek kullanım) bir tavizdir, bkz. ADR-0002 Addendum.
const REFRESH_TOKEN_REUSE_GRACE_MS = 10 * 1000;

// M7a Slice F: hesap-bazlı brute-force kilidi - SADECE yanlış şifrede
// artar (TOTP başarısızlığı hiç dokunmaz, bkz. login()'in kendi yorumu).
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// Bir hedefe karşı sürdürülen bir saldırı bildirim sayısını günde en
// fazla 2'ye sınırlıyor - kullanıcı İLK saldırıdan hemen haberdar olur,
// aynı gün içindeki tekrarlar sessiz kalır ama saldırı ERTESİ gün de
// sürerse yeniden bildirilir.
const LOCKOUT_NOTIFICATION_COOLDOWN_MS = 12 * 60 * 60 * 1000;
// Kilitli-hesap yanıtının normal yanlış-şifre yanıtıyla ZAMANLAMA olarak
// ayırt edilememesi için - gerçek bir şifreye karşılık gelmiyor, sadece
// argon2'nin hesaplama SÜRESİNİ taklit ediyor (bkz. login()'in kendi
// yorumu). `node -e "require('argon2').hash('dummy-lockout-timing-parity').then(console.log)"`
// ile BİR KEZ üretildi.
const LOCKOUT_DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$mZEgK4YC8J0DvNm3a3Ajdw$3AMUJYEn07X80qyfWXMFoRn5JhbJD6OkMgyXpYFh3SE';

// M7a Slice A: web istemcisi 401 alan authed çağrıları BİR KEZ sessizce
// refresh-ve-tekrar-dene mantığıyla iyileştiriyor (bkz. lib/api.ts) - ama
// bu SADECE "access token'ın kendisi geçersiz/süresi dolmuş" durumunda
// doğru davranış, TOTP_REQUIRED/INVALID_CREDENTIALS gibi DOMAIN 401'lerinde
// DEĞİL (aksi halde o gerçek hatanın code/message'ı sessizce kaybolur,
// kullanıcı "TOTP kodu yanlış" yerine "oturum yenilenemedi" görür). Bu code
// SADECE "token'ın kendisi geçersiz" anlamına gelen 401'lere eklenir -
// jwt-auth.guard.ts + verifyAccessToken + deleteAccount'ın P2025 dalı +
// UsersService.getProfile'ın "token doğrulanıyor ama satır yok" dalı.
export const INVALID_TOKEN_CODE = 'INVALID_TOKEN';

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
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async verifyAccessToken(
    token: string,
  ): Promise<{ sub: string; email: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
    } catch {
      throw new UnauthorizedException({
        code: INVALID_TOKEN_CODE,
        message: 'Geçersiz veya süresi dolmuş token.',
      });
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

    await this.passwordPolicyService.assertNotBreached(dto.password);

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

        // M7a Slice B (ADR-0009): yeni kullanıcı çekirdek odalara otomatik
        // üye olur - bugünkü örtük "herkes general'de başlıyor"
        // davranışını AYNEN koruyor, yeni bir özellik değil. Backfill
        // script'inin mevcut kullanıcılar için yaptığı AYNI şeyin ileriye
        // dönük hali.
        const coreRooms = await tx.room.findMany({
          where: { name: { in: [...CORE_ROOM_NAMES] } },
          select: { id: true },
        });
        if (coreRooms.length > 0) {
          await tx.roomMember.createMany({
            data: coreRooms.map((room) => ({ userId, roomId: room.id })),
          });
        }

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
    const now = new Date();

    // M7a Slice F: kilitli bir hesap için ŞİFRE DOĞRULAMASI HİÇ YAPILMAZ
    // ve AYRI bir hata kodu/mesaj DÖNMEZ - normal yanlış-şifre yanıtıyla
    // birebir aynı ({code:'INVALID_CREDENTIALS', ...}), tetikleyen istekte
    // bile. Ayrı bir 'ACCOUNT_LOCKED' kodu sıfır ön-bilgiyle bir
    // email-enumeration oracle'ı olurdu (5 rastgele yanlış şifre → hangi
    // kod döndüğüne bakarak email'in kayıtlı olup olmadığı öğrenilebilirdi
    // - global IP throttle bunu hiç yavaşlatmaz, dağıtık script'lenebilir).
    // Dummy hash'e karşı argon2 çalıştırmak zamanlama paritesi sağlıyor -
    // aksi halde bu dal (argon2 atlanmış) normal yanlış-şifre dalından
    // (argon2 çalışmış) ÖLÇÜLEBİLİR şekilde hızlı dönerdi.
    if (user && isCurrentlyLocked(user, now)) {
      await verifyPasswordSafely(LOCKOUT_DUMMY_HASH, dto.password);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-posta veya şifre hatalı.',
      });
    }

    const isValid = user
      ? await verifyPasswordSafely(user.passwordHash, dto.password)
      : false;

    if (!user || !isValid) {
      if (user) {
        const next = computeNextLockoutState(user, now);
        await this.prisma.user.update({ where: { id: user.id }, data: next });
        // Kilit BU istekte tetiklendiyse (next.lockedUntil dolu) VE
        // soğuma penceresi geçtiyse hesap sahibine bildirim - AMA `await`
        // EDİLMİYOR: bir Resend ağ turu await edilirse, kilidi TETİKLEYEN
        // istek diğer yanlış-şifre isteklerinden ÖLÇÜLEBİLİR şekilde
        // YAVAŞ döner - yukarıdaki argon2-zamanlama düzeltmesinin
        // kapattığı ile AYNI kategori bir enumeration oracle'ı, farklı
        // bir kanaldan. `void` ile ateşle-unut, yanıt e-posta sonucunu
        // hiç beklemeden döner.
        if (
          next.lockedUntil &&
          shouldSendLockoutNotification(user.lockoutNotifiedAt, now)
        ) {
          void this.sendLockoutNotification(user.id, user.email, now);
        }
      }
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-posta veya şifre hatalı.',
      });
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
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

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token.',
      );
    }

    if (stored.revokedAt) {
      // Grace toleransı SADECE rotasyon-kaynaklı revoke'lara uygulanır -
      // logout/confirmPasswordReset'in bilerek ANINDA/kesin iptali
      // (revokedByRotation: false) hiç etkilenmez, kullanıcı çıkış
      // yaptığında "birkaç saniye daha çalışır" beklemez.
      const withinGrace =
        Date.now() - stored.revokedAt.getTime() <= REFRESH_TOKEN_REUSE_GRACE_MS;
      if (!stored.revokedByRotation || !withinGrace || stored.graceReusedAt) {
        throw new UnauthorizedException(
          'Geçersiz veya süresi dolmuş refresh token.',
        );
      }
      // Atomik claim - iki yarışan grace-denemesinin (ör. iki sekmenin
      // neredeyse aynı anda gelen istekleri) ikisinin de aynı hakkı
      // harcamasını önler (count===0 = başka bir istek zaten harcadı).
      const claimed = await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, graceReusedAt: null },
        data: { graceReusedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnauthorizedException(
          'Geçersiz veya süresi dolmuş refresh token.',
        );
      }
    } else {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), revokedByRotation: true },
      });
    }

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

  // M7a Slice C: deleteAccount'ın kendi şifre+TOTP reauth mantığından
  // çıkarıldı - moderator-role.service.ts'in assignModerator'ı da AYNI
  // reauth'u istiyor (kalıcı bir yetki-yükseltme aksiyonu, deleteAccount'un
  // kalıcı hesap-silmesiyle aynı hassasiyet sınıfı - ele geçirilmiş bir
  // OTURUM ile bile gerçek şifre/TOTP olmadan tetiklenemesin diye).
  async verifyCurrentPassword(
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
    await this.verifyCurrentPassword(userId, password, totpCode);

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
        throw new UnauthorizedException({
          code: INVALID_TOKEN_CODE,
          message: 'Geçersiz veya süresi dolmuş token.',
        });
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

    await this.passwordPolicyService.assertNotBreached(newPassword);

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

      // failedLoginCount/lockedUntil de burada temizlenir (M7a Slice F,
      // kullanıcının review'ında bulunan gerçek bug) - e-posta erişimini
      // kanıtlamak kilit mekanizmasının kendisinden (sadece "5 yanlış
      // şifre denemesi") DAHA güçlü bir doğrulama; temizlenmezse kilitli
      // bir kullanıcı yeni şifresiyle bile giriş yapamaz, kendisi için
      // açıklanamaz bir durum olur.
      await tx.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
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

  // login()'den AWAIT EDİLMEDEN çağrılıyor (bkz. login()'in kendi
  // yorumu) - yanıt yolunun dışında, kendi try/catch'i içinde.
  // confirmPasswordReset'in ZATEN kurulu fail-open deseni (e-posta hatası
  // birincil akışı etkilemez), sadece burada ayrıca AWAIT de edilmiyor.
  // lockoutNotifiedAt SADECE gönderim BAŞARILI olursa güncellenir -
  // geçici bir Resend hatası bir sonraki döngüde tekrar denenebilsin diye.
  private async sendLockoutNotification(
    userId: string,
    email: string,
    notifiedAt: Date,
  ): Promise<void> {
    try {
      await this.emailService.sendAccountLockedNotificationEmail(email);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockoutNotifiedAt: notifiedAt },
      });
    } catch (error) {
      this.logger.error(
        `Hesap kilidi bildirimi gönderilemedi: ${(error as Error).message}`,
      );
    }
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

// M7a Slice F: login()'in kendi gövdesinden AYRI, bağımsız test edilebilir
// saf fonksiyonlar - "süre-dolmuş kilit sıfırlanır mı" aritmetiği
// off-by-one/`<=` vs `<` gibi hataların en olası olduğu yer.
function isCurrentlyLocked(
  user: { lockedUntil: Date | null },
  now: Date,
): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

function computeNextLockoutState(
  user: { failedLoginCount: number; lockedUntil: Date | null },
  now: Date,
): { failedLoginCount: number; lockedUntil: Date | null } {
  const expired = user.lockedUntil !== null && user.lockedUntil <= now;
  const baseCount = expired ? 0 : user.failedLoginCount;
  const nextCount = baseCount + 1;
  if (nextCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS),
    };
  }
  return { failedLoginCount: nextCount, lockedUntil: null };
}

// Kilit bildirimi TEK bir kilit döngüsü içinde spam DEĞİL (tetikleyen
// istekte bir kez), ama DÖNGÜLER ARASI sınırsız OLABİLİRDİ - saldırgan 5
// deneme/15dk bekle/5 deneme daha ile günde onlarca e-posta üretebilirdi.
// Bu fonksiyon o boşluğu kapatıyor.
function shouldSendLockoutNotification(
  lockoutNotifiedAt: Date | null,
  now: Date,
): boolean {
  return (
    lockoutNotifiedAt === null ||
    now.getTime() - lockoutNotifiedAt.getTime() >=
      LOCKOUT_NOTIFICATION_COOLDOWN_MS
  );
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}
