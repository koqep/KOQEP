"use client";

import { useState, type FormEvent } from "react";
import qrcodeTerminal from "qrcode-terminal";
import {
  setupTotp,
  enableTotp,
  disableTotp,
  ApiError,
  type TotpSetup,
} from "../../lib/api";
import { inputClassName } from "./formStyles";

interface Props {
  accessToken: string;
  initialEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onClose: () => void;
}

function generateQr(otpauthUrl: string): Promise<string> {
  return new Promise((resolve) => {
    qrcodeTerminal.generate(otpauthUrl, { small: true }, resolve);
  });
}

export default function TotpSettingsView({
  accessToken,
  initialEnabled,
  onEnabledChange,
  onClose,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function markEnabled(value: boolean) {
    setEnabled(value);
    onEnabledChange(value);
  }

  async function handleStartSetup() {
    setError(null);
    setIsSubmitting(true);
    try {
      const nextSetup = await setupTotp(accessToken);
      setSetup(nextSetup);
      setQr(await generateQr(nextSetup.otpauthUrl));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Bağlantı hatası. Tekrar dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const codes = await enableTotp(accessToken, totpCode);
      setRecoveryCodes(codes);
      setTotpCode("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Bağlantı hatası. Tekrar dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAcknowledgeRecoveryCodes() {
    setRecoveryCodes(null);
    setSetup(null);
    setQr(null);
    markEnabled(true);
  }

  async function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await disableTotp(accessToken, totpCode);
      setTotpCode("");
      markEnabled(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Bağlantı hatası. Tekrar dene.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-neutral-400">
          <span className="text-muted">#</span> iki adımlı doğrulama
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-neutral-400"
        >
          kapat
        </button>
      </div>

      {recoveryCodes ? (
        <div className="flex flex-col gap-3">
          <p className="text-red-400">
            Bu kodlar bir daha gösterilmeyecek. Şimdi bir yere kaydet.
          </p>
          <ul className="space-y-1 font-mono text-neutral-200">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleAcknowledgeRecoveryCodes}
            className="mt-2 self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600"
          >
            kaydettim
          </button>
        </div>
      ) : enabled ? (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <p>İki adımlı doğrulama şu an açık.</p>
          <label className="flex flex-col gap-1 text-muted">
            totp kodu
            <input
              type="text"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              className={inputClassName}
            />
          </label>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            TOTP&apos;yi kapat
          </button>
        </form>
      ) : setup ? (
        <form onSubmit={handleEnable} className="flex flex-col gap-3">
          {qr && (
            <pre className="overflow-x-auto text-[8px] leading-[8px] text-neutral-200">
              {qr}
            </pre>
          )}
          <p className="text-muted">
            authenticator app&apos;e elle girmek için gizli anahtar:
          </p>
          <p className="font-mono text-neutral-200 select-all">{setup.secret}</p>
          <label className="flex flex-col gap-1 text-muted">
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
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            etkinleştir
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>İki adımlı doğrulama şu an kapalı.</p>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void handleStartSetup()}
            disabled={isSubmitting}
            className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            kurulumu başlat
          </button>
        </div>
      )}
    </section>
  );
}
