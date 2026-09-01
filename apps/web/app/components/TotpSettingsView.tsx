"use client";

import { useState, type FormEvent } from "react";
import QRCode from "qrcode";
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
}

// M6 Slice D: qrcode-terminal SADECE ASCII üretiyordu (telefon kamerasıyla
// taranamıyordu) - qrcode gerçek bir görüntü (data URL) üretir.
function generateQr(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1 });
}

export default function TotpSettingsView({
  accessToken,
  initialEnabled,
  onEnabledChange,
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
        err instanceof ApiError ? err.message : "Connection error. Try again.",
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
        err instanceof ApiError ? err.message : "Connection error. Try again.",
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
        err instanceof ApiError ? err.message : "Connection error. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      {recoveryCodes ? (
        <div className="flex flex-col gap-3">
          <p className="text-red-400">
            These codes won&apos;t be shown again. Save them somewhere now.
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
            saved it
          </button>
        </div>
      ) : enabled ? (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <p>Two-factor authentication is currently on.</p>
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
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            turn off authenticator
          </button>
        </form>
      ) : setup ? (
        <form onSubmit={handleEnable} className="flex flex-col gap-3">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image optimizasyonuna uygun bir uzak/statik kaynak değil.
            <img src={qr} alt="authenticator QR code" className="h-40 w-40" />
          )}
          <p className="text-muted">
            secret key to enter manually into your authenticator app:
          </p>
          <p className="font-mono text-neutral-200 select-all">{setup.secret}</p>
          <label className="flex flex-col gap-1 text-muted">
            authenticator code
            <input
              type="text"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- TOTP kurulumu başlatıldıktan sonra beliren alan, sürpriz odak sıçraması değil.
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
            enable
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>Two-factor authentication is currently off.</p>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void handleStartSetup()}
            disabled={isSubmitting}
            className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            start setup
          </button>
        </div>
      )}
    </section>
  );
}
