"use client";

import { useState } from "react";
import type { Room } from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";
import { inputClassName } from "./formStyles";
import { useFocusOnMount } from "./useFocusOnMount";
import { interpolate, type Dictionary, type Locale } from "../../lib/i18n";

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
  // M9 Slice D5: dosyanın TÜM metinleri artık `dict`'e bağlı - D1'in
  // BİLEREK dar tuttuğu (sadece formatRelativeActivity için) `locale`
  // prop'u D2+'ın işiydi, bu dilimle tamamlandı. `locale` AYRICA
  // korunuyor - formatRelativeActivity'nin kendisi `Locale`, `dict`
  // DEĞİL istiyor.
  dict: Dictionary;
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
  dict,
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
            <span className="text-muted">#</span> {dict.roomSidebar.heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-neutral-400"
          >
            {dict.roomSidebar.close}
          </button>
        </div>
      )}

      <input
        type="text"
        aria-label={dict.roomSidebar.searchAriaLabel}
        placeholder={dict.roomSidebar.searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`mb-2 w-full ${inputClassName}`}
      />
      <button
        type="button"
        onClick={onToggleShowArchived}
        className="mb-3 self-start text-muted hover:text-neutral-400"
      >
        {showArchived ? dict.roomSidebar.hideArchived : dict.roomSidebar.showArchived}
      </button>

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <li className="text-muted">
            <span className="text-muted">#</span>...
          </li>
        ) : filtered.length === 0 ? (
          <li className="text-muted">{dict.roomSidebar.noRoomsMatch}</li>
        ) : (
          filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onRoomSwitch(r)}
                title={
                  (r.description ? `${r.description} — ` : "") +
                  interpolate(dict.common.lastActive, {
                    relative: formatRelativeActivity(r.lastActivityAt, locale),
                  })
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
                {r.status !== "active" && ` ${dict.roomSidebar.archivedSuffix}`}
              </button>
              {!CORE_ROOM_NAMES.includes(r.name) && (
                <button
                  type="button"
                  onClick={() => onLeaveRoom(r)}
                  title={dict.roomSidebar.leaveRoomTitle}
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
