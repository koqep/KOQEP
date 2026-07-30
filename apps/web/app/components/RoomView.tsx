"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { logout } from "../../lib/api";
import TotpSettingsView from "./TotpSettingsView";
import BlockedUsersView from "./BlockedUsersView";

type ActivePanel = "none" | "totp" | "blocked";

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
  roomId: string;
}

interface Props {
  accessToken: string;
  refreshToken: string;
  initialTotpEnabled: boolean;
  onLoggedOut: () => void;
}

export default function RoomView({
  accessToken,
  refreshToken,
  initialTotpEnabled,
  onLoggedOut,
}: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id ?? null;
  }, [activeRoom]);

  async function fetchRoomHistory(
    roomName: string,
    authHeaders: HeadersInit,
  ): Promise<Message[] | null> {
    const historyResponse = await fetch(
      `${API_URL}/rooms/${roomName}/messages`,
      { headers: authHeaders },
    );
    if (!historyResponse.ok) return null;
    const page = (await historyResponse.json()) as { messages: Message[] };
    return page.messages;
  }

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
        const fetchedRooms = (await roomsResponse.json()) as Room[];
        const firstRoom = fetchedRooms[0];
        if (!firstRoom || cancelled) return;
        setRooms(fetchedRooms);
        setActiveRoom(firstRoom);

        const history = await fetchRoomHistory(firstRoom.name, authHeaders);
        if (history && !cancelled) setMessages(history);

        socket = io(API_URL, { auth: { token: accessToken } });
        socketRef.current = socket;

        socket.on("ready", () => {
          if (!cancelled) setIsReady(true);
        });
        socket.on("message:new", (message: Message) => {
          if (!cancelled && message.roomId === activeRoomIdRef.current) {
            setMessages((prev) => [...prev, message]);
          }
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

  async function handleRoomSwitch(next: Room) {
    if (next.id === activeRoom?.id) return;
    setActiveRoom(next);
    setDraft("");

    const generation = ++fetchGenerationRef.current;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const history = await fetchRoomHistory(next.name, authHeaders);
    if (fetchGenerationRef.current !== generation) return;
    setMessages(history ?? []);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (
      !content ||
      content.length > MAX_MESSAGE_LENGTH ||
      !socketRef.current ||
      !activeRoom
    ) {
      return;
    }
    socketRef.current.emit("message:send", {
      content,
      roomName: activeRoom.name,
    });
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
        <nav className="flex items-center gap-3">
          {rooms.length === 0 ? (
            <span className="text-neutral-400">
              <span className="text-neutral-600">#</span>...
            </span>
          ) : (
            rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void handleRoomSwitch(r)}
                className={
                  r.id === activeRoom?.id
                    ? "text-neutral-200"
                    : "text-neutral-600 hover:text-neutral-400"
                }
              >
                <span className="text-neutral-600">#</span>
                {r.name}
              </button>
            ))
          )}
        </nav>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActivePanel("totp")}
            className="text-neutral-600 hover:text-neutral-400"
          >
            iki adımlı doğrulama
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("blocked")}
            className="text-neutral-600 hover:text-neutral-400"
          >
            engellenenler
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-neutral-600 hover:text-neutral-400"
          >
            çıkış
          </button>
        </div>
      </header>

      {activePanel === "totp" ? (
        <TotpSettingsView
          accessToken={accessToken}
          initialEnabled={totpEnabled}
          onEnabledChange={setTotpEnabled}
          onClose={() => setActivePanel("none")}
        />
      ) : activePanel === "blocked" ? (
        <BlockedUsersView
          accessToken={accessToken}
          onClose={() => setActivePanel("none")}
        />
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}
