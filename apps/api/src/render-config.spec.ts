import { readFileSync } from 'fs';
import { join } from 'path';

describe('render.yaml', () => {
  it('email_transport_fake_production_konfigurasyonunda_asla_tanimlanmamali', () => {
    const renderYamlPath = join(__dirname, '../../../render.yaml');
    const content = readFileSync(renderYamlPath, 'utf-8');

    // EMAIL_TRANSPORT=fake gerçek Resend gönderimini atlıyor - sadece
    // test-fullstack-e2e CI job'ında set edilir (bkz. email.service.ts).
    // render.yaml canlı Render servisine otomatik bağlı değil (bkz.
    // STATE.md tuzak notu) ama yine de burada hiç görünmemeli - hem
    // dokümantasyon hem de birinin yanlışlıkla dashboard'a kopyalamasına
    // karşı ilk savunma hattı.
    expect(content).not.toContain('EMAIL_TRANSPORT');
  });
});
