"use client";

import { useEffect, useState } from "react";
import {
  listDiscoverableRooms,
  joinRoom,
  ApiError,
  type Room,
} from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";
import PasswordInput from "./PasswordInput";
import { interpolate, type Dictionary, type Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  onJoined: (room: Room) => void;
  dict: Dictionary;
  locale: Locale;
}

export default function DiscoverRoomsView({
  accessToken,
  onJoined,
  dict,
  locale,
}: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // M11c Slice B: şifreli bir oda için "join" tıklaması DOĞRUDAN katılmıyor -
  // önce bu satırda inline bir şifre formu açılıyor (RoomModerationSection.
  // tsx'in rename/announce formlarıyla AYNI koşullu-değiştirme deseni).
  const [passwordDraftId, setPasswordDraftId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    listDiscoverableRooms(accessToken)
      .then((page) => {
        if (cancelled) return;
        setRooms(page.rooms);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await listDiscoverableRooms(accessToken, nextCursor);
      setRooms((prev) => [...(prev ?? []), ...page.rooms]);
      setNextCursor(page.nextCursor);
    } catch {
      // Sessizce yoksay - liste olduğu gibi kalır, "daha fazla göster" tekrar denenebilir.
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleJoin(room: Room) {
    // Şifreli bir oda için ilk tıklama SADECE formu açar - şifre henüz
    // yok, API'ye gitmenin anlamı yok (zaten reddedilir).
    if (room.hasPassword && passwordDraftId !== room.id) {
      setError(null);
      setPasswordDraftId(room.id);
      setPasswordDraft("");
      return;
    }

    setError(null);
    setJoiningId(room.id);
    try {
      const joined = await joinRoom(
        accessToken,
        room.id,
        room.hasPassword ? passwordDraft : undefined,
      );
      setRooms((prev) => (prev ?? []).filter((r) => r.id !== room.id));
      setPasswordDraftId(null);
      onJoined(joined);
    } catch (err) {
      // Yanlış şifrede form AÇIK KALIR - kullanıcı tekrar deneyebilsin.
      setError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setJoiningId(null);
    }
  }

  function handleCancelPasswordPrompt() {
    setPasswordDraftId(null);
    setPasswordDraft("");
    setError(null);
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      {error && <p className="mb-4 text-red-400">{error}</p>}

      {rooms === null ? (
        <p>{dict.common.loading}</p>
      ) : rooms.length === 0 ? (
        <p>{dict.discoverRooms.emptyList}</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-4 text-neutral-200"
            >
              <span>
                <span className="text-muted">#</span>
                {room.name}
                {room.description && (
                  <span className="text-muted"> — {room.description}</span>
                )}
                <span className="block text-sm text-muted">
                  {interpolate(dict.discoverRooms.lastActive, {
                    relative: formatRelativeActivity(room.lastActivityAt),
                  })}
                  {room.hasPassword &&
                    ` · ${dict.discoverRooms.passwordProtected}`}
                </span>
              </span>
              {passwordDraftId === room.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleJoin(room);
                  }}
                  className="flex items-center gap-2"
                >
                  <PasswordInput
                    label={dict.common.passwordLabel}
                    dict={dict}
                    filled
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={joiningId === room.id}
                    className="bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {joiningId === room.id
                      ? dict.discoverRooms.joiningButton
                      : dict.discoverRooms.joinButton}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPasswordPrompt}
                    className="text-muted hover:text-neutral-400"
                  >
                    {dict.discoverRooms.cancelButton}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleJoin(room)}
                  disabled={joiningId === room.id}
                  className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {joiningId === room.id
                    ? dict.discoverRooms.joiningButton
                    : dict.discoverRooms.joinButton}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => void handleLoadMore()}
          disabled={isLoadingMore}
          className="mt-4 text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
        >
          {isLoadingMore ? dict.common.loading : dict.discoverRooms.showMoreButton}
        </button>
      )}
    </section>
  );
}
