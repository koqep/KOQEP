"use client";

import type { Room } from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";

// apps/api/src/db/core-rooms.constants.ts ile AYNI değer -
// MAX_MESSAGE_LENGTH/MAX_ROOM_NAME_LENGTH'in zaten kurduğu "küçük sabiti
// frontend/backend arasında kopyala" deseni (ADR-0002: web istemcisi iş
// mantığı sahibi değil). Çekirdek odalar switcher'da "ayrıl" affordance'ı
// GÖSTERMEZ - backend'in kendi ForbiddenException reddiyle simetrik.
const CORE_ROOM_NAMES = ["general", "meta"];

interface Props {
  rooms: Room[];
  activeRoom: Room | null;
  onRoomSwitch: (room: Room) => void;
  onLeaveRoom: (room: Room) => void;
  onCreateRoomClick: () => void;
  onDiscoverRoomsClick: () => void;
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

export default function RoomHeader({
  rooms,
  activeRoom,
  onRoomSwitch,
  onLeaveRoom,
  onCreateRoomClick,
  onDiscoverRoomsClick,
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
            <span key={r.id} className="flex items-center gap-1">
              <button
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
              {!CORE_ROOM_NAMES.includes(r.name) && (
                <button
                  type="button"
                  onClick={() => onLeaveRoom(r)}
                  title="odadan ayrıl"
                  className="text-muted hover:text-red-400"
                >
                  ×
                </button>
              )}
            </span>
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
          onClick={onDiscoverRoomsClick}
          className="text-muted hover:text-neutral-400"
        >
          keşfet
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