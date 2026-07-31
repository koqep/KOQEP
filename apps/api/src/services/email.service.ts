import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromAddress: string;

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
  }

  async sendPasswordResetRequestEmail(
    to: string,
    resetLink: string,
  ): Promise<void> {
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
