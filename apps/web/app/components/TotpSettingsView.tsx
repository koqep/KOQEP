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
import { filledInputClassName } from "./formStyles";
import type { Dictionary, Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  initialEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  dict: Dictionary;
  locale: Locale;
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
  dict,
  locale,
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
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
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
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
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
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
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
            {dict.totpSettings.recoveryCodesWarning}
          </p>
          <ul className="space-y-1 font-mono text-neutral-200">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleAcknowledgeRecoveryCodes}
            className="mt-2 self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100"
          >
            {dict.totpSettings.savedIt}
          </button>
        </div>
      ) : enabled ? (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <p>{dict.totpSettings.onDescription}</p>
          <label className="flex flex-col gap-1 text-muted">
            {dict.common.authenticatorCodeLabel}
            <input
              type="text"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              className={filledInputClassName}
            />
          </label>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {dict.totpSettings.turnOff}
          </button>
        </form>
      ) : setup ? (
        <form onSubmit={handleEnable} className="flex flex-col gap-3">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image optimizasyonuna uygun bir uzak/statik kaynak değil.
            <img src={qr} alt={dict.totpSettings.qrAlt} className="h-40 w-40" />
          )}
          <p className="text-muted">{dict.totpSettings.secretKeyHint}</p>
          <p className="font-mono text-neutral-200 select-all">{setup.secret}</p>
          <label className="flex flex-col gap-1 text-muted">
            {dict.common.authenticatorCodeLabel}
            <input
              type="text"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- TOTP kurulumu başlatıldıktan sonra beliren alan, sürpriz odak sıçraması değil.
              autoFocus
              className={filledInputClassName}
            />
          </label>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {dict.totpSettings.enable}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>{dict.totpSettings.offDescription}</p>
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void handleStartSetup()}
            disabled={isSubmitting}
            className="self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {dict.totpSettings.startSetup}
          </button>
        </div>
      )}
    </section>
  );
}
