"use client";

import { useState, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "./RoomView";
import type { MessageEdit } from "../../lib/api";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
}

interface Props {
  message: Message;
  isMine: boolean;
  canViewHistory: boolean;
  onSubmitEdit: (messageId: string, content: string) => void;
  fetchHistory: (messageId: string) => Promise<MessageEdit[]>;
}

const inputClassName =
  "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus:border-neutral-600";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageItem({
  message,
  isMine,
  canViewHistory,
  onSubmitEdit,
  fetchHistory,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<MessageEdit[] | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);

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
      setHistoryError("Geçmiş yüklenemedi.");
    }
  }

  const authorLabel = isMine
    ? "sen"
    : (message.authorUsername ?? "silinmiş kullanıcı");

  return (
    <li className="text-neutral-200">
      {isEditing ? (
        <form
          onSubmit={handleEditSubmit}
          className="flex items-center gap-2 py-1"
        >
          <input
            type="text"
            aria-label="mesajı düzenle"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            className={`flex-1 ${inputClassName}`}
          />
          <button
            type="submit"
            className="text-neutral-600 hover:text-neutral-400"
          >
            kaydet
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-neutral-600 hover:text-neutral-400"
          >
            iptal
          </button>
        </form>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-neutral-500">{authorLabel}:</span>
          <span className="flex-1">{message.content}</span>
          {isMine && (
            <button
              type="button"
              onClick={startEditing}
              className="text-neutral-600 hover:text-neutral-400"
            >
              düzenle
            </button>
          )}
          {canViewHistory && (
            <button
              type="button"
              onClick={() => void toggleHistory()}
              className="text-neutral-600 hover:text-neutral-400"
            >
              {isHistoryOpen ? "geçmişi gizle" : "geçmiş"}
            </button>
          )}
        </div>
      )}

      {isHistoryOpen && (
        <div className="ml-4 border-l border-neutral-800 pl-2">
          {historyError ? (
            <p className="text-red-400">{historyError}</p>
          ) : historyEntries === null ? (
            <p className="text-neutral-600">yükleniyor...</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-neutral-600">düzenleme geçmişi yok</p>
          ) : (
            <ul className="space-y-0.5">
              {historyEntries.map((entry, index) => (
                <li key={index} className="text-neutral-600">
                  {formatTime(entry.editedAt)} — {entry.previousContent}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
