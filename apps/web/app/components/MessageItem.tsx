"use client";

import { useState, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "./RoomView";
import MessageContent from "./MessageContent";
import type { MessageEdit } from "../../lib/api";
import { inputClassName } from "./formStyles";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
  editedAt: string | null;
}

interface Props {
  message: Message;
  isMine: boolean;
  isMuted: boolean;
  canViewHistory: boolean;
  onSubmitEdit: (messageId: string, content: string) => void;
  onSubmitDelete: (messageId: string) => void;
  fetchHistory: (messageId: string) => Promise<MessageEdit[]>;
  onReport: (messageId: string) => Promise<void>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageItem({
  message,
  isMine,
  isMuted,
  canViewHistory,
  onSubmitEdit,
  onSubmitDelete,
  fetchHistory,
  onReport,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<MessageEdit[] | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reportState, setReportState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  async function handleReport() {
    setReportState("sending");
    try {
      await onReport(message.id);
      setReportState("sent");
    } catch {
      setReportState("error");
    }
  }

  function startEditing() {
    setDraft(message.content);
    setIsEditing(true);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return;
    onSubmitEdit(message.id, content);
    setIsEditing(false);
  }

  async function toggleHistory() {
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      setHistoryEntries(null);
      setHistoryError(null);
      return;
    }
    setIsHistoryOpen(true);
    setHistoryError(null);
    try {
      const entries = await fetchHistory(message.id);
      setHistoryEntries(entries);
    } catch {
      setHistoryError("Could not load history.");
    }
  }

  const authorLabel = isMine
    ? "you"
    : (message.authorUsername ?? "deleted user");

  return (
    <li className="text-neutral-200">
      {isEditing ? (
        <form
          onSubmit={handleEditSubmit}
          className="flex items-center gap-2 py-1"
        >
          <input
            type="text"
            aria-label="edit message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- "düzenle"ye tıklandıktan sonra beliren alan, sürpriz odak sıçraması değil.
            autoFocus
            className={`flex-1 ${inputClassName}`}
          />
          <button
            type="submit"
            className="text-muted hover:text-neutral-400"
          >
            save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-muted hover:text-neutral-400"
          >
            cancel
          </button>
        </form>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-muted">{authorLabel}:</span>
          <span className="flex-1">
            <MessageContent content={message.content} />
            {message.editedAt && (
              <span className="text-muted"> (edited)</span>
            )}
          </span>
          {isMine && !isMuted && (
            <button
              type="button"
              onClick={startEditing}
              className="text-muted hover:text-neutral-400"
            >
              edit
            </button>
          )}
          {isMine &&
            (isConfirmingDelete ? (
              <>
                <span className="text-red-400">are you sure?</span>
                <button
                  type="button"
                  onClick={() => {
                    onSubmitDelete(message.id);
                    setIsConfirmingDelete(false);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="text-muted hover:text-neutral-400"
                >
                  cancel
                </button>
              </>
            ) : (
              // Mute kontrolü BİLEREK YOK - susturulmuş kullanıcı da kendi
              // mesajını silebilmeli (silme yeni içerik EKLEMİYOR, sabit bir
              // placeholder'a değiştiriyor, mute'un koruduğu risk yok).
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="text-muted hover:text-red-400"
              >
                delete
              </button>
            ))}
          {canViewHistory && (
            <button
              type="button"
              onClick={() => void toggleHistory()}
              className="text-muted hover:text-neutral-400"
            >
              {isHistoryOpen ? "hide history" : "history"}
            </button>
          )}
          {!isMine &&
            (reportState === "sent" ? (
              <span className="text-muted">reported</span>
            ) : (
              <button
                type="button"
                disabled={reportState === "sending"}
                onClick={() => void handleReport()}
                className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
              >
                {reportState === "error"
                  ? "try again"
                  : reportState === "sending"
                    ? "reporting..."
                    : "report"}
              </button>
            ))}
        </div>
      )}

      {isHistoryOpen && (
        <div className="ml-4 border-l border-neutral-800 pl-2">
          {historyError ? (
            <p className="text-red-400">{historyError}</p>
          ) : historyEntries === null ? (
            <p className="text-muted">loading...</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-muted">no edit history</p>
          ) : (
            <ul className="space-y-0.5">
              {historyEntries.map((entry, index) => (
                <li key={index} className="text-muted">
                  {formatTime(entry.editedAt)} —{" "}
                  <MessageContent content={entry.previousContent} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
