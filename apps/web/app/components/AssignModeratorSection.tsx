"use client";

import { useState, type FormEvent } from "react";
import { assignModerator, revokeModerator, ApiError } from "../../lib/api";
import { inputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";
import type { Dictionary, Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  dict: Dictionary;
  locale: Locale;
}

// M7a Slice C (ADR gerekmeyen bir uygulama-katmanı özelliği): atama
// DeleteAccountView.tsx'in AYNI reauth-form deseni (şifre + TOTP_REQUIRED
// hatası alınca beliren TOTP alanı) - kalıcı bir yetki değişikliği,
// deleteAccount'la aynı hassasiyet sınıfı. Kaldırma reauth İSTEMİYOR
// (yetki azaltan yön kendi kendini iyileştiren bir hata).
export default function AssignModeratorSection({
  accessToken,
  dict,
  locale,
}: Props) {
  const [assignEmail, setAssignEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [revokeEmail, setRevokeEmail] = useState("");
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignError(null);
    setAssignSuccess(null);
    setIsAssigning(true);
    try {
      const result = await assignModerator(
        accessToken,
        assignEmail,
        password,
        totpRequired ? totpCode : undefined,
      );
      setAssignSuccess(
        result.alreadyModerator
          ? dict.assignModerator.assignSuccessAlreadyModerator
          : dict.assignModerator.assignSuccessAssigned,
      );
      setAssignEmail("");
      setPassword("");
      setTotpCode("");
      setTotpRequired(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") {
        setTotpRequired(true);
      } else {
        setAssignError(
          err instanceof ApiError
            ? (translateErrorCode(err.code, locale) ?? err.message)
            : dict.common.connectionError,
        );
      }
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRevoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRevokeError(null);
    setRevokeSuccess(null);
    setIsRevoking(true);
    try {
      const result = await revokeModerator(accessToken, revokeEmail);
      setRevokeSuccess(
        result.wasNotModerator
          ? dict.assignModerator.revokeSuccessWasNotModerator
          : dict.assignModerator.revokeSuccessRevoked,
      );
      setRevokeEmail("");
    } catch (err) {
      setRevokeError(
        err instanceof ApiError
          ? (translateErrorCode(err.code, locale) ?? err.message)
          : dict.common.connectionError,
      );
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <section className="mt-8 border-t border-neutral-800 pt-4">
      <h3 className="mb-4 text-neutral-400">
        <span className="text-muted">#</span> {dict.assignModerator.heading}
      </h3>

      <form onSubmit={handleAssign} className="mb-6 flex flex-col gap-3">
        <p className="text-muted">{dict.assignModerator.assignPrompt}</p>
        <label className="flex flex-col gap-1 text-muted">
          {dict.common.emailLabel}
          <input
            type="email"
            data-testid="assign-moderator-email-input"
            value={assignEmail}
            onChange={(event) => setAssignEmail(event.target.value)}
            required
            className={inputClassName}
          />
        </label>
        <PasswordInput
          label={dict.assignModerator.yourPasswordLabel}
          dict={dict}
          testId="assign-moderator-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {totpRequired && (
          <label className="flex flex-col gap-1 text-muted">
            {dict.common.authenticatorCodeLabel}
            <input
              type="text"
              data-testid="assign-moderator-totp-code-input"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- TOTP_REQUIRED hatası sonrası beliren alan, sürpriz odak sıçraması değil.
              autoFocus
              className={inputClassName}
            />
          </label>
        )}
        {assignError && (
          <p data-testid="assign-moderator-assign-error-message" className="text-red-400">
            {assignError}
          </p>
        )}
        {assignSuccess && (
          <p data-testid="assign-moderator-assign-success-message" className="text-neutral-200">
            {assignSuccess}
          </p>
        )}
        <button
          type="submit"
          data-testid="assign-moderator-assign-button"
          disabled={isAssigning}
          className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {dict.assignModerator.assignButton}
        </button>
      </form>

      <form onSubmit={handleRevoke} className="flex flex-col gap-3">
        <p className="text-muted">{dict.assignModerator.revokePrompt}</p>
        <label className="flex flex-col gap-1 text-muted">
          {dict.common.emailLabel}
          <input
            type="email"
            data-testid="assign-moderator-revoke-email-input"
            value={revokeEmail}
            onChange={(event) => setRevokeEmail(event.target.value)}
            required
            className={inputClassName}
          />
        </label>
        {revokeError && (
          <p data-testid="assign-moderator-revoke-error-message" className="text-red-400">
            {revokeError}
          </p>
        )}
        {revokeSuccess && (
          <p data-testid="assign-moderator-revoke-success-message" className="text-neutral-200">
            {revokeSuccess}
          </p>
        )}
        <button
          type="submit"
          data-testid="assign-moderator-revoke-button"
          disabled={isRevoking}
          className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {dict.assignModerator.revokeButton}
        </button>
      </form>
    </section>
  );
}
