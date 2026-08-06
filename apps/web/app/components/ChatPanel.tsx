"use client";

import { type FormEvent, type RefObject } from "react";
import MessageItem from "./MessageItem";
import type { Room, UserProfile, MessageEdit } from "../../lib/api";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
}

interface Props {
  messagesSectionRef: RefObject<HTMLElement | null>;
  messages: Message[];
  myProfile: UserProfile | null;
  onMessageEditSubmit: (messageId: string, content: string) => void;
  fetchHistoryForMessage: (messageId: string) => Promise<MessageEdit[]>;
  onReportMessage: (messageId: string) => Promise<void>;
  nextCursor: string | null;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  sendError: string | null;
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
  onMessageEditSubmit,
  fetchHistoryForMessage,
  onReportMessage,
  nextCursor,
  isLoadingOlder,
  onLoadOlder,
  sendError,
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
      <section
        ref={messagesSectionRef}
        className="flex-1 overflow-y-auto py-4 text-neutral-500"
      >
        {nextCursor && (
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={isLoadingOlder}
            className="mb-2 text-neutral-600 hover:text-neutral-400 disabled:cursor-not-allowed"
          >
            {isLoadingOlder ? "yükleniyor..." : "daha eski mesajları yükle"}
          </button>
        )}
        {messages.length === 0 ? (
          <p>henüz mesaj yok</p>
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
                  canViewHistory={canViewHistory}
                  onSubmitEdit={onMessageEditSubmit}
                  fetchHistory={fetchHistoryForMessage}
                  onReport={onReportMessage}
                />
              );
            })}
          </ul>
        )}
      </section>

      {sendError && <p className="text-red-400">{sendError}</p>}
      {activeRoom && activeRoom.status !== "active" ? (
        <p className="border-t border-neutral-800 pt-2 text-neutral-600">
          bu oda arşivlenmiş, sadece okunabilir
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t border-neutral-800 pt-2"
        >
          <span className="text-neutral-600">&gt;</span>
          <input
            type="text"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={!isReady}
            placeholder="mesaj yaz..."
            className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-600 outline-none disabled:cursor-not-allowed"
          />
          <span
            className="terminal-cursor inline-block h-4 w-2 bg-neutral-400"
            aria-hidden="true"
          />
          <button
            type="submit"
            disabled={!canSend || isSending}
            className="text-neutral-600 disabled:cursor-not-allowed"
          >
            {isSending ? "gönderiliyor..." : "gönder"}
          </button>
        </form>
      )}
    </>
  );
}
