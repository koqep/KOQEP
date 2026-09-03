"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, ApiError } from "../../lib/api";
import PasswordInput from "./PasswordInput";
import { readStoredLocale, detectBrowserLocale, translations } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

export default function ResetPasswordView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // M9 Slice D2 (Dalga A): AppShell zincirinin DIŞINDA (kendi route'u,
  // `/reset-password`) - AYNI readStoredLocale/detectBrowserLocale
  // çağrısını kendi içinde yapıyor (AppShell'in TEK-noktalı çözümlemesini
  // burada MİRAS ALAMIYOR, prop-drilling zinciri yok).
  const locale = readStoredLocale() ?? detectBrowserLocale();
  const dict = translations[locale];

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
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">{dict.common.invalidLink}</p>
        <Link href="/app" className="mt-4 text-muted hover:text-neutral-400">
          {dict.common.backToLogin}
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
        <p className="text-neutral-400">{dict.resetPassword.successMessage}</p>
        <Link href="/app" className="mt-4 text-muted hover:text-neutral-400">
          {dict.common.backToLogin}
        </Link>
      </main>
    );
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-muted">#</span> {dict.resetPassword.title}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PasswordInput
          label={dict.resetPassword.passwordLabel}
          dict={dict}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />

        {error && <p className="text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 border border-neutral-800 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {dict.resetPassword.submitButton}
        </button>
      </form>
    </main>
  );
}
