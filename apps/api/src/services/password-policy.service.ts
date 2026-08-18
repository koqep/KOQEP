import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { sha1Hex } from './crypto.util';

const HIBP_TIMEOUT_MS = 3000;

// M7a Slice F: HaveIBeenPwned k-anonymity check - sadece breach kontrolü,
// karmaşıklık kuralı (büyük/küçük harf/rakam/sembol) BİLEREK EKLENMİYOR.
// NIST 800-63B composition kurallarını gerçek entropi kazancı olmadan
// sürtünme olarak görüyor, breach-check'i tercih ediyor.
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  async assertNotBreached(password: string): Promise<void> {
    if (await this.isPasswordBreached(password)) {
      throw new BadRequestException({
        code: 'PASSWORD_BREACHED',
        message:
          'Bu şifre bilinen bir veri sızıntısında bulunmuş, başka bir şifre seç.',
      });
    }
  }

  private async isPasswordBreached(password: string): Promise<boolean> {
    try {
      const hash = sha1Hex(password).toUpperCase();
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        { signal: AbortSignal.timeout(HIBP_TIMEOUT_MS) },
      );
      if (!response.ok) {
        return false;
      }
      const body = await response.text();
      return body.split('\n').some((line) => line.split(':')[0] === suffix);
    } catch (error) {
      // Fail-open: HIBP defense-in-depth (argon2+TOTP zaten birincil
      // savunma), birincil değil - üçüncü parti bir API'nin kesintisi
      // TÜM signup'ları durdurursa bu, kapattığımız boşluktan daha kötü
      // bir kendi-kendine-DoS olurdu (solo-operator, 7/24 nöbet yok).
      // EmailService'in AYNI fail-open+log deseni.
      this.logger.error(`HIBP kontrolü başarısız: ${String(error)}`);
      return false;
    }
  }
}
