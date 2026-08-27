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

// M10 Faz 2 Slice C: Faz 1'in "5 dakika" kararı (Slack/Discord emsali) -
// kesin (>) kıyaslanıyor, tam 5:00 hâlâ AYNI grup içinde sayılır.
const GROUP_BREAK_THRESHOLD_MS = 5 * 60 * 1000;

// messages HER ZAMAN createdAt'e göre sıralı (RoomView.tsx'in
// mergeMessagesById'si garanti ediyor) - bu yüzden grup-başı kararı ekstra
// bir state gerektirmeden, her render'da array sırasından türetiliyor. Edit/
// silme createdAt'e dokunmuyor, WS yeni mesajı sona ekliyor, "load older"
// eskiyi başa ekleyip yeniden sıralıyor - hiçbiri kararsız/yanıp-sönen bir
// sonuç üretmiyor. BİLEREK KASITLI yan etki: "load older" ile önceden
// grup-başı olan bir mesajın önüne aynı yazardan/eşik-içi bir mesaj
// yüklenirse, o mesaj artık devam mesajına döner (etiketi/saati kaybolur) -
// Slack/Discord'un da yaptığı geriye-dönük yeniden gruplama.
function isGroupStart(messages: Message[], index: number): boolean {
  const message = messages[index];
  const previous = messages[index - 1];
  if (!previous) return true;
  if (previous.authorUsername !== message.authorUsername) return true;
  const gapMs =
    new Date(message.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return gapMs > GROUP_BREAK_THRESHOLD_MS;
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
  onViewProfile: (username: string) => void;
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
  onViewProfile,
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
          <span className="text-muted">announcement:</span>{" "}
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
            {isLoadingOlder ? "loading..." : "load older messages"}
          </button>
        )}
        {messages.length === 0 ? (
          <p>
            {activeRoom
              ? `#${activeRoom.name} is quiet so far — send the first message`
              : "no messages yet"}
          </p>
        ) : (
          <ul>
            {messages.map((message, index) => {
              const isMine =
                message.authorUsername !== null &&
                message.authorUsername === myProfile?.username;
              const canViewHistory = isMine || myProfile?.role === "moderator";
              const groupStart = isGroupStart(messages, index);
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isMine={isMine}
                  isMuted={isMuted}
                  canViewHistory={canViewHistory}
                  isGroupStart={groupStart}
                  onSubmitEdit={onMessageEditSubmit}
                  onSubmitDelete={onMessageDeleteSubmit}
                  fetchHistory={fetchHistoryForMessage}
                  onReport={onReportMessage}
                  onViewProfile={onViewProfile}
                  // Mesaj ritmi: grup içi sıkı (mt-0.5), gruplar arası
                  // gevşek (mt-3) boşluk - listenin ilk öğesi hiç boşluk
                  // almaz.
                  className={
                    index === 0 ? "" : groupStart ? "mt-3" : "mt-0.5"
                  }
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
            a message of yours was removed by a moderator — {contentRemovedNotice}
          </span>
          <button
            type="button"
            onClick={onDismissContentRemovedNotice}
            className="text-muted hover:text-neutral-400"
          >
            ok
          </button>
        </p>
      )}
      {activeRoom && activeRoom.status !== "active" ? (
        <p className="border-t border-neutral-800 pt-2 text-muted">
          this room is archived, read-only
        </p>
      ) : isMuted ? (
        <p className="border-t border-neutral-800 pt-2 text-muted">
          you&apos;re muted{muteReason && ` — ${muteReason}`}
          {mutedUntil &&
            ` until ${new Date(mutedUntil).toLocaleString("en-US")}, you can't send or edit messages`}
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
            placeholder="write a message..."
            aria-label="write a message"
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
            {isSending ? "sending..." : "send"}
          </button>
        </form>
      )}
    </>
  );
}
