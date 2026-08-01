"use client";

import { useState, type FormEvent } from "react";
import { createRoom, ApiError, type Room } from "../../lib/api";

interface Props {
  accessToken: string;
  onCreated: (room: Room) => void;
  onClose: () => void;
}

// create-room.dto.ts'teki MAX_ROOM_NAME_LENGTH/MAX_ROOM_DESCRIPTION_LENGTH
// ile birebir aynı - RoomView.tsx'in MAX_MESSAGE_LENGTH için zaten kurduğu
// aynı "küçük sabiti frontend/backend arasında kopyala" deseni (ADR-0002:
// web istemcisi iş mantığı sahibi değil, sunucu tarafı zaten doğruluyor).
const MAX_ROOM_NAME_LENGTH = 60;
const MAX_ROOM_DESCRIPTION_LENGTH = 200;
const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default function CreateRoomView({
  accessToken,
  onCreated,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ROOM_NAME_PATTERN.test(name)) {
      setError("Oda adı sadece harf, rakam, - ve _ içerebilir.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const room = await createRoom(accessToken, name, description.trim());
      onCreated(room);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Günde en fazla 1 oda oluşturabilirsin. Daha sonra tekrar dene.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("Bu isimde bir oda zaten var.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Bağlantı hatası. Tekrar dene.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "border border-neutral-800 bg-transparent px-2 py-1 text-neutral-200 outline-none focus:border-neutral-600";

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-neutral-400">
          <span className="text-neutral-600">#</span> yeni oda
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-400"
        >
          kapat
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-neutral-500">
          oda adı
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_ROOM_NAME_LENGTH}
            required
            className={inputClassName}
          />
        </label>
        <label className="flex flex-col gap-1 text-neutral-500">
          açıklama (opsiyonel)
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_ROOM_DESCRIPTION_LENGTH}
            className={inputClassName}
          />
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || name.length === 0}
          className="self-start border border-neutral-800 px-3 py-1 text-neutral-400 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          oluştur
        </button>
      </form>
    </section>
  );
}
