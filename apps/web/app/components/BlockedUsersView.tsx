"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
  ApiError,
  type BlockedUser,
} from "../../lib/api";
import { inputClassName } from "./formStyles";
import { useFocusOnMount } from "./useFocusOnMount";

interface Props {
  accessToken: string;
  onClose: () => void;
  titleId: string;
}

export default function BlockedUsersView({ accessToken, onClose, titleId }: Props) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let cancelled = false;
    listBlockedUsers(accessToken)
      .then((users) => {
        if (!cancelled) setBlockedUsers(users);
      })
      .catch(() => {
        if (!cancelled) setBlockedUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await blockUser(accessToken, email);
      // Backend'in block endpoint'i username döndürmüyor - listeyi yeniden
      // çekmek, senkron bir username'siz placeholder eklemekten daha basit.
      setBlockedUsers(await listBlockedUsers(accessToken));
      setEmail("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connection error. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnblock(targetEmail: string) {
    setError(null);
    try {
      await unblockUser(accessToken, targetEmail);
      setBlockedUsers((prev) =>
        (prev ?? []).filter((user) => user.email !== targetEmail),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connection error. Try again.",
      );
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-neutral-400 outline-none">
          <span className="text-muted">#</span> blocked
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-neutral-400"
        >
          close
        </button>
      </div>

      <form onSubmit={handleBlock} className="mb-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-muted">
          email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={inputClassName}
          />
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          block
        </button>
      </form>

      {blockedUsers === null ? (
        <p>loading...</p>
      ) : blockedUsers.length === 0 ? (
        <p>you haven&apos;t blocked anyone yet</p>
      ) : (
        <ul className="space-y-2">
          {blockedUsers.map((user) => (
            <li
              key={user.email}
              className="flex items-center justify-between gap-4 text-neutral-200"
            >
              {user.username}
              <button
                type="button"
                onClick={() => void handleUnblock(user.email)}
                className="text-muted hover:text-neutral-400"
              >
                unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
