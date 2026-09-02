import { isValidLocale } from './locale.constants';

describe('isValidLocale', () => {
  it('en_ve_tr_gecerli_sayar', () => {
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('tr')).toBe(true);
  });

  it('desteklenmeyen_bir_dil_kodunu_reddeder', () => {
    expect(isValidLocale('de')).toBe(false);
  });

  it('bos_string_i_reddeder', () => {
    expect(isValidLocale('')).toBe(false);
  });

  it('string_olmayan_degerleri_reddeder', () => {
    expect(isValidLocale(undefined)).toBe(false);
    expect(isValidLocale(null)).toBe(false);
    expect(isValidLocale(1)).toBe(false);
    expect(isValidLocale({})).toBe(false);
  });
});
