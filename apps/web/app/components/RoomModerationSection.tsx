"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  listAllRoomsForModeration,
  renameRoom,
  archiveRoom,
  deleteRoom,
  type Room,
} from "../../lib/api";
import { inputClassName } from "./formStyles";

interface Props {
  accessToken: string;
}

export default function RoomModerationSection({ accessToken }: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
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
    } catch {
      setError("Oda yeniden adlandırılamadı, tekrar dene.");
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
    } catch {
      setError("Oda arşivlenemedi, tekrar dene.");
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
    } catch {
      setError("Oda silinemedi, tekrar dene.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-8 border-t border-neutral-800 pt-4">
      <h3 className="mb-4 text-neutral-400">
        <span className="text-muted">#</span> odalar
      </h3>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {rooms === null ? (
        <p className="text-neutral-400">yükleniyor...</p>
      ) : rooms.length === 0 ? (
        <p className="text-neutral-400">oda yok</p>
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
                    aria-label="oda ismini düzenle"
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
                    kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    iptal
                  </button>
                </form>
              ) : (
                <p className="mb-2 text-neutral-200">
                  <span className="text-muted">#</span>
                  {room.name}{" "}
                  <span className="text-muted">({room.status})</span>
                </p>
              )}

              {confirmingDeleteId === room.id ? (
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                  <span className="text-red-400">
                    emin misin? bu kalıcı, mesajlar da gider
                  </span>
                  <button
                    type="button"
                    disabled={pendingId === room.id}
                    onClick={() => void confirmDelete(room)}
                    className="text-red-400 hover:text-red-300 disabled:cursor-not-allowed"
                  >
                    evet, sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    vazgeç
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
                      yeniden adlandır
                    </button>
                    {room.status === "active" && (
                      <button
                        type="button"
                        disabled={pendingId === room.id}
                        onClick={() => void handleArchive(room)}
                        className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                      >
                        arşivle
                      </button>
                    )}
                    {room.status === "archived" && (
                      <button
                        type="button"
                        disabled={pendingId === room.id}
                        onClick={() => setConfirmingDeleteId(room.id)}
                        className="text-muted hover:text-red-400 disabled:cursor-not-allowed"
                      >
                        sil
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
