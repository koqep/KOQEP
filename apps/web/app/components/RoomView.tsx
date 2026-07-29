"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { logout } from "../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const MAX_MESSAGE_LENGTH = 2000;

interface Room {
  id: string;
  name: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorEmail: string | null;
}

interface Props {
  accessToken: string;
  refreshToken: string;
  onLoggedOut: () => void;
}

export default function RoomView({
  accessToken,
  refreshToken,
  onLoggedOut,
}: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isReady, setIsReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function bootstrap() {
      try {
        const authHeaders = { Authorization: `Bearer ${accessToken}` };

        const roomsResponse = await fetch(`${API_URL}/rooms`, {
          headers: authHeaders,
        });
        if (!roomsResponse.ok || cancelled) return;
        const rooms = (await roomsResponse.json()) as Room[];
        const activeRoom = rooms[0];
        if (!activeRoom || cancelled) return;
        setRoom(activeRoom);

        const historyResponse = await fetch(
          `${API_URL}/rooms/${activeRoom.name}/messages`,
          { headers: authHeaders },
        );
        if (historyResponse.ok && !cancelled) {
          const page = (await historyResponse.json()) as {
            messages: Message[];
          };
          setMessages(page.messages);
        }

        socket = io(API_URL, { auth: { token: accessToken } });
        socketRef.current = socket;

        socket.on("ready", () => {
          if (!cancelled) setIsReady(true);
        });
        socket.on("message:new", (message: Message) => {
          if (!cancelled) setMessages((prev) => [...prev, message]);
        });
      } catch {
        // API'ye ulaşılamıyor: sayfa boş/statik durumda kalır, çökmez.
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [accessToken]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (
      !content ||
      content.length > MAX_MESSAGE_LENGTH ||
      !socketRef.current
    ) {
      return;
    }
    socketRef.current.emit("message:send", { content });
    setDraft("");
  }

  async function handleLogout() {
    socketRef.current?.close();
    try {
      await logout(refreshToken);
    } catch {
      // Çıkış API çağrısı başarısız olsa da yerel oturumu kapat - kullanıcı
      // takılıp kalmasın, sunucu tarafı token zaten süresi dolunca geçersiz olur.
    }
    onLoggedOut();
  }

  const canSend = isReady && draft.trim().length > 0;

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-2xl flex-col p-4">
      <header className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <h1 className="text-neutral-400">
          <span className="text-neutral-600">#</span>
          {room?.name ?? "..."}
        </h1>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-neutral-600 hover:text-neutral-400"
        >
          çıkış
        </button>
      </header>

      <section className="flex-1 overflow-y-auto py-4 text-neutral-500">
        {messages.length === 0 ? (
          <p>henüz mesaj yok</p>
        ) : (
          <ul className="space-y-1">
            {messages.map((message) => (
              <li key={message.id} className="text-neutral-200">
                {message.content}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-neutral-800 pt-2"
      >
        <span className="text-neutral-600">&gt;</span>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!isReady}
          placeholder="mesaj yaz..."
          className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-600 outline-none disabled:cursor-not-allowed"
        />
        <span
          className="terminal-cursor inline-block h-4 w-2 bg-neutral-400"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="text-neutral-600 disabled:cursor-not-allowed"
        >
          gönder
        </button>
      </form>
    </main>
  );
}
