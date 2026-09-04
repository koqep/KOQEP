"use client";

import { useState, type FormEvent } from "react";
import { deleteAccount, ApiError } from "../../lib/api";
import { filledInputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";
import type { Dictionary, Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  onDeleted: () => void;
  dict: Dictionary;
  locale: Locale;
}

export default function DeleteAccountView({
  accessToken,
  onDeleted,
  dict,
  locale,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  // M6c Slice B (ADR-0005 Addendum #2): varsayılan AÇIK - kullanıcı ne
  // yazdığını bilen tek taraf, otomatik taramanın (Slice C) kaçıracağı
  // bağlamsal kimlik ifşasını kapatan asıl mekanizma bu.
  const [redactMessageContent, setRedactMessageContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await deleteAccount(
        accessToken,
        password,
        totpRequired ? totpCode : undefined,
        redactMessageContent,
      );
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOTP_REQUIRED") {
          setTotpRequired(true);
        } else {
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
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      {confirming ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-red-400">{dict.deleteAccount.permanentWarning}</p>
          <label className="flex items-start gap-2 text-muted">
            <input
              type="checkbox"
              checked={redactMessageContent}
              onChange={(event) =>
                setRedactMessageContent(event.target.checked)
              }
              className="mt-1"
            />
            <span>{dict.deleteAccount.redactCheckboxLabel}</span>
          </label>
          <PasswordInput
            label={dict.deleteAccount.currentPasswordLabel}
            dict={dict}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            filled
            // eslint-disable-next-line jsx-a11y/no-autofocus -- "delete my account"a tıklandıktan sonra beliren onay alanı, sürpriz odak sıçraması değil.
            autoFocus
          />
          {totpRequired && (
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
          )}
          {error && <p className="text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 self-start border border-red-900 px-4 py-1.5 text-red-400 hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {dict.deleteAccount.submitButton}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p>{dict.deleteAccount.preConfirmParagraph}</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="self-start border border-red-900 px-4 py-1.5 text-red-400 hover:border-red-700"
          >
            {dict.deleteAccount.deleteButton}
          </button>
        </div>
      )}
    </section>
  );
}
