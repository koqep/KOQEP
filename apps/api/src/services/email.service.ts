import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';

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
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'KOQEP — Şifre sıfırlama',
      html: `<p>Şifreni sıfırlamak için bağlantıya tıkla (30 dakika geçerli):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }

  async sendPasswordChangedNotificationEmail(to: string): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'KOQEP — Şifreniz değiştirildi',
      html: `<p>Hesabının şifresi az önce değiştirildi. Bunu sen yapmadıysan hesabına erişimin olmayabilir — bize ulaş.</p>`,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }

  async sendEmailVerificationEmail(
    to: string,
    verifyLink: string,
  ): Promise<void> {
    if (this.useFakeTransport) {
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'KOQEP — E-postanı doğrula',
      html: `<p>Hesabını etkinleştirmek için bağlantıya tıkla (24 saat geçerli):</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>Bu kaydı sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    });

    if (error) {
      throw new Error(`Resend gönderim hatası: ${error.message}`);
    }
  }
}
