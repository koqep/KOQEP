import { getRealClientIp } from './client-ip.util';

describe('getRealClientIp', () => {
  it('gercek_production_zincirini_dogru_cozer_cf_connecting_ip_olmadan', () => {
    // Founder'ın gerçek doğrulama log'u (2026-08-22): sahte 6.6.6.6, gerçek
    // istemci, Cloudflare edge (172.64.0.0/13 aralığında), Render'ın kendi
    // iç hop'u (10.x, private).
    const xff = '6.6.6.6,31.223.127.167, 172.69.182.182, 10.199.135.225';
    expect(getRealClientIp(xff, undefined, '10.0.0.1')).toBe('31.223.127.167');
  });

  it('gercek_production_zincirini_dogru_cozer_cf_connecting_ip_ile', () => {
    const xff = '6.6.6.6,31.223.127.167, 172.69.182.182, 10.199.135.225';
    // CF-Connecting-IP mevcutken Cloudflare hop'una ULAŞILDIĞI AN o tercih
    // edilir - Cloudflare'in kendi iç hop sayısından bağımsız daha sağlam
    // bir kaynak.
    expect(getRealClientIp(xff, '31.223.127.167', '10.0.0.1')).toBe(
      '31.223.127.167',
    );
  });

  // Kullanıcının doğrudan sorduğu güvenlik sorusunun kanıtı: saldırgan
  // *.onrender.com'a DOĞRUDAN bağlanıp (Cloudflare'i atlayıp) kendi isteğine
  // Cloudflare'inkine BENZEYEN uydurma bir IP ekleyebilir - ama Render'ın
  // LB'si saldırganın GERÇEK peer'ını (spoof edilemez) SONA ekliyor. Sahte
  // "Cloudflare'e benzeyen" girdi asla okunmuyor çünkü algoritma SAĞDAN
  // başlayıp ilk güvenilmeyen girdide DURUYOR.
  it('saldirganin_baina_ekledigi_sahte_cloudflare_benzeri_ipi_yok_sayar', () => {
    const attackerRealIp = '198.51.100.7';
    const fakeCloudflareLooking = '172.65.1.1'; // gerçekten CF aralığında ama SAHTE - saldırgan yazdı
    const xff = `${fakeCloudflareLooking}, ${attackerRealIp}, 10.199.135.225`;
    // Render'ın LB'si saldırganın GERÇEK IP'sini (attackerRealIp) sona
    // eklemiş - CF-Connecting-IP YOK çünkü gerçekten Cloudflare'den geçmedi.
    expect(getRealClientIp(xff, undefined, '10.0.0.1')).toBe(attackerRealIp);
  });

  it('sadece_render_tek_hop_varken_dogrudan_girdiyi_dondurur', () => {
    // Cloudflare hiç yok (varsayımsal senaryo) - tek hop.
    expect(getRealClientIp('203.0.113.5', undefined, '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('render_in_kendi_ic_hopu_atlanip_bir_onceki_gercek_ip_dondurulur', () => {
    expect(
      getRealClientIp('203.0.113.5, 10.1.2.3', undefined, '10.0.0.1'),
    ).toBe('203.0.113.5');
  });

  it('zincir_tamamen_private_range_lerdense_remoteAddress_e_duser', () => {
    expect(
      getRealClientIp('10.1.2.3, 192.168.0.5', undefined, '10.0.0.1'),
    ).toBe('10.0.0.1');
  });

  it('bastaki_sondaki_bosluklari_temizler', () => {
    expect(
      getRealClientIp('  203.0.113.5  ,  10.1.2.3  ', undefined, '10.0.0.1'),
    ).toBe('203.0.113.5');
  });

  it('header_yokken_remoteAddress_e_duser', () => {
    expect(getRealClientIp(undefined, undefined, '10.0.0.1')).toBe('10.0.0.1');
  });

  it('header_bos_string_iken_remoteAddress_e_duser', () => {
    expect(getRealClientIp('', undefined, '10.0.0.1')).toBe('10.0.0.1');
  });

  it('header_de_remoteAddress_de_yokken_bos_string_doner', () => {
    expect(getRealClientIp(undefined, undefined, undefined)).toBe('');
  });

  it('dizi_tipli_header_gelirse_ilk_elemani_kullanir', () => {
    expect(
      getRealClientIp(['203.0.113.5, 10.1.2.3'], undefined, '10.0.0.1'),
    ).toBe('203.0.113.5');
  });

  it('dizi_tipli_cf_connecting_ip_gelirse_ilk_elemani_kullanir', () => {
    const xff = '31.223.127.167, 172.69.182.182, 10.199.135.225';
    expect(getRealClientIp(xff, ['31.223.127.167'], '10.0.0.1')).toBe(
      '31.223.127.167',
    );
  });

  it('sadece_virgul_ve_bosluk_iceren_header_i_gecersiz_sayip_remoteAddress_e_duser', () => {
    expect(getRealClientIp('  ,  ', undefined, '10.0.0.1')).toBe('10.0.0.1');
  });

  // IPv6: hata FIRLATMIYOR, sadece Cloudflare/private aralığında
  // tanınmadığı için "güvenilmeyen" (döndürülecek aday) sayılıyor -
  // CF-Connecting-IP varsa doğru sonuç, yoksa Cloudflare'in kendi IPv6
  // edge'i yanlışlıkla döndürülebilir (veri-kalitesi sınırı, çökme değil).
  it('ipv6_girdiyi_hata_firlatmadan_isler', () => {
    const xff = '2001:db8::1, 172.69.182.182, 10.199.135.225';
    expect(() => getRealClientIp(xff, undefined, '10.0.0.1')).not.toThrow();
  });

  it('cf_connecting_ip_varken_ipv6_istemci_dogru_cozulur', () => {
    const clientIpv6 = '2001:db8::1';
    const xff = `${clientIpv6}, 172.69.182.182, 10.199.135.225`;
    expect(getRealClientIp(xff, clientIpv6, '10.0.0.1')).toBe(clientIpv6);
  });
});
