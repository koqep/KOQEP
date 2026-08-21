"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, ApiError } from "../../lib/api";
import { inputClassName } from "./formStyles";

export default function ResetPasswordView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await confirmPasswordReset(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connection error. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">Invalid link.</p>
        <Link href="/" className="mt-4 text-muted hover:text-neutral-400">
          back to login
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">Your password has been updated.</p>
        <Link href="/" className="mt-4 text-muted hover:text-neutral-400">
          back to login
        </Link>
      </main>
    );
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-muted">#</span> new password
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-muted">
          new password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            className={inputClassName}
          />
        </label>

        {error && <p className="text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 border border-neutral-800 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          update password
        </button>
      </form>
    </main>
  );
}
