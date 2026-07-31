// e2e testler gerçek AppModule'ü ayağa kaldırır - gerçek /auth/signup (ya da
// şifre sıfırlama/hesap silme gibi onu iç çağrı olarak tetikleyen herhangi
// bir akış) EmailService mock'lanmadan çağrılırsa gerçek Resend'e gider.
// CI'daki RESEND_API_KEY sahte olduğu için bu 401 ile patlar (bu hata iki
// kez tekrarlandı - bkz. STATE.md tuzak notu). Her yeni e2e dosyası gerçek
// /auth/signup çağırıyorsa bu mock'u `overrideProvider(EmailService)` ile
// kullanmalı.
//
// Kasıtlı olarak EmailService'in class-shape'ine cast EDİLMİYOR (dönen
// değer plain bir obje) - jest.fn() alanlarını sınıf metodu gibi tiplemek
// `@typescript-eslint/unbound-method` kuralını `expect(mock.metod)` gibi
// kullanımlarda tetikliyor. Gerekli yerde (`.useValue()`) çağıran dosya
// kendi tipini uygular.
export function buildEmailServiceMock() {
  return {
    sendPasswordResetRequestEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedNotificationEmail: jest
      .fn()
      .mockResolvedValue(undefined),
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };
}
