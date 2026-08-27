"use client";

import AccountMenu from "./AccountMenu";

interface Props {
  onOpenSidebar: () => void;
  onCreateRoomClick: () => void;
  onDiscoverRoomsClick: () => void;
  isModerator: boolean;
  openReportCount: number;
  onOpenModeration: () => void;
  username: string | null;
  onOpenProfile: (username: string) => void;
  onOpenTotp: () => void;
  onOpenBlocked: () => void;
  onOpenInvites: () => void;
  onOpenDeleteAccount: () => void;
  onLogout: () => void;
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
  onOpenTotp,
  onOpenBlocked,
  onOpenInvites,
  onOpenDeleteAccount,
  onLogout,
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4">
      <div className="flex items-center gap-4">
        <span className="text-neutral-200">KOQEP</span>
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="open room list"
          className="text-muted hover:text-neutral-400 md:hidden"
        >
          ☰
        </button>
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
          explore
        </button>
      </div>
      <div className="flex items-center gap-4">
        {isModerator && (
          <button
            type="button"
            onClick={onOpenModeration}
            className="text-muted hover:text-neutral-400"
          >
            moderation{openReportCount > 0 ? ` [${openReportCount}]` : ""}
          </button>
        )}
        <AccountMenu
          username={username}
          onOpenProfile={onOpenProfile}
          onOpenTotp={onOpenTotp}
          onOpenBlocked={onOpenBlocked}
          onOpenInvites={onOpenInvites}
          onOpenDeleteAccount={onOpenDeleteAccount}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
