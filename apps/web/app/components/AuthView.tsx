"use client";

import { useState, type FormEvent } from "react";
import { login, signup, ApiError, type TokenPair } from "../../lib/api";

type Mode = "login" | "signup";

interface Props {
  onAuthenticated: (tokens: TokenPair) => void;
}

const inputClassName =
  "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus:border-neutral-600";

export default function AuthView({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setTotpRequired(false);
    setTotpCode("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const tokens =
        mode === "signup"
          ? await signup({ inviteCode, email, password })
          : await login({
              email,
              password,
              ...(totpRequired ? { totpCode } : {}),
            });
      onAuthenticated(tokens);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
        } else {
          setError(err.message);
        }
      } else {
        setError("Bağlantı hatası. Tekrar dene.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-sm flex-col justify-center p-4">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-neutral-600">#</span> koqep
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-neutral-500">
            davet kodu
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              required
              className={inputClassName}
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-neutral-500">
          e-posta
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={inputClassName}
          />
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          şifre
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className={inputClassName}
          />
        </label>

        {totpRequired && (
          <label className="flex flex-col gap-1 text-neutral-500">
            totp kodu
            <input
              type="text"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              autoFocus
              className={inputClassName}
            />
          </label>
        )}

        {error && <p className="text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 border border-neutral-800 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "signup" ? "kayıt ol" : "giriş yap"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => switchMode(mode === "login" ? "signup" : "login")}
        className="mt-4 text-neutral-600 hover:text-neutral-400"
      >
        {mode === "login"
          ? "hesabın yok mu? kayıt ol"
          : "zaten hesabın var mı? giriş yap"}
      </button>
    </main>
  );
}
