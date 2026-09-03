"use client";

import { useState } from "react";
import type { Room } from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";
import { inputClassName } from "./formStyles";
import { useFocusOnMount } from "./useFocusOnMount";
import type { Locale } from "../../lib/i18n";

// apps/api/src/db/core-rooms.constants.ts ile AYNI değer - RoomHeader.tsx'in
// eski taşıdığı sabit, M10 Faz 2 Slice B'de buraya taşındı (tek kullanıcı).
const CORE_ROOM_NAMES = ["general", "meta"];

interface Props {
  rooms: Room[];
  activeRoom: Room | null;
  onRoomSwitch: (room: Room) => void;
  onLeaveRoom: (room: Room) => void;
  showArchived: boolean;
  onToggleShowArchived: () => void;
  // Sadece mobil overlay içinde (SidePanel'in children'ı olarak) geçilir -
  // masaüstü sabit <aside> içinde bunlar hiç render edilmez (başlık/kapat
  // butonu gerekmiyor, panel zaten kalıcı görünür).
  titleId?: string;
  onClose?: () => void;
  // M9 Slice D1: dosyanın KENDİ diğer metinleri (arama placeholder'ı,
  // "no rooms match" vb.) bu dilimde taşınmadı - SADECE
  // formatRelativeActivity'nin "son aktivite" satırı için dar bir prop,
  // TAM `dict` değil (D2+'a kadar bilerek).
  locale: Locale;
}

export default function RoomSidebar({
  rooms,
  activeRoom,
  onRoomSwitch,
  onLeaveRoom,
  showArchived,
  onToggleShowArchived,
  titleId,
  onClose,
  locale,
}: Props) {
  const [query, setQuery] = useState("");
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  const sorted = [...rooms].sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
  const filtered = sorted.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      {onClose && (
        <div className="mb-4 flex items-center justify-between">
          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="text-neutral-400 outline-none"
          >
            <span className="text-muted">#</span> rooms
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-neutral-400"
          >
            close
          </button>
        </div>
      )}

      <input
        type="text"
        aria-label="search rooms"
        placeholder="search rooms..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`mb-2 w-full ${inputClassName}`}
      />
      <button
        type="button"
        onClick={onToggleShowArchived}
        className="mb-3 self-start text-muted hover:text-neutral-400"
      >
        {showArchived ? "hide archived" : "show archived"}
      </button>

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <li className="text-muted">
            <span className="text-muted">#</span>...
          </li>
        ) : filtered.length === 0 ? (
          <li className="text-muted">no rooms match</li>
        ) : (
          filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onRoomSwitch(r)}
                title={
                  (r.description ? `${r.description} — ` : "") +
                  `last active: ${formatRelativeActivity(r.lastActivityAt, locale)}`
                }
                className={
                  "flex-1 truncate border-l-2 py-1 pl-2 text-left " +
                  (r.id === activeRoom?.id
                    ? "border-neutral-200 text-neutral-200"
                    : "border-transparent text-muted hover:border-neutral-700 hover:text-neutral-400") +
                  (r.status !== "active" ? " opacity-60" : "")
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
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
