"use client";

import type { Room } from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";

// apps/api/src/db/core-rooms.constants.ts ile AYNI değer -
// MAX_MESSAGE_LENGTH/MAX_ROOM_NAME_LENGTH'in zaten kurduğu "küçük sabiti
// frontend/backend arasında kopyala" deseni (ADR-0002: web istemcisi iş
// mantığı sahibi değil). Çekirdek odalar switcher'da "ayrıl" affordance'ı
// GÖSTERMEZ - backend'in kendi ForbiddenException reddiyle simetrik.
const CORE_ROOM_NAMES = ["general", "meta"];

// M7b Slice H2: kişisel gelen kutusu, kurumsal bir adres değil (bilerek
// kabul edilen kısıt, docs/BACKLOG.md'de somut bir tetikleyiciyle not
// düşülü) - kurumsal bir adrese (ör. support@koqep.com) geçiş bu TEK
// satırın değişmesinden ibaret olsun diye ayrı bir sabitte yaşıyor.
const FEEDBACK_EMAIL = "ussasa155@gmail.com";

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
                  `last active: ${formatRelativeActivity(r.lastActivityAt)}`
                }
                className={
                  r.id === activeRoom?.id
                    ? "text-neutral-200"
                    : "text-muted hover:text-neutral-400"
                }
              >
                <span className="text-muted">#</span>
                {r.name}
                {r.status !== "active" && " (archived)"}
              </button>
              {!CORE_ROOM_NAMES.includes(r.name) && (
                <button
                  type="button"
                  onClick={() => onLeaveRoom(r)}
                  title="leave room"
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
          + new room
        </button>
        <button
          type="button"
          onClick={onDiscoverRoomsClick}
          className="text-muted hover:text-neutral-400"
        >
          discover
        </button>
        <button
          type="button"
          onClick={onToggleShowArchived}
          className="text-muted hover:text-neutral-400"
        >
          {showArchived ? "hide archived" : "show archived"}
        </button>
      </nav>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onOpenTotp}
          className="text-muted hover:text-neutral-400"
        >
          two-factor authentication
        </button>
        <button
          type="button"
          onClick={onOpenBlocked}
          className="text-muted hover:text-neutral-400"
        >
          blocked
        </button>
        <button
          type="button"
          onClick={onOpenInvites}
          className="text-muted hover:text-neutral-400"
        >
          invites
        </button>
        <a
          href={`mailto:${FEEDBACK_EMAIL}?subject=KOQEP%20feedback`}
          className="text-muted hover:text-neutral-400"
        >
          feedback
        </a>
        {isModerator && (
          <button
            type="button"
            onClick={onOpenModeration}
            className="text-muted hover:text-neutral-400"
          >
            moderation
          </button>
        )}
        <button
          type="button"
          onClick={onOpenDeleteAccount}
          className="text-muted hover:text-red-400"
        >
          delete account
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="text-muted hover:text-neutral-400"
        >
          log out
        </button>
      </div>
    </header>
  );
}