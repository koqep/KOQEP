"use client";

import { useState, type FormEvent } from "react";
import { createRoom, ApiError, type Room } from "../../lib/api";
import { filledInputClassName } from "./formStyles";

interface Props {
  accessToken: string;
  onCreated: (room: Room) => void;
}

// create-room.dto.ts'teki MAX_ROOM_NAME_LENGTH/MAX_ROOM_DESCRIPTION_LENGTH
// ile birebir aynı - RoomView.tsx'in MAX_MESSAGE_LENGTH için zaten kurduğu
// aynı "küçük sabiti frontend/backend arasında kopyala" deseni (ADR-0002:
// web istemcisi iş mantığı sahibi değil, sunucu tarafı zaten doğruluyor).
const MAX_ROOM_NAME_LENGTH = 60;
const MAX_ROOM_DESCRIPTION_LENGTH = 200;
const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default function CreateRoomView({ accessToken, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ROOM_NAME_PATTERN.test(name)) {
      setError("Room name can only contain letters, numbers, - and _.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const room = await createRoom(accessToken, name, description.trim());
      onCreated(room);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("You can create at most 1 room per day. Try again later.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("A room with this name already exists.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Connection error. Try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-muted">
          room name
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
          description (optional)
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_ROOM_DESCRIPTION_LENGTH}
            className={filledInputClassName}
          />
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || name.length === 0}
          className="self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          create
        </button>
      </form>
    </section>
  );
}
