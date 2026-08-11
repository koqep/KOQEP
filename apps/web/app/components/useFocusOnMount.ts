import { useEffect, useRef } from "react";

// M6 Slice C: RoomView.tsx panelleri gerçek dialog değil (bkz. RoomView.tsx
// yorumu), bu yüzden role="dialog"/focus-trap YANLIŞ olurdu - ama panel
// açılışında odak header'daki tetikleyici butonda kalıyordu, yeni panelin
// başlığına taşınmıyordu. Bu hook mount'ta başlığa odaklanır (tabIndex=-1,
// normal Tab sırasına eklenmez).
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
