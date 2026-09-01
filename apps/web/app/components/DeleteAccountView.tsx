"use client";

import { useState, type FormEvent } from "react";
import { deleteAccount, ApiError } from "../../lib/api";
import { inputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";

interface Props {
  accessToken: string;
  onDeleted: () => void;
}

export default function DeleteAccountView({ accessToken, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  // M6c Slice B (ADR-0005 Addendum #2): varsayılan AÇIK - kullanıcı ne
  // yazdığını bilen tek taraf, otomatik taramanın (Slice C) kaçıracağı
  // bağlamsal kimlik ifşasını kapatan asıl mekanizma bu.
  const [redactMessageContent, setRedactMessageContent] = useState(true);
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
        redactMessageContent,
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
      {confirming ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-red-400">This is permanent.</p>
          <label className="flex items-start gap-2 text-muted">
            <input
              type="checkbox"
              checked={redactMessageContent}
              onChange={(event) =>
                setRedactMessageContent(event.target.checked)
              }
              className="mt-1"
            />
            <span>
              also remove my message content (recommended) — unchecked, your
              messages stay visible to others, only your username is removed
            </span>
          </label>
          <PasswordInput
            label="current password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus -- "delete my account"a tıklandıktan sonra beliren onay alanı, sürpriz odak sıçraması değil.
            autoFocus
          />
          {totpRequired && (
            <label className="flex flex-col gap-1 text-muted">
              authenticator code
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
            className="mt-2 self-start border border-red-900 px-3 py-1 text-red-400 hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            permanently delete my account
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            Deleting your account is permanent and cannot be undone. Your
            email, username, and password are removed entirely. You&apos;ll
            be able to choose whether your message content is also removed.
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
