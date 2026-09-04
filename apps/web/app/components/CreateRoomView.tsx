"use client";

import { useState, type FormEvent } from "react";
import { createRoom, ApiError, type Room } from "../../lib/api";
import { filledInputClassName } from "./formStyles";
import PasswordInput from "./PasswordInput";
import { interpolate, type Dictionary, type Locale } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  onCreated: (room: Room) => void;
  dict: Dictionary;
  locale: Locale;
}

// create-room.dto.ts'teki MAX_ROOM_NAME_LENGTH/MAX_ROOM_DESCRIPTION_LENGTH/
// MIN_ROOM_PASSWORD_LENGTH/MAX_ROOM_PASSWORD_LENGTH ile birebir aynı -
// RoomView.tsx'in MAX_MESSAGE_LENGTH için zaten kurduğu aynı "küçük
// sabiti frontend/backend arasında kopyala" deseni (ADR-0002: web
// istemcisi iş mantığı sahibi değil, sunucu tarafı zaten doğruluyor).
const MAX_ROOM_NAME_LENGTH = 60;
const MAX_ROOM_DESCRIPTION_LENGTH = 200;
const MIN_ROOM_PASSWORD_LENGTH = 8;
const MAX_ROOM_PASSWORD_LENGTH = 200;
const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default function CreateRoomView({
  accessToken,
  onCreated,
  dict,
  locale,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ROOM_NAME_PATTERN.test(name)) {
      setError(dict.createRoom.nameInvalidError);
      return;
    }
    if (password.length > 0 && password.length < MIN_ROOM_PASSWORD_LENGTH) {
      setError(
        interpolate(dict.createRoom.passwordTooShortError, {
          min: MIN_ROOM_PASSWORD_LENGTH,
        }),
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const room = await createRoom(
        accessToken,
        name,
        description.trim(),
        password,
      );
      onCreated(room);
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        // Backend'in jenerik RATE_LIMITED metni yerine dosyanın kendi
        // daha bilgilendirici mesajı KORUNUYOR (translateErrorCode'un
        // genel girdisini bilerek EZİYOR - AuthView'ın TOTP_REQUIRED
        // override'ıyla aynı desen).
        setError(dict.createRoom.dailyLimitError);
      } else if (err instanceof ApiError) {
        setError(translateErrorCode(err.code, locale) ?? err.message);
      } else {
        setError(dict.common.connectionError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-muted">
          {dict.createRoom.roomNameLabel}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_ROOM_NAME_LENGTH}
            required
            className={filledInputClassName}
          />
        </label>
        <label className="flex flex-col gap-1 text-muted">
          {dict.createRoom.descriptionLabel}
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_ROOM_DESCRIPTION_LENGTH}
            className={filledInputClassName}
          />
        </label>
        <PasswordInput
          label={dict.createRoom.passwordLabel}
          dict={dict}
          filled
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={MAX_ROOM_PASSWORD_LENGTH}
        />
        {error && <p className="text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || name.length === 0}
          className="self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {dict.createRoom.createButton}
        </button>
      </form>
    </section>
  );
}
