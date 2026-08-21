"use client";

import { type FormEvent, type RefObject } from "react";
import MessageItem from "./MessageItem";
import MessageContent from "./MessageContent";
import type { Room, UserProfile, MessageEdit } from "../../lib/api";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
  editedAt: string | null;
}

interface Props {
  messagesSectionRef: RefObject<HTMLElement | null>;
  messages: Message[];
  myProfile: UserProfile | null;
  isMuted: boolean;
  mutedUntil: string | null;
  muteReason: string | null;
  onMessageEditSubmit: (messageId: string, content: string) => void;
  onMessageDeleteSubmit: (messageId: string) => void;
  fetchHistoryForMessage: (messageId: string) => Promise<MessageEdit[]>;
  onReportMessage: (messageId: string) => Promise<void>;
  nextCursor: string | null;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  sendError: string | null;
  contentRemovedNotice: string | null;
  onDismissContentRemovedNotice: () => void;
  activeRoom: Room | null;
  draft: string;
  onDraftChange: (value: string) => void;
  isReady: boolean;
  canSend: boolean;
  isSending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function ChatPanel({
  messagesSectionRef,
  messages,
  myProfile,
  isMuted,
  mutedUntil,
  muteReason,
  onMessageEditSubmit,
  onMessageDeleteSubmit,
  fetchHistoryForMessage,
  onReportMessage,
  nextCursor,
  isLoadingOlder,
  onLoadOlder,
  sendError,
  contentRemovedNotice,
  onDismissContentRemovedNotice,
  activeRoom,
  draft,
  onDraftChange,
  isReady,
  canSend,
  isSending,
  onSubmit,
}: Props) {
  return (
    <>
      {activeRoom?.announcement && (
        <p className="border-b border-neutral-800 pb-2 text-neutral-300">
          <span className="text-muted">duyuru:</span>{" "}
          <MessageContent content={activeRoom.announcement} />
        </p>
      )}
      <section
        ref={messagesSectionRef}
        className="flex-1 overflow-y-auto py-4 text-muted"
      >
        {nextCursor && (
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={isLoadingOlder}
            className="mb-2 text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
          >
            {isLoadingOlder ? "yükleniyor..." : "daha eski mesajları yükle"}
          </button>
        )}
        {messages.length === 0 ? (
          <p>
            {activeRoom
              ? `#${activeRoom.name} henüz sessiz — ilk mesajı sen yaz`
              : "henüz mesaj yok"}
          </p>
        ) : (
          <ul className="space-y-1">
            {messages.map((message) => {
              const isMine =
                message.authorUsername !== null &&
                message.authorUsername === myProfile?.username;
              const canViewHistory = isMine || myProfile?.role === "moderator";
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isMine={isMine}
                  isMuted={isMuted}
                  canViewHistory={canViewHistory}
                  onSubmitEdit={onMessageEditSubmit}
                  onSubmitDelete={onMessageDeleteSubmit}
                  fetchHistory={fetchHistoryForMessage}
                  onReport={onReportMessage}
                />
              );
            })}
          </ul>
        )}
      </section>

      {sendError && <p className="text-red-400">{sendError}</p>}
      {contentRemovedNotice && (
        <p className="flex items-center gap-2 text-red-400">
          <span>
            bir mesajın moderatör tarafından kaldırıldı — {contentRemovedNotice}
          </span>
          <button
            type="button"
            onClick={onDismissContentRemovedNotice}
            className="text-muted hover:text-neutral-400"
          >
            tamam
          </button>
        </p>
      )}
      {activeRoom && activeRoom.status !== "active" ? (
        <p className="border-t border-neutral-800 pt-2 text-muted">
          bu oda arşivlenmiş, sadece okunabilir
        </p>
      ) : isMuted ? (
        <p className="border-t border-neutral-800 pt-2 text-muted">
          susturuldun{muteReason && ` — ${muteReason}`}
          {mutedUntil &&
            `, ${new Date(mutedUntil).toLocaleString("tr-TR")} tarihine kadar mesaj gönderemez/düzenleyemezsin`}
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t border-neutral-800 pt-2"
        >
          <span className="text-muted">&gt;</span>
          <input
            type="text"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={!isReady}
            placeholder="mesaj yaz..."
            aria-label="mesaj yaz"
            className="flex-1 border border-transparent bg-transparent text-neutral-200 placeholder-muted outline-none focus-visible:border-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-100 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed"
          />
          <span
            className="terminal-cursor inline-block h-4 w-2 bg-neutral-400"
            aria-hidden="true"
          />
          <button
            type="submit"
            disabled={!canSend || isSending}
            className="text-muted disabled:cursor-not-allowed"
          >
            {isSending ? "gönderiliyor..." : "gönder"}
          </button>
        </form>
      )}
    </>
  );
}
