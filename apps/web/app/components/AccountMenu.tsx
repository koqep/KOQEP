"use client";

import { useRef, useState } from "react";
import { FEEDBACK_EMAIL } from "../../lib/contact";
import { SmallAvatar } from "./Avatar";
import { useDismissableMenu } from "./useDismissableMenu";

interface Props {
  username: string | null;
  onOpenProfile: (username: string) => void;
  onOpenTotp: () => void;
  onOpenBlocked: () => void;
  onOpenInvites: () => void;
  onOpenDeleteAccount: () => void;
  onLogout: () => void;
}

const menuItemClassName =
  "px-2 py-1 text-left text-muted hover:text-neutral-400";

export default function AccountMenu({
  username,
  onOpenProfile,
  onOpenTotp,
  onOpenBlocked,
  onOpenInvites,
  onOpenDeleteAccount,
  onLogout,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  const containerRef = useDismissableMenu<HTMLDivElement>({
    isOpen,
    onClose: close,
  });

  // Odağı ÖNCE tetikleyici butona geri veriyoruz (senkron, DOM'a doğrudan) -
  // action() bir panel açıyorsa (setActivePanel), SidePanel'in useFocusTrap'i
  // document.activeElement'i KENDİ render'ı sırasında yakalıyor (M10 Faz 2
  // Slice A). Sıra ÖNEMLİ: önce triggerRef'e odaklanmazsak, o anki
  // document.activeElement bu tıklanan menuitem olurdu - menü kapanınca o
  // eleman DOM'dan TAMAMEN kalkıyor, panel Escape'le kapandığında ".focus()"
  // artık var olmayan bir elemana boşa giderdi (odak hiçbir yere dönmezdi).
  function select(action: () => void) {
    triggerRef.current?.focus();
    setIsOpen(false);
    action();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="text-muted hover:text-neutral-400"
      >
        <SmallAvatar seed={username} className="align-middle" /> account{" "}
        <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="account"
          className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col gap-1 border border-neutral-800 bg-neutral-950 p-2"
        >
          {/* M10 Faz 2 Slice D+E: myProfile async yükleniyor ama TopBar/
              AccountMenu Slice A'dan beri her zaman mount'lu - ilk boyamada
              username null olabilir. "disabled" state icat etmek yerine o
              an menü öğesini hiç göstermiyoruz (en basit güvenli çözüm). */}
          {username && (
            <button
              role="menuitem"
              type="button"
              onClick={() => select(() => onOpenProfile(username))}
              className={menuItemClassName}
            >
              profile
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => select(onOpenTotp)}
            className={menuItemClassName}
          >
            two-factor authentication
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => select(onOpenBlocked)}
            className={menuItemClassName}
          >
            blocked
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => select(onOpenInvites)}
            className={menuItemClassName}
          >
            invites
          </button>
          <a
            role="menuitem"
            href={`mailto:${FEEDBACK_EMAIL}?subject=KOQEP%20feedback`}
            onClick={() => setIsOpen(false)}
            className={menuItemClassName}
          >
            feedback
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => select(onOpenDeleteAccount)}
            className="px-2 py-1 text-left text-muted hover:text-red-400"
          >
            delete account
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => select(onLogout)}
            className={menuItemClassName}
          >
            log out
          </button>
        </div>
      )}
    </div>
  );
}
