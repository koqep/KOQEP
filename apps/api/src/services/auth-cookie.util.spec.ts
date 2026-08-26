import {
  parseCookieHeader,
  buildRefreshCookieOptions,
  buildCsrfCookieOptions,
  buildClearCookieOptions,
  generateCsrfToken,
  getCsrfCookieDomain,
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
      const options = buildCsrfCookieOptions(undefined);
      expect(options.path).toBe('/');
      expect(options.httpOnly).toBe(false);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
    });

    it('webOrigin_tanimsizsa_domain_alani_hic_yok_host_only_kalir', () => {
      expect(buildCsrfCookieOptions(undefined).domain).toBeUndefined();
    });

    it('gercek_bir_web_origin_icin_domain_alani_eklenir', () => {
      expect(buildCsrfCookieOptions('https://koqep.com').domain).toBe(
        '.koqep.com',
      );
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

    it('domain_alani_hic_yok_bilerek_host_only', () => {
      // httpOnly olduğu için document.cookie sorunu yok - .koqep.com'a
      // genişletmek gereksiz bir subdomain-XSS blast radius'u açardı.
      expect(buildRefreshCookieOptions().domain).toBeUndefined();
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

  describe('getCsrfCookieDomain', () => {
    it('www_siz_origin_icin_baslangic_noktali_domain_doner', () => {
      expect(getCsrfCookieDomain('https://koqep.com')).toBe('.koqep.com');
    });

    it('www_li_origin_icin_www_siz_kok_domaini_doner', () => {
      expect(getCsrfCookieDomain('https://www.koqep.com')).toBe('.koqep.com');
    });

    it('localhost_icin_undefined_doner_host_only_davranisi_korunur', () => {
      expect(getCsrfCookieDomain('http://localhost:3000')).toBeUndefined();
    });

    it('ipv4_adresi_icin_undefined_doner', () => {
      expect(getCsrfCookieDomain('http://127.0.0.1:3000')).toBeUndefined();
    });

    it('ipv6_adresi_icin_undefined_doner', () => {
      expect(getCsrfCookieDomain('http://[::1]:3000')).toBeUndefined();
    });

    it('tanimsiz_env_icin_undefined_doner_eski_davranisi_bozmaz', () => {
      expect(getCsrfCookieDomain(undefined)).toBeUndefined();
    });

    it('bozuk_url_icin_hata_firlatmaz_undefined_doner', () => {
      expect(getCsrfCookieDomain('gecersiz bir deger')).toBeUndefined();
    });
  });
});
