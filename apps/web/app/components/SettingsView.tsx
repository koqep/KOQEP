"use client";

import type { Dictionary } from "../../lib/i18n";

// M13 Slice B: AccountMenu'nün eski 4 ayrı öğesi (two-factor
// authentication/blocked/invites/delete account) artık bu tek "settings"
// panelinin içinde bir gezinme listesi - satırlar BİLEREK role="menuitem"
// DEĞİL düz <button> (menuitem bir role="menu" konteynerinin dışında
// geçersiz ARIA olurdu, bu panel role="dialog"). Tıklanınca activePanel
// DOĞRUDAN hedef panele geçiyor (RoomView.tsx), "geri" butonu YOK -
// kullanıcı kararı, her panel kendi ✕'iyle tamamen kapanıyor.
// M9 Slice D1: "language" satırı eklendi - metinler artık dict'ten
// (RoomView.tsx'in türettiği), diğer panellerin İÇERİĞİ henüz taşınmadı.
interface Props {
  onNavigate: (
    panel: "totp" | "blocked" | "invites" | "delete-account" | "language",
  ) => void;
  dict: Dictionary;
}

const settingsItemClassName =
  "px-2 py-1 text-left text-muted hover:text-neutral-400";

export default function SettingsView({ onNavigate, dict }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onNavigate("totp")}
        className={settingsItemClassName}
      >
        {dict.settings.twoFactorAuthentication}
      </button>
      <button
        type="button"
        onClick={() => onNavigate("blocked")}
        className={settingsItemClassName}
      >
        {dict.settings.blocked}
      </button>
      <button
        type="button"
        onClick={() => onNavigate("invites")}
        className={settingsItemClassName}
      >
        {dict.settings.invites}
      </button>
      <button
        type="button"
        onClick={() => onNavigate("language")}
        className={settingsItemClassName}
      >
        {dict.settings.language}
      </button>
      <button
        type="button"
        onClick={() => onNavigate("delete-account")}
        className="px-2 py-1 text-left text-muted hover:text-red-400"
      >
        {dict.settings.deleteAccount}
      </button>
    </div>
  );
}
