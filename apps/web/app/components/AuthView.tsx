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
import { filledInputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";
import type { Dictionary, Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

type Mode = "login" | "signup" | "forgot-password";

interface Props {
  onAuthenticated: (tokens: TokenPair, totpEnabled: boolean) => void;
  initialMode?: Mode;
  dict: Dictionary;
  locale: Locale;
}

export default function AuthView({
  onAuthenticated,
  initialMode,
  dict,
  locale,
}: Props) {
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
        // M9 Slice B: giriş anında localStorage'daki tercih - backend
        // SADECE User.locale henüz null'sa kullanır (tek seferlik senkron).
        // M9 Slice D2: `locale` artık AppShell'in TEK çözümleme noktasından
        // gelen bir PROP - burada AYRICA readStoredLocale/detectBrowserLocale
        // çağırmaya gerek yok.
        localeHint: locale,
      });
      onAuthenticated(tokens, totpRequired);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
        } else {
          // M9 Slice D2: `translateErrorCode` (D1, apps/web/lib/
          // error-messages.ts) backend'in code'unu kullanıcının dilinde
          // bir mesaja çeviriyor - EMAIL_NOT_VERIFIED için AYRI bir dal
          // GEREKMİYOR artık, sözlükteki değer AuthView'ın eski hardcoded
          // override'ıyla ZATEN birebir aynı metin. Bilinmeyen bir code
          // ("undefined" dönerse) backend'in ham mesajına düşülür.
          setError(translateErrorCode(err.code, locale) ?? err.message);
        }
      } else {
        setError(dict.common.connectionError);
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
            {dict.authView.logIn}
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
            {dict.authView.signUp}
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
            {dict.authView.resetRequestedMessage}
          </p>
        ) : mode === "signup" && signupComplete ? (
          <p className="text-neutral-400">
            {dict.authView.signupCompleteMessage}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-muted">
              {mode === "signup"
                ? dict.authView.promptSignUp
                : mode === "forgot-password"
                  ? dict.authView.promptResetPassword
                  : dict.authView.promptLogIn}
            </p>

            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-muted">
                {dict.authView.inviteCodeLabel}
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  required
                  placeholder="XXXX-XXXX"
                  className={filledInputClassName}
                />
                <span className="text-xs text-muted">
                  {dict.authView.inviteCodeHelp}
                </span>
              </label>
            )}

            <label className="flex flex-col gap-1 text-muted">
              {dict.authView.emailLabel}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className={filledInputClassName}
              />
            </label>

            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-muted">
                {dict.authView.usernameLabel}
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_-]+"
                  placeholder="captain_49"
                  className={filledInputClassName}
                />
              </label>
            )}

            {mode !== "forgot-password" && (
              <PasswordInput
                label={dict.authView.passwordLabel}
                dict={dict}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                maxLength={200}
                filled
              />
            )}

            {mode === "login" && totpRequired && (
              <label className="flex flex-col gap-1 text-muted">
                {dict.authView.authenticatorCodeLabel}
                <input
                  type="text"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  required
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- login denemesi sonucu beliren alan, sayfa yüklenirken sürpriz odak sıçraması değil.
                  autoFocus
                  className={filledInputClassName}
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
                  {dict.authView.termsPrefix}{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    {dict.authView.termsLink}
                  </Link>{" "}
                  {dict.authView.termsAnd}{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    {dict.authView.privacyLink}
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
                ? dict.authView.signUp
                : mode === "forgot-password"
                  ? dict.authView.send
                  : dict.authView.logIn}
            </button>
          </form>
        )}

        {mode === "forgot-password" ? (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="text-muted hover:text-neutral-400"
          >
            {dict.common.backToLogin}
          </button>
        ) : (
          <>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot-password")}
                className="text-muted hover:text-neutral-400"
              >
                {dict.authView.forgotPassword}
              </button>
            )}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="border border-neutral-800 px-4 py-1.5 text-neutral-400 hover:border-neutral-600"
            >
              <span aria-hidden="true">+ </span>
              {mode === "login" ? dict.authView.signUp : dict.authView.logIn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
