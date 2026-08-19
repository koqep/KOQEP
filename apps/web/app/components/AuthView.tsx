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

type Mode = "login" | "signup" | "forgot-password";

interface Props {
  onAuthenticated: (tokens: TokenPair, totpEnabled: boolean) => void;
}

export default function AuthView({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
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
    <div className="flex flex-col gap-4">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-muted">#</span> koqep
      </h1>

      {mode === "forgot-password" && resetRequested ? (
        <p className="text-neutral-400">
          Bu e-posta kayıtlıysa bir sıfırlama bağlantısı gönderildi.
        </p>
      ) : mode === "signup" && signupComplete ? (
        <p className="text-neutral-400">
          Kaydını tamamlamak için e-postana gönderilen bağlantıya tıkla.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-muted">
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

          <label className="flex flex-col gap-1 text-muted">
            e-posta
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={inputClassName}
            />
          </label>

          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-muted">
              kullanıcı adı
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_-]+"
                className={inputClassName}
              />
            </label>
          )}

          {mode !== "forgot-password" && (
            <label className="flex flex-col gap-1 text-muted">
              şifre
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                maxLength={200}
                className={inputClassName}
              />
            </label>
          )}

          {mode === "login" && totpRequired && (
            <label className="flex flex-col gap-1 text-muted">
              totp kodu
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
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  Kullanım Şartları
                </Link>
                &apos;nı ve{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  Gizlilik Politikası
                </Link>
                &apos;nı okudum, kabul ediyorum.
              </span>
            </label>
          )}

          {error && <p className="text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || (mode === "signup" && !acceptedTerms)}
            className="mt-2 border border-neutral-800 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mode === "signup"
              ? "kayıt ol"
              : mode === "forgot-password"
                ? "gönder"
                : "giriş yap"}
          </button>
        </form>
      )}

      {mode === "forgot-password" ? (
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="mt-4 text-muted hover:text-neutral-400"
        >
          girişe dön
        </button>
      ) : (
        <>
          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot-password")}
              className="mt-4 text-muted hover:text-neutral-400"
            >
              şifreni mi unuttun?
            </button>
          )}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="mt-2 text-muted hover:text-neutral-400"
          >
            {mode === "login"
              ? "hesabın yok mu? kayıt ol"
              : "zaten hesabın var mı? giriş yap"}
          </button>
        </>
      )}
    </div>
  );
}
