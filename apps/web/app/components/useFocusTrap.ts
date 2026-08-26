import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  onEscape: () => void;
}

// M10 Faz 2 Slice A: SidePanel gerçek bir overlay olduğu için (arka plan
// inert), Tab'ın panelin dışına kaçmaması ve Escape'in kapatması gerekiyor -
// yeni bir bağımlılık eklemeden (react-focus-lock vb. projede hiç yok) elle
// yazıldı. useFocusOnMount'tan AYRI bir sorumluluk - o başlığa odaklanmayı
// yönetiyor, bu container'ın kendisine bağlanıp Tab-döngüsünü kapatıyor.
export function useFocusTrap<T extends HTMLElement>({ onEscape }: Options) {
  const containerRef = useRef<T | null>(null);
  // RENDER SIRASINDA okunuyor (bir effect İÇİNDE DEĞİL) - React child
  // component'lerin effect'lerini PARENT'ınkinden ÖNCE çalıştırıyor
  // (mount'ta alttan-yukarı). SidePanel'in kendi effect'i mount'ta
  // çalıştığında, İÇİNDEKİ panel bileşeninin useFocusOnMount'u ZATEN
  // kendi başlığına odaklanmış oluyor - document.activeElement'i orada
  // okumak yanlış elemanı (paneldeki başlık) yakalardı. Render anı BÜTÜN
  // effect'lerden (child dahil) önce geldiği için doğru eleman (panel
  // açılmadan ÖNCE odaklı olan tetikleyici buton) burada yakalanıyor.
  const previouslyFocusedRef = useRef<HTMLElement | null>(
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null,
  );
  // onEscape her render'da yeni bir fonksiyon referansı olabilir
  // (requestClosePanel useCallback'siz) - effect'i mount/unmount'a
  // sabitleyip (boş dep dizisi) en güncel değeri bu ref üzerinden okumak,
  // hem bayat kapanış mantığından hem gereksiz listener yeniden-bağlamadan
  // kaçınıyor. Ref'e render SIRASINDA değil (React'in yeni ref-safety kuralı
  // bunu yasaklıyor), ayrı bir effect'te yazılıyor.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    // Cleanup'ta ref.current'ı DOĞRUDAN okumak yerine (unmount'a kadar
    // değişebilir), mount anındaki değeri yerel bir değişkende sabitliyoruz.
    const elementToRestore = previouslyFocusedRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      elementToRestore?.focus();
    };
  }, []);

  return containerRef;
}
