"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, ApiError } from "../../lib/api";

const inputClassName =
  "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus:border-neutral-600";

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
        err instanceof ApiError ? err.message : "Bağlantı hatası. Tekrar dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">Geçersiz bağlantı.</p>
        <Link href="/" className="mt-4 text-neutral-600 hover:text-neutral-400">
          girişe dön
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">Şifren güncellendi.</p>
        <Link href="/" className="mt-4 text-neutral-600 hover:text-neutral-400">
          girişe dön
        </Link>
      </main>
    );
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-neutral-600">#</span> yeni şifre
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-neutral-500">
          yeni şifre
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
          className="mt-2 border border-neutral-800 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          şifreyi güncelle
        </button>
      </form>
    </main>
  );
}
