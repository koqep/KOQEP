import { getAllowedOrigins } from './allowed-origins';

describe('getAllowedOrigins', () => {
  it('www_siz_bir_origine_www_karsiligini_ekler', () => {
    expect(getAllowedOrigins('https://koqep.com')).toEqual([
      'https://koqep.com',
      'https://www.koqep.com',
    ]);
  });

  it('www_li_bir_origine_www_siz_karsiligini_ekler', () => {
    expect(getAllowedOrigins('https://www.koqep.com')).toEqual([
      'https://www.koqep.com',
      'https://koqep.com',
    ]);
  });

  it('portlu_bir_origini_de_dogru_isler', () => {
    expect(getAllowedOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
      'http://www.localhost:3000',
    ]);
  });

  it('tanimsiz_env_icin_undefined_doner_eski_davranisi_bozmaz', () => {
    expect(getAllowedOrigins(undefined)).toBeUndefined();
  });

  it('bos_string_icin_undefined_doner', () => {
    expect(getAllowedOrigins('')).toBeUndefined();
  });
});
