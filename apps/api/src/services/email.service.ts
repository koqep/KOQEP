import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Locale } from '../db/locale.constants';

const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';

interface EmailContent {
  subject: string;
  html: string;
}

// M9 Slice E: apps/web/lib/i18n.ts'in translations/ERROR_MESSAGES
// desenine BENZER - düz bir Record<Locale,...>, karışık bir frontend
// importu YOK (backend'e özel kendi kopyası). TR değerleri şablonların
// eskiden hardcoded taşıdığı metinlerle BİREBİR aynı - kod PAYLAŞIMI
// değil, YENİDEN İFADE etmeden taşıma (frontend dalgalarındaki disiplin).
const EMAIL_TEMPLATES: Record<
  Locale,
  {
    passwordResetRequest: (resetLink: string) => EmailContent;
    passwordChangedNotification: () => EmailContent;
    accountLockedNotification: () => EmailContent;
    emailVerification: (verifyLink: string) => EmailContent;
  }
> = {
  en: {
    passwordResetRequest: (resetLink) => ({
      subject: 'KOQEP — Password reset',
      html: `<p>Click the link to reset your password (valid for 30 minutes):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
    passwordChangedNotification: () => ({
      subject: 'KOQEP — Your password was changed',
      html: `<p>Your account's password was just changed. If this wasn't you, you may have lost access to your account — contact us.</p>`,
    }),
    accountLockedNotification: () => ({
      subject: 'KOQEP — Your account was temporarily locked',
      html: `<p>Your account was temporarily locked after repeated failed login attempts. If this wasn't you, we recommend changing your password.</p>`,
    }),
    emailVerification: (verifyLink) => ({
      subject: 'KOQEP — Verify your email',
      html: `<p>Click the link to activate your account (valid for 24 hours):</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>If you didn't sign up for this, you can ignore this email.</p>`,
    }),
  },
  tr: {
    passwordResetRequest: (resetLink) => ({
      subject: 'KOQEP — Şifre sıfırlama',
      html: `<p>Şifreni sıfırlamak için bağlantıya tıkla (30 dakika geçerli):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    }),
    passwordChangedNotification: () => ({
      subject: 'KOQEP — Şifreniz değiştirildi',
      html: `<p>Hesabının şifresi az önce değiştirildi. Bunu sen yapmadıysan hesabına erişimin olmayabilir — bize ulaş.</p>`,
    }),
    accountLockedNotification: () => ({
      subject: 'KOQEP — Hesabın geçici olarak kilitlendi',
      html: `<p>Hesabına art arda başarısız giriş denemesi yapıldığı için hesabın kısa süreliğine kilitlendi. Bu sen değilsen, şifreni değiştirmeni öneririz.</p>`,
    }),
    emailVerification: (verifyLink) => ({
      subject: 'KOQEP — E-postanı doğrula',
      html: `<p>Hesabını etkinleştirmek için bağlantıya tıkla (24 saat geçerli):</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    }),
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly useFakeTransport: boolean;

  constructor(config: ConfigService) {
    // Konstrüktör asla fırlatmamalı — RESEND_API_KEY yerelde/CI'da hiç
    // ayarlanmamış olabilir (resend hesabı henüz kurulmamış). `new
    // Resend(undefined)` fırlatır ama herhangi bir string fırlatmaz;
    // gerçek gönderim denenene kadar sorun yok. AppModule'u her e2e
    // testin ayağa kaldırdığı unutulmasın (bkz. Slice C plan notları).
    this.resend = new Resend(
      config.get<string>('RESEND_API_KEY') ?? 'unset-in-local-dev',
    );
    this.fromAddress =
      config.get<string>('EMAIL_FROM_ADDRESS') ?? DEFAULT_FROM_ADDRESS;
    // Kesin string eşitliği — `'false'` gibi boş olmayan herhangi bir
    // string'in truthy davranmasına izin verme (ENABLE_DEV_LOGIN'de
    // yaşanan sınıfın aynısı). Sadece test-fullstack-e2e CI job'ında
    // set edilir: o job gerçek bir sunucu süreci başlattığı için
    // (`start:prod`) diğer e2e dosyalarındaki gibi DI seviyesinde
    // `overrideProvider(EmailService)` mümkün değil. Production'da BU
    // ASLA set edilmemeli — render.yaml'a bilerek eklenmedi (bkz.
    // render-config.spec.ts, ki bunu statik olarak doğruluyor).
    this.useFakeTransport = config.get<string>('EMAIL_TRANSPORT') === 'fake';
    if (this.useFakeTransport) {
      this.logger.warn(
        'EMAIL_TRANSPORT=fake aktif — gerçek Resend çağrısı YAPILMAYACAK. ' +
          'Bu satır production loglarında görünüyorsa acilen render.yaml / ' +
          'Render dashboard kontrol edilmeli.',
      );
    }
  }

  async sendPasswordResetRequestEmail(
    to: string,
    resetLink: string,
    locale: Locale,
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { subject, html } =
      EMAIL_TEMPLATES[locale].passwordResetRequest(resetLink);
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }

  async sendPasswordChangedNotificationEmail(
    to: string,
    locale: Locale,
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { subject, html } =
      EMAIL_TEMPLATES[locale].passwordChangedNotification();
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }

  // M7a Slice F: hesap art arda başarısız girişle kilitlenince hesap
  // SAHİBİNİN kendi kayıtlı e-postasına gider - saldırgan bunu hiç
  // görmez (enumeration riski yok), gerçek sahip NEDEN giremediğini
  // öğrenir.
  async sendAccountLockedNotificationEmail(
    to: string,
    locale: Locale,
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { subject, html } =
      EMAIL_TEMPLATES[locale].accountLockedNotification();
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }

  async sendEmailVerificationEmail(
    to: string,
    verifyLink: string,
    locale: Locale,
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { subject, html } =
      EMAIL_TEMPLATES[locale].emailVerification(verifyLink);
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }
}
