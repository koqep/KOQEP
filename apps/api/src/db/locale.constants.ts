// M9 Slice A: sözlük altyapısının iskeleti (2026-09-02 kapsam turu
// kararı, docs/milestones/M9-i18n.md) - hiçbir controller/servise
// BAĞLANMIYOR. `User.locale` + JWT payload'ına eklenmesi Slice B'nin
// işi (bu alanın kaynağı olmadan JWT'ye eklenecek gerçek bir değer yok).

export type Locale = 'en' | 'tr';
export const DEFAULT_LOCALE: Locale = 'en';

export function isValidLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'tr';
}
