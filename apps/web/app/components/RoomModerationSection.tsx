"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  listAllRoomsForModeration,
  renameRoom,
  archiveRoom,
  deleteRoom,
  setRoomAnnouncement,
  ApiError,
  type Room,
} from "../../lib/api";
import { inputClassName } from "./formStyles";
import type { Dictionary, Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

// apps/api/src/api/dto/set-room-announcement.dto.ts'teki MAX_ROOM_ANNOUNCEMENT_LENGTH
// ile AYNI değer - MAX_MESSAGE_LENGTH'in zaten kurduğu "küçük sabiti
// frontend/backend arasında kopyala" deseni.
const MAX_ROOM_ANNOUNCEMENT_LENGTH = 280;

interface Props {
  accessToken: string;
  dict: Dictionary;
  locale: Locale;
}

export default function RoomModerationSection({
  accessToken,
  dict,
  locale,
}: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [announcingId, setAnnouncingId] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    listAllRoomsForModeration(accessToken, true)
      .then((result) => {
        if (!cancelled) setRooms(result);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  function replaceInList(updated: Room) {
    setRooms((prev) =>
      (prev ?? []).map((r) => (r.id === updated.id ? updated : r)),
    );
  }

  function startRenaming(room: Room) {
    setError(null);
    setRenamingId(room.id);
    setRenameDraft(room.name);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>, room: Room) {
    event.preventDefault();
    const name = renameDraft.trim();
    if (!name) return;
    setError(null);
    setPendingId(room.id);
    try {
      const updated = await renameRoom(accessToken, room.id, name);
      replaceInList(updated);
      setRenamingId(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setPendingId(null);
    }
  }

  function startAnnouncing(room: Room) {
    setError(null);
    setAnnouncingId(room.id);
    setAnnouncementDraft(room.announcement ?? "");
  }

  async function submitAnnouncement(
    event: FormEvent<HTMLFormElement>,
    room: Room,
  ) {
    event.preventDefault();
    setError(null);
    setPendingId(room.id);
    try {
      const updated = await setRoomAnnouncement(
        accessToken,
        room.id,
        announcementDraft.trim() || null,
      );
      replaceInList(updated);
      setAnnouncingId(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function clearAnnouncement(room: Room) {
    setError(null);
    setPendingId(room.id);
    try {
      const updated = await setRoomAnnouncement(accessToken, room.id, null);
      replaceInList(updated);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleArchive(room: Room) {
    setError(null);
    setPendingId(room.id);
    try {
      const updated = await archiveRoom(accessToken, room.id);
      replaceInList(updated);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete(room: Room) {
    setError(null);
    setPendingId(room.id);
    try {
      await deleteRoom(accessToken, room.id);
      setRooms((prev) => (prev ?? []).filter((r) => r.id !== room.id));
      setConfirmingDeleteId(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-8 border-t border-neutral-800 pt-4">
      <h3 className="mb-4 text-neutral-400">
        <span className="text-muted">#</span> {dict.roomModeration.heading}
      </h3>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {rooms === null ? (
        <p className="text-neutral-400">{dict.common.loading}</p>
      ) : rooms.length === 0 ? (
        <p className="text-neutral-400">{dict.roomModeration.noRooms}</p>
      ) : (
        <ul className="space-y-4">
          {rooms.map((room) => (
            <li key={room.id} className="border border-neutral-800 p-2">
              {renamingId === room.id ? (
                <form
                  onSubmit={(event) => void submitRename(event, room)}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label={dict.roomModeration.renameAriaLabel}
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- "yeniden adlandır"a tıklandıktan sonra beliren alan, sürpriz odak sıçraması değil.
                    autoFocus
                    className={`flex-1 ${inputClassName}`}
                  />
                  <button
                    type="submit"
                    disabled={pendingId === room.id}
                    className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    {dict.common.saveButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    {dict.common.cancel}
                  </button>
                </form>
              ) : (
                <p className="mb-2 text-neutral-200">
                  <span className="text-muted">#</span>
                  {room.name}{" "}
                  <span className="text-muted">
                    (
                    {room.status === "active"
                      ? dict.roomModeration.statusActive
                      : room.status === "archived"
                        ? dict.roomModeration.statusArchived
                        : dict.roomModeration.statusDeleted}
                    )
                  </span>
                </p>
              )}

              {announcingId === room.id ? (
                <form
                  onSubmit={(event) => void submitAnnouncement(event, room)}
                  className="mb-2 flex items-start gap-2"
                >
                  <textarea
                    aria-label={dict.roomModeration.announcementAriaLabel}
                    value={announcementDraft}
                    onChange={(event) =>
                      setAnnouncementDraft(event.target.value)
                    }
                    maxLength={MAX_ROOM_ANNOUNCEMENT_LENGTH}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- "duyuru ekle/düzenle"ye tıklandıktan sonra beliren alan, sürpriz odak sıçraması değil.
                    autoFocus
                    className={`flex-1 ${inputClassName}`}
                  />
                  <span className="text-muted">
                    {announcementDraft.length}/{MAX_ROOM_ANNOUNCEMENT_LENGTH}
                  </span>
                  <button
                    type="submit"
                    disabled={pendingId === room.id}
                    className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    {dict.common.saveButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnouncingId(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    {dict.common.cancel}
                  </button>
                </form>
              ) : room.announcement ? (
                <p className="mb-2 text-neutral-400">
                  <span className="text-muted">
                    {dict.roomModeration.announcementLabel}
                  </span>{" "}
                  {room.announcement}{" "}
                  <button
                    type="button"
                    disabled={pendingId === room.id}
                    onClick={() => void clearAnnouncement(room)}
                    className="text-muted hover:text-red-400 disabled:cursor-not-allowed"
                  >
                    {dict.roomModeration.removeAnnouncementButton}
                  </button>
                </p>
              ) : (
                <p className="mb-2">
                  <button
                    type="button"
                    disabled={pendingId === room.id}
                    onClick={() => startAnnouncing(room)}
                    className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    {dict.roomModeration.addAnnouncementButton}
                  </button>
                </p>
              )}

              {confirmingDeleteId === room.id ? (
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                  <span className="text-red-400">
                    {dict.roomModeration.deleteConfirmWarning}
                  </span>
                  <button
                    type="button"
                    disabled={pendingId === room.id}
                    onClick={() => void confirmDelete(room)}
                    className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed"
                  >
                    {dict.roomModeration.confirmDeleteButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    {dict.common.cancel}
                  </button>
                </div>
              ) : (
                renamingId !== room.id && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled={pendingId === room.id}
                      onClick={() => startRenaming(room)}
                      className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                    >
                      {dict.roomModeration.renameButton}
                    </button>
                    {room.status === "active" && (
                      <button
                        type="button"
                        disabled={pendingId === room.id}
                        onClick={() => void handleArchive(room)}
                        className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                      >
                        {dict.roomModeration.archiveButton}
                      </button>
                    )}
                    {room.status === "archived" && (
                      <button
                        type="button"
                        disabled={pendingId === room.id}
                        onClick={() => setConfirmingDeleteId(room.id)}
                        className="text-muted hover:text-red-400 disabled:cursor-not-allowed"
                      >
                        {dict.roomModeration.deleteButton}
                      </button>
                    )}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
