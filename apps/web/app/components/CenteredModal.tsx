"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap";
import type { Dictionary } from "../../lib/i18n";

// M13 Slice A: SidePanel.tsx'in devamı DEĞİL, ikisi bir arada yaşıyor -
// moderation + mobil oda listesi sağdan/soldan kayan SidePanel'de kalıyor
// (kullanıcı onayı), diğer 8 panel (new room/explore/profile/2FA/blocked/
// invites/feedback/delete account) buraya geçiyor. Odak tuzağı mantığı
// (useFocusTrap) pozisyondan bağımsız - SidePanel'le AYNI hook, DEĞİŞMEDEN.
//
// Başlık artık ŞELL'in sorumluluğu - eskiden 7 panel bileşeninin HER BİRİ
// kendi <h2 id={titleId}>...</h2> + "close" butonunu tekrarlıyordu (birebir
// aynı kod, 7 kez). Burada TEK yerde, "KOQEP · {title}" formatıyla.
export const CENTERED_MODAL_TITLE_ID = "centered-modal-title";

interface Props {
  isClosing: boolean;
  onRequestClose: () => void;
  title: string;
  children: ReactNode;
  dict: Dictionary;
}

export default function CenteredModal({
  isClosing,
  onRequestClose,
  title,
  children,
  dict,
}: Props) {
  const containerRef = useFocusTrap<HTMLDivElement>({
    onEscape: onRequestClose,
  });
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // M13 Slice B: useFocusOnMount (mount'ta BİR KEZ, [] dep) burada
  // YETERSİZ - "settings" panelinden bir alt-panele (ör. "totp") geçiş
  // AYNI CenteredModal örneğini korur (activePanel iki değer arasında
  // "none"'a hiç uğramadan değişir, bileşen unmount OLMAZ), yani mount
  // effect'i BİR DAHA ateşlenmez - odak, kaldırılan eski satırın
  // butonundan document.body'e sessizce düşerdi. `[title]`'a bağlı bu
  // effect HEM ilk mount'ta (her effect ilk render sonrası da çalışır)
  // HEM her sonraki title değişiminde (yeni bir panele geçişte) başlığa
  // odaklanıyor - tek effect, iki durumu da kapsıyor.
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  // document.body'e portal - SidePanel.tsx'teki AYNI containing-block
  // gerekçesi (RoomView.tsx'in <main>'i animate-fade-in taşıyor, bkz.
  // STATE.md Tuzaklar) burada da geçerli.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onRequestClose}
        className={
          "absolute inset-0 bg-black/80 " +
          (isClosing ? "animate-panel-backdrop-out" : "animate-panel-backdrop-in")
        }
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={CENTERED_MODAL_TITLE_ID}
        className={
          "relative flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto border border-neutral-800 bg-neutral-950 p-4 " +
          (isClosing ? "animate-modal-out" : "animate-modal-in")
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            ref={headingRef}
            id={CENTERED_MODAL_TITLE_ID}
            tabIndex={-1}
            className="text-neutral-200 outline-none"
          >
            KOQEP · {title}
          </h2>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label={dict.centeredModal.close}
            className="text-muted hover:text-neutral-400"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
