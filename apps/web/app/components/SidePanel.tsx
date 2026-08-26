"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./useFocusTrap";

// M10 Faz 2 Slice A: panel union type (RoomView.tsx'in activePanel'i) zaten
// TEKİL - aynı anda iki panel açık olamaz, panele-özel dinamik id gerekmiyor.
export const SIDE_PANEL_TITLE_ID = "side-panel-title";

interface Props {
  isClosing: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

export default function SidePanel({
  isClosing,
  onRequestClose,
  children,
}: Props) {
  const containerRef = useFocusTrap<HTMLDivElement>({
    onEscape: onRequestClose,
  });

  // document.body'e portal'lanıyor - RoomView.tsx'in <main>'i animate-fade-in
  // (bir transform animasyonu) taşıyor, fill-mode:both yüzünden animasyon
  // bittikten SONRA bile transform:translateY(0) kalıcı kalıyor. CSS
  // spec'ine göre `none` DIŞINDA herhangi bir transform değeri, o elemanı
  // position:fixed torunları için bir containing block yapar - <main>'in
  // İÇİNDE fixed bir panel viewport'a değil <main>'in kendi kutusuna göre
  // konumlanırdı (gerçekten böyle davrandığı Playwright'la KANITLANDI).
  // Portal bu sorunu DOM ağacındaki HERHANGİ bir gelecekteki transform/
  // filter'dan bağımsız olarak kalıcı şekilde çözüyor.
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        aria-hidden="true"
        onClick={onRequestClose}
        className={
          "absolute inset-0 bg-black/60 " +
          (isClosing ? "animate-panel-backdrop-out" : "animate-panel-backdrop-in")
        }
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={SIDE_PANEL_TITLE_ID}
        className={
          "relative flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-950 p-4 " +
          (isClosing ? "animate-panel-slide-out" : "animate-panel-slide-in")
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
