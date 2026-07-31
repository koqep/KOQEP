"use client";

import { useState, type FormEvent } from "react";
import { deleteAccount, ApiError } from "../../lib/api";

interface Props {
  accessToken: string;
  onDeleted: () => void;
  onClose: () => void;
}

const inputClassName =
  "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus:border-neutral-600";

export default function DeleteAccountView({
  accessToken,
  onDeleted,
  onClose,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await deleteAccount(
        accessToken,
        password,
        totpRequired ? totpCode : undefined,
      );
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
        } else {
          setError("Incorrect password.");
        }
      } else {
        setError("Connection error. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-neutral-400">
          <span className="text-neutral-600">#</span> delete account
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-400"
        >
          close
        </button>
      </div>

      {confirming ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-red-400">
            This is permanent. Your messages stay visible to others but will
            no longer show your username.
          </p>
          <label className="flex flex-col gap-1 text-neutral-500">
            current password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
              className={inputClassName}
            />
          </label>
          {totpRequired && (
            <label className="flex flex-col gap-1 text-neutral-500">
              totp code
              <input
                type="text"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                required
                className={inputClassName}
              />
            </label>
          )}
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start border border-red-900 px-3 py-1 text-red-400 hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            permanently delete my account
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            Deleting your account is permanent and cannot be undone. Your
            email, username, and password are removed entirely. Messages you
            sent stay in place for other users but are no longer linked to
            you.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="self-start border border-red-900 px-3 py-1 text-red-400 hover:border-red-700"
          >
            delete my account
          </button>
        </div>
      )}
    </section>
  );
}
