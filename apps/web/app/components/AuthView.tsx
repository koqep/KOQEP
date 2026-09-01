"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  login,
  signup,
  requestPasswordReset,
  ApiError,
  type TokenPair,
} from "../../lib/api";
import { inputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";

type Mode = "login" | "signup" | "forgot-password";

interface Props {
  onAuthenticated: (tokens: TokenPair, totpEnabled: boolean) => void;
  initialMode?: Mode;
}

export default function AuthView({ onAuthenticated, initialMode }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "login");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setTotpRequired(false);
    setTotpCode("");
    setAcceptedTerms(false);
    setResetRequested(false);
    setSignupComplete(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "forgot-password") {
        await requestPasswordReset(email);
        // Backend her zaman ok:true döner, e-posta kayıtlı olsun olmasın
        // (THREAT-MODEL satır 11, enumeration'a karşı) - arayüz de aynı
        // nötr mesajı gösterir, "bulundu/bulunamadı" ima etmez.
        setResetRequested(true);
        return;
      }

      if (mode === "signup") {
        await signup({ inviteCode, email, username, password, acceptedTerms });
        // Signup artık giriş yapmıyor - hesap e-postayı doğrulayana kadar
        // kullanılamaz (M2.5 Slice B). "şifremi unuttum" ile aynı nötr
        // mesaj deseni.
        setSignupComplete(true);
        return;
      }

      const tokens = await login({
        email,
        password,
        ...(totpRequired ? { totpCode } : {}),
      });
      onAuthenticated(tokens, totpRequired);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
        } else if (err.code === "EMAIL_NOT_VERIFIED") {
          // Backend'in ham mesajı Türkçe (A20, backend hata metinleri
          // henüz çevrilmedi) - bilinen code'lar için TOTP_REQUIRED'la
          // AYNI desen, frontend kendi net İngilizce mesajını gösteriyor.
          setError(
            "Check your inbox — you need to verify your email before signing in.",
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Connection error. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border border-neutral-800">
      {mode !== "forgot-password" && (
        <div
          role="tablist"
          aria-label="auth mode"
          className="flex border-b border-neutral-800"
        >
          <button
            type="button"
            role="tab"
            id="auth-tab-login"
            aria-selected={mode === "login"}
            aria-controls="auth-panel"
            onClick={() => switchMode("login")}
            className={
              "flex-1 py-2 text-xs " +
              (mode === "login"
                ? "border-b-2 border-neutral-200 text-neutral-200"
                : "text-muted hover:text-neutral-400")
            }
          >
            log in
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-signup"
            aria-selected={mode === "signup"}
            aria-controls="auth-panel"
            onClick={() => switchMode("signup")}
            className={
              "flex-1 py-2 text-xs " +
              (mode === "signup"
                ? "border-b-2 border-neutral-200 text-neutral-200"
                : "text-muted hover:text-neutral-400")
            }
          >
            sign up
          </button>
        </div>
      )}

      <div
        id="auth-panel"
        role={mode !== "forgot-password" ? "tabpanel" : undefined}
        aria-labelledby={
          mode !== "forgot-password"
            ? mode === "signup"
              ? "auth-tab-signup"
              : "auth-tab-login"
            : undefined
        }
        className="flex flex-col gap-3 p-4"
      >
        {mode === "forgot-password" && resetRequested ? (
          <p className="text-neutral-400">
            If this email is registered, a reset link has been sent.
          </p>
        ) : mode === "signup" && signupComplete ? (
          <p className="text-neutral-400">
            Click the link sent to your email to complete your signup.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-muted">
              {mode === "signup"
                ? "$ sign up"
                : mode === "forgot-password"
                  ? "$ reset password"
                  : "$ log in"}
            </p>

            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-muted">
                invite code
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  required
                  placeholder="XXXX-XXXX"
                  className={inputClassName}
                />
                <span className="text-xs text-muted">
                  Ask someone already on KOQEP for an invite code.
                </span>
              </label>
            )}

            <label className="flex flex-col gap-1 text-muted">
              email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className={inputClassName}
              />
            </label>

            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-muted">
                username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_-]+"
                  placeholder="captain_49"
                  className={inputClassName}
                />
              </label>
            )}

            {mode !== "forgot-password" && (
              <PasswordInput
                label="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                maxLength={200}
              />
            )}

            {mode === "login" && totpRequired && (
              <label className="flex flex-col gap-1 text-muted">
                authenticator code
                <input
                  type="text"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  required
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- login denemesi sonucu beliren alan, sayfa yüklenirken sürpriz odak sıçraması değil.
                  autoFocus
                  className={inputClassName}
                />
              </label>
            )}

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  required
                  className="mt-1"
                />
                <span>
                  I have read and accept the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {error && <p className="text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting || (mode === "signup" && !acceptedTerms)}
              className="mt-2 bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span aria-hidden="true">&gt; </span>
              {mode === "signup"
                ? "sign up"
                : mode === "forgot-password"
                  ? "send"
                  : "log in"}
            </button>
          </form>
        )}

        {mode === "forgot-password" ? (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="text-muted hover:text-neutral-400"
          >
            back to login
          </button>
        ) : (
          <>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot-password")}
                className="text-muted hover:text-neutral-400"
              >
                forgot your password?
              </button>
            )}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="border border-neutral-800 px-4 py-1.5 text-neutral-400 hover:border-neutral-600"
            >
              <span aria-hidden="true">+ </span>
              {mode === "login" ? "sign up" : "log in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
