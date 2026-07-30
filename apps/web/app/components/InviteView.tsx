"use client";

import { useState } from "react";
import { createInvite, ApiError } from "../../lib/api";

interface Props {
  accessToken: string;
  onClose: () => void;
}

export default function InviteView({ accessToken, onClose }: Props) {
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { code } = await createInvite(accessToken);
      setCodes((prev) => [code, ...prev]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("You can create up to 5 invites per hour. Try again later.");
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Connection error. Try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-neutral-400">
          <span className="text-neutral-600">#</span> invites
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-400"
        >
          close
        </button>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={isSubmitting}
        className="mb-6 self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        create invite
      </button>

      {codes.length === 0 ? (
        <p>no invites yet</p>
      ) : (
        <ul className="space-y-2">
          {codes.map((code) => (
            <li
              key={code}
              className="select-all font-mono text-neutral-200"
            >
              {code}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
