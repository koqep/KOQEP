import { Controller, Get, Query } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(@Query('sentryDebugTrigger') sentryDebugTrigger?: string): {
    status: string;
  } {
    // GEÇİCİ - Sentry entegrasyonunu production'da doğrulamak için, bu
    // tanı doğrulanınca KALDIRILACAK. Nest'in kendi routing/controller
    // katmanından atılan, HttpException OLMAYAN, gerçek bir throw -
    // SentryGlobalFilter'ın isExpectedError() kontrolünü kesin olarak
    // geçemez, yakalanıp Sentry'ye gönderilir. Obscure query param adı
    // kazara/bot trafiğiyle tetiklenmesin diye.
    if (sentryDebugTrigger === 'koqep-m6-slice-b-verify') {
      throw new Error('Sentry entegrasyon doğrulaması - geçici tetikleyici.');
    }
    return { status: 'ok' };
  }
}
