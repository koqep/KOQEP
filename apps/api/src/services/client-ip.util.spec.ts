import { getRealClientIp } from './client-ip.util';

describe('getRealClientIp', () => {
  it('tek_degerli_xff_varken_onu_dondurur', () => {
    expect(getRealClientIp('203.0.113.5', '10.0.0.1')).toBe('203.0.113.5');
  });

  it('render_in_prepend_deseninde_ilk_degeri_dondurur', () => {
    // Render, gerçek istemci IP'sini listenin BAŞINA ekliyor - istemcinin
    // kendi gönderdiği (sahte olabilecek) değer(ler) SONRA gelir.
    expect(getRealClientIp('203.0.113.5, 6.6.6.6', '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('coklu_sahte_deger_zincirinde_yine_ilk_degeri_dondurur', () => {
    expect(getRealClientIp('203.0.113.5, 6.6.6.6, 7.7.7.7', '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('bastaki_sondaki_bosluklari_temizler', () => {
    expect(getRealClientIp('  203.0.113.5  ,  6.6.6.6  ', '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('header_yokken_remoteAddress_e_duser', () => {
    expect(getRealClientIp(undefined, '10.0.0.1')).toBe('10.0.0.1');
  });

  it('header_bos_string_iken_remoteAddress_e_duser', () => {
    expect(getRealClientIp('', '10.0.0.1')).toBe('10.0.0.1');
  });

  it('header_de_remoteAddress_de_yokken_bos_string_doner', () => {
    expect(getRealClientIp(undefined, undefined)).toBe('');
  });

  it('dizi_tipli_header_gelirse_ilk_elemani_kullanir', () => {
    // Node bazı header'ları (nadiren) dizi olarak sunabilir - savunma.
    expect(getRealClientIp(['203.0.113.5, 6.6.6.6'], '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('sadece_virgul_ve_bosluk_iceren_header_i_gecersiz_sayip_remoteAddress_e_duser', () => {
    expect(getRealClientIp('  ,  ', '10.0.0.1')).toBe('10.0.0.1');
  });
});
