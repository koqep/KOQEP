"use client";

import { useEffect, useState } from "react";
import {
  listDiscoverableRooms,
  joinRoom,
  ApiError,
  type Room,
} from "../../lib/api";
import { formatRelativeActivity } from "../../lib/format";

interface Props {
  accessToken: string;
  onJoined: (room: Room) => void;
}

export default function DiscoverRoomsView({ accessToken, onJoined }: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setJoiningId(room.id);
    try {
      const joined = await joinRoom(accessToken, room.id);
      setRooms((prev) => (prev ?? []).filter((r) => r.id !== room.id));
      onJoined(joined);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connection error. Try again.",
      );
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      {error && <p className="mb-4 text-red-400">{error}</p>}

      {rooms === null ? (
        <p>loading...</p>
      ) : rooms.length === 0 ? (
        <p>no other active rooms to discover</p>
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
                  last active: {formatRelativeActivity(room.lastActivityAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleJoin(room)}
                disabled={joiningId === room.id}
                className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {joiningId === room.id ? "joining..." : "join"}
              </button>
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
          {isLoadingMore ? "loading..." : "show more"}
        </button>
      )}
    </section>
  );
}
