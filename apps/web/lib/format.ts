// M7b Slice E: RoomHeader.tsx'in switcher tooltip'i için yazılmıştı, artık
// DiscoverRoomsView.tsx da "son aktivite" gösterimi için kullanıyor -
// projenin "sadece ikinci çağıran çıkınca paylaşılan dosyaya çıkar" kuralı.
export function formatRelativeActivity(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
