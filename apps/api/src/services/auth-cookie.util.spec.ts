import {
  parseCookieHeader,
  buildRefreshCookieOptions,
  buildCsrfCookieOptions,
  buildClearCookieOptions,
  generateCsrfToken,
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
} from './auth-cookie.util';

describe('auth-cookie.util', () => {
  describe('parseCookieHeader', () => {
    it('birden_fazla_cookie_iceren_header_i_dogru_ayristirir', () => {
      const result = parseCookieHeader(
        `${REFRESH_COOKIE_NAME}=abc; ${CSRF_COOKIE_NAME}=def`,
      );
      expect(result).toEqual({
        [REFRESH_COOKIE_NAME]: 'abc',
        [CSRF_COOKIE_NAME]: 'def',
      });
    });

    it('url_encoded_degerleri_decode_eder', () => {
      const result = parseCookieHeader('foo=bar%20baz');
      expect(result.foo).toBe('bar baz');
    });

    it('header_tanimsizsa_bos_nesne_doner', () => {
      expect(parseCookieHeader(undefined)).toEqual({});
    });

    it('bos_stringi_bos_nesne_olarak_doner', () => {
      expect(parseCookieHeader('')).toEqual({});
    });
  });

  describe('buildCsrfCookieOptions', () => {
    it('path_kok_dizindir_httpOnly_false_dur', () => {
      // Kullanıcının review'ında bulunan gerçek bug'ın regresyon testi:
      // path:'/auth' olsaydı document.cookie bu değeri /'dan hiç okuyamazdı.
      const options = buildCsrfCookieOptions();
      expect(options.path).toBe('/');
      expect(options.httpOnly).toBe(false);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
    });
  });

  describe('buildRefreshCookieOptions', () => {
    it('path_auth_a_daraltilmis_httpOnly_true_dur', () => {
      const options = buildRefreshCookieOptions();
      expect(options.path).toBe('/auth');
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
    });
  });

  describe('buildClearCookieOptions', () => {
    it('maxAge_sifira_dusurur_diger_alanlari_korur', () => {
      const base = buildRefreshCookieOptions();
      const cleared = buildClearCookieOptions(base);
      expect(cleared.maxAge).toBe(0);
      expect(cleared.path).toBe(base.path);
      expect(cleared.httpOnly).toBe(base.httpOnly);
    });
  });

  describe('generateCsrfToken', () => {
    it('her_cagrida_farkli_deger_uretir', () => {
      expect(generateCsrfToken()).not.toBe(generateCsrfToken());
    });
  });
});
