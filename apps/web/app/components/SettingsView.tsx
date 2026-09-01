"use client";

// M13 Slice B: AccountMenu'nün eski 4 ayrı öğesi (two-factor
// authentication/blocked/invites/delete account) artık bu tek "settings"
// panelinin içinde bir gezinme listesi - satırlar BİLEREK role="menuitem"
// DEĞİL düz <button> (menuitem bir role="menu" konteynerinin dışında
// geçersiz ARIA olurdu, bu panel role="dialog"). Tıklanınca activePanel
// DOĞRUDAN hedef panele geçiyor (RoomView.tsx), "geri" butonu YOK -
// kullanıcı kararı, her panel kendi ✕'iyle tamamen kapanıyor.
interface Props {
  onNavigate: (panel: "totp" | "blocked" | "invites" | "delete-account") => void;
}

const settingsItemClassName =
  "px-2 py-1 text-left text-muted hover:text-neutral-400";

export default function SettingsView({ onNavigate }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onNavigate("totp")}
        className={settingsItemClassName}
      >
        two-factor authentication
      </button>
      <button
        type="button"
        onClick={() => onNavigate("blocked")}
        className={settingsItemClassName}
      >
        blocked
      </button>
      <button
        type="button"
        onClick={() => onNavigate("invites")}
        className={settingsItemClassName}
      >
        invites
      </button>
      <button
        type="button"
        onClick={() => onNavigate("delete-account")}
        className="px-2 py-1 text-left text-muted hover:text-red-400"
      >
        delete account
      </button>
    </div>
  );
}
