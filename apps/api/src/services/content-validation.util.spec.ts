import { hasExcessiveCombiningMarks } from './content-validation.util';

// U+0301 COMBINING ACUTE ACCENT - \u kaçış dizisiyle, dosyanın gerçek
// bayt/kodlama durumundan bağımsız kesin bir combining mark garantisi için.
const COMBINING_ACUTE = '́';

describe('hasExcessiveCombiningMarks', () => {
  it('normal_metni_gecerli_sayar', () => {
    expect(hasExcessiveCombiningMarks('merhaba dünya')).toBe(false);
  });

  it('bos_metni_gecerli_sayar', () => {
    expect(hasExcessiveCombiningMarks('')).toBe(false);
  });

  it('grapheme_basina_birkac_birlesik_isaretli_cok_dilli_metni_gecerli_sayar', () => {
    // Vietnamca/Arapça harekeleri gibi meşru kullanım - grapheme başına
    // birkaç (sınırın altında) birleşik işaret.
    const legit = 'e' + COMBINING_ACUTE.repeat(2) + ' test';
    expect(hasExcessiveCombiningMarks(legit)).toBe(false);
  });

  it('siniri_tam_karsilayan_grapheme_i_gecerli_sayar', () => {
    const boundary = 'a' + COMBINING_ACUTE.repeat(5);
    expect(hasExcessiveCombiningMarks(boundary)).toBe(false);
  });

  it('siniri_bir_asan_grapheme_i_reddeder', () => {
    const overBoundary = 'a' + COMBINING_ACUTE.repeat(6);
    expect(hasExcessiveCombiningMarks(overBoundary)).toBe(true);
  });

  it('zalgo_yiginini_reddeder', () => {
    const zalgo = 'z' + COMBINING_ACUTE.repeat(20) + ' test';
    expect(hasExcessiveCombiningMarks(zalgo)).toBe(true);
  });

  it('mesajin_ortasindaki_tek_bir_zalgo_karakterini_bile_yakalar', () => {
    const mixed =
      'normal metin ' + 'x' + COMBINING_ACUTE.repeat(15) + ' devam ediyor';
    expect(hasExcessiveCombiningMarks(mixed)).toBe(true);
  });
});
