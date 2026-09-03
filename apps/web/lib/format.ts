import { DEFAULT_LOCALE, type Locale } from "./i18n";

// M7b Slice E: RoomHeader.tsx'in switcher tooltip'i için yazılmıştı, artık
// DiscoverRoomsView.tsx da "son aktivite" gösterimi için kullanıyor -
// projenin "sadece ikinci çağıran çıkınca paylaşılan dosyaya çıkar" kuralı.
// M9 Slice D1: `locale` OPSİYONEL, varsayılan DEFAULT_LOCALE - imza GERİYE
// UYUMLU (DiscoverRoomsView.tsx bu parametreyi henüz GEÇMİYOR, D2+'ın işi;
// RoomSidebar.tsx D1'de gerçek locale'i geçen TEK çağıran).
export function formatRelativeActivity(
  isoDate: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (locale === "tr") {
    if (diffMinutes < 1) return "az önce";
    if (diffMinutes < 60) return `${diffMinutes}dk önce`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}sa önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}g önce`;
  }
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
