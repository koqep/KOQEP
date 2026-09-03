"use client";

import AccountMenu from "./AccountMenu";
import { interpolate, type Dictionary } from "../../lib/i18n";

interface Props {
  onOpenSidebar: () => void;
  onCreateRoomClick: () => void;
  onDiscoverRoomsClick: () => void;
  isModerator: boolean;
  openReportCount: number;
  onOpenModeration: () => void;
  username: string | null;
  onOpenProfile: (username: string) => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onLogout: () => void;
  dict: Dictionary;
}

export default function TopBar({
  onOpenSidebar,
  onCreateRoomClick,
  onDiscoverRoomsClick,
  isModerator,
  openReportCount,
  onOpenModeration,
  username,
  onOpenProfile,
  onOpenSettings,
  onOpenFeedback,
  onLogout,
  dict,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4">
      <div className="flex items-center gap-4">
        <span className="text-neutral-200">KOQEP</span>
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={dict.topBar.openRoomList}
          className="text-muted hover:text-neutral-400 md:hidden"
        >
          ☰
        </button>
        <button
          type="button"
          onClick={onCreateRoomClick}
          className="text-muted hover:text-neutral-400"
        >
          {dict.topBar.newRoom}
        </button>
        <button
          type="button"
          onClick={onDiscoverRoomsClick}
          className="text-muted hover:text-neutral-400"
        >
          {dict.topBar.explore}
        </button>
      </div>
      <div className="flex items-center gap-4">
        {isModerator && (
          <button
            type="button"
            onClick={onOpenModeration}
            className="text-muted hover:text-neutral-400"
          >
            {openReportCount > 0
              ? interpolate(dict.topBar.moderationWithCount, {
                  n: openReportCount,
                })
              : dict.topBar.moderation}
          </button>
        )}
        <AccountMenu
          username={username}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onOpenFeedback={onOpenFeedback}
          onLogout={onLogout}
          dict={dict}
        />
      </div>
    </header>
  );
}
