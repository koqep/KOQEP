import { useEffect, useRef } from "react";

interface Options {
  isOpen: boolean;
  onClose: () => void;
}

// M10 Faz 2 Slice B: AccountMenu için - useFocusTrap.ts'in "elle yazıldı,
// yeni bağımlılık yok" deseninin devamı, ama daha hafif: tam Tab-döngüsü
// YOK (proje hiçbir yerde ok-tuşu/roving-tabindex navigasyonu kullanmıyor,
// YAGNI) - sadece dışa-tıklama ve Escape ile kapatma. Dönen ref HEM
// tetikleyici butonu HEM menüyü sarmalamalı (trigger'a tıklamak "dışarı
// tıklama" sayılmasın, çifte-toggle bug'ı).
export function useDismissableMenu<T extends HTMLElement>({
  isOpen,
  onClose,
}: Options) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return containerRef;
}
