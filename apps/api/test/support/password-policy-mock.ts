// e2e testler gerçek AppModule'ü ayağa kaldırır - gerçek /auth/signup (ya da
// şifre sıfırlama gibi onu iç çağrı olarak tetikleyen herhangi bir akış)
// PasswordPolicyService mock'lanmadan çağrılırsa gerçek
// api.pwnedpasswords.com'a gider. CI'da bu üçüncü parti bir API'yi
// yavaşlatır/kırılganlaştırır - email-service-mock.ts'in AYNI kuralı,
// farklı bir provider için (bkz. .claude/rules/testing.md). Her yeni e2e
// dosyası gerçek /auth/signup ya da /auth/password-reset/confirm
// çağırıyorsa bu mock'u `overrideProvider(PasswordPolicyService)` ile
// kullanmalı.
export function buildPasswordPolicyServiceMock() {
  return {
    assertNotBreached: jest.fn().mockResolvedValue(undefined),
  };
}
