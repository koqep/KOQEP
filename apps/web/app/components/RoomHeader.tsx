"use client";

import type { Room } from "../../lib/api";

interface Props {
  rooms: Room[];
  activeRoom: Room | null;
  onRoomSwitch: (room: Room) => void;
  onCreateRoomClick: () => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
  onOpenTotp: () => void;
  onOpenBlocked: () => void;
  onOpenInvites: () => void;
  onOpenDeleteAccount: () => void;
  onLogout: () => void;
  isModerator: boolean;
  onOpenModeration: () => void;
}

// Odanın son ne zaman aktif olduğunu kabaca gösteriyor - tam bir "keşfet"
// görünümü (sıralama/filtreleme) bilerek kapsam dışı, sadece switcher'ın
// title tooltip'inde ucuz bir canlılık sinyali (M3 kapsam gözden geçirmesi,
// 2. tur, madde 2).
function formatRelativeActivity(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return "az önce";
  if (diffMinutes < 60) return `${diffMinutes}dk önce`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}s önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}g önce`;
}

export default function RoomHeader({
  rooms,
  activeRoom,
  onRoomSwitch,
  onCreateRoomClick,
  showArchived,
  onToggleShowArchived,
  onOpenTotp,
  onOpenBlocked,
  onOpenInvites,
  onOpenDeleteAccount,
  onLogout,
  isModerator,
  onOpenModeration,
}: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-neutral-800 pb-2">
      <nav className="flex flex-wrap items-center gap-3">
        {rooms.length === 0 ? (
          <span className="text-neutral-400">
            <span className="text-muted">#</span>...
          </span>
        ) : (
          rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRoomSwitch(r)}
              title={
                (r.description ? `${r.description} — ` : "") +
                `son aktivite: ${formatRelativeActivity(r.lastActivityAt)}`
              }
              className={
                r.id === activeRoom?.id
                  ? "text-neutral-200"
                  : "text-muted hover:text-neutral-400"
              }
            >
              <span className="text-muted">#</span>
              {r.name}
              {r.status !== "active" && " (arşiv)"}
            </button>
          ))
        )}
        <button
          type="button"
          onClick={onCreateRoomClick}
          className="text-muted hover:text-neutral-400"
        >
          + yeni oda
        </button>
        <button
          type="button"
          onClick={onToggleShowArchived}
          className="text-muted hover:text-neutral-400"
        >
          {showArchived ? "arşivi gizle" : "arşivi göster"}
        </button>
      </nav>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onOpenTotp}
          className="text-muted hover:text-neutral-400"
        >
          iki adımlı doğrulama
        </button>
        <button
          type="button"
          onClick={onOpenBlocked}
          className="text-muted hover:text-neutral-400"
        >
          engellenenler
        </button>
        <button
          type="button"
          onClick={onOpenInvites}
          className="text-muted hover:text-neutral-400"
        >
          invites
        </button>
        {isModerator && (
          <button
            type="button"
            onClick={onOpenModeration}
            className="text-muted hover:text-neutral-400"
          >
            moderasyon
          </button>
        )}
        <button
          type="button"
          onClick={onOpenDeleteAccount}
          className="text-muted hover:text-red-400"
        >
          hesabı sil
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="text-muted hover:text-neutral-400"
        >
          çıkış
        </button>
      </div>
    </header>
  );
}