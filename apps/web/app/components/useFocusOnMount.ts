import { useEffect, useRef } from "react";

// M6 Slice C'de yazıldı: panel açılışında odak header'daki tetikleyici
// butonda kalıyordu, yeni panelin başlığına taşınmıyordu. Bu hook mount'ta
// başlığa odaklanır (tabIndex=-1, normal Tab sırasına eklenmez).
// M10 Faz 2 Slice A güncellemesi: panel artık GERÇEKTEN bir overlay/dialog
// (role="dialog", bkz. SidePanel.tsx) - bu hook'un sorumluluğu (başlığa
// odaklan) değişmedi, sadece artık AYRI bir useFocusTrap ile birlikte
// çalışıyor (Tab-döngüsü/Escape/odak-geri-yükleme orada).
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
