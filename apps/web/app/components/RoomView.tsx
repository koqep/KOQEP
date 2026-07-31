"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import {
  logout,
  getCurrentUser,
  getMessageEditHistory,
  type UserProfile,
  type MessageEdit,
} from "../../lib/api";
import TotpSettingsView from "./TotpSettingsView";
import BlockedUsersView from "./BlockedUsersView";
import InviteView from "./InviteView";
import DeleteAccountView from "./DeleteAccountView";
import MessageItem from "./MessageItem";

type ActivePanel = "none" | "totp" | "blocked" | "invites" | "delete-account";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const MAX_MESSAGE_LENGTH = 2000;

interface Room {
  id: string;
  name: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
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
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<Room | null>(null);
  const fetchGenerationRef = useRef(0);
  const hasConnectedBeforeRef = useRef(false);

  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id ?? null;
    activeRoomRef.current = activeRoom;
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

  // Yeniden bağlanınca (bkz. "ready" dinleyicisi) mevcut aktif odanın
  // geçmişini yeniden çekip id'ye göre birleştiriyor - kör bir replace
  // DEĞİL, çünkü DEFAULT_PAGE_SIZE (50) nedeniyle uzun bir oturumda
  // gerçek-zamanlı biriken mesajlar görünmez şekilde budanabilir. Aynı
  // zamanda bağlantı kesikken yapılan düzenlemeleri de yakalıyor (fetch
  // edilen taze veri kazanıyor).
  function mergeMessagesById(previous: Message[], fresh: Message[]): Message[] {
    const byId = new Map(previous.map((message) => [message.id, message]));
    for (const message of fresh) {
      byId.set(message.id, message);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function bootstrap() {
      try {
        const authHeaders = { Authorization: `Bearer ${accessToken}` };

        // Sadece burada, "ready" dinleyicisinden kullanılıyor - dışarı
        // taşımaya gerek yok (fetchRoomHistory'nin aksine, handleRoomSwitch
        // da onu ayrıca kullanıyor).
        async function backfillActiveRoom() {
          const room = activeRoomRef.current;
          if (!room) return;
          const generation = ++fetchGenerationRef.current;
          const fresh = await fetchRoomHistory(room.name, authHeaders);
          // Geri dolum sırasında kullanıcı elle oda değiştirdiyse (ya da
          // yeni bir bağlantı kaybı/geri dolum başladıysa) bu artık bayat
          // sonucu uygulama - handleRoomSwitch'in zaten kullandığı desen.
          if (!fresh || fetchGenerationRef.current !== generation) return;
          setMessages((previous) => mergeMessagesById(previous, fresh));
        }

        getCurrentUser(accessToken)
          .then((profile) => {
            if (!cancelled) setMyProfile(profile);
          })
          .catch(() => {
            // Profil alınamazsa düzenle/geçmiş butonları hiç görünmez -
            // sohbetin geri kalanı bundan bağımsız çalışmaya devam eder.
          });

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
          if (cancelled) return;
          setIsReady(true);
          if (hasConnectedBeforeRef.current) {
            // İlk bağlantı değil - "ready" bir yeniden bağlanma sonrası
            // tekrar geldi (handleConnection her gerçek yeniden bağlanmada
            // yeniden tetikleniyor). Bağlantı kesikken kaçırılan mesajları
            // geri doldur.
            void backfillActiveRoom();
          } else {
            hasConnectedBeforeRef.current = true;
          }
        });
        socket.on("message:new", (message: Message) => {
          if (!cancelled && message.roomId === activeRoomIdRef.current) {
            setMessages((prev) => [...prev, message]);
          }
        });
        socket.on("message:updated", (message: Message) => {
          if (!cancelled && message.roomId === activeRoomIdRef.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === message.id ? message : m)),
            );
          }
        });
        socket.on("exception", (payload: { code?: string }) => {
          if (cancelled) return;
          setIsSending(false);
          if (payload?.code === "RATE_LIMITED") {
            setSendError("Çok hızlı mesaj gönderiyorsun, biraz yavaşla.");
          } else if (payload?.code === "MESSAGE_TOO_LONG") {
            setSendError(
              `Mesaj çok uzun (maksimum ${MAX_MESSAGE_LENGTH} karakter).`,
            );
          } else {
            setSendError("Mesaj gönderilemedi.");
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
    setActivePanel("none");
    if (next.id === activeRoom?.id) return;
    setActiveRoom(next);
    setDraft("");

    const generation = ++fetchGenerationRef.current;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const history = await fetchRoomHistory(next.name, authHeaders);
    if (fetchGenerationRef.current !== generation) return;
    setMessages(history ?? []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !socketRef.current || !activeRoom || isSending) {
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Mesaj çok uzun (maksimum ${MAX_MESSAGE_LENGTH} karakter).`);
      return;
    }

    setSendError(null);
    setIsSending(true);
    setDraft("");
    try {
      // .timeout() zorunlu: düz .emit'in ack callback'i disconnect anında
      // sessizce kaybolur (socket.io-client kaynağında doğrulandı) -
      // isSending sonsuza kadar takılı kalabilir. exception dinleyicisi
      // hızlı yol (RATE_LIMITED/MESSAGE_TOO_LONG); bu, garantili-canlılık
      // yedeği (en kötü ihtimalle 8 saniyede state'i kurtarır).
      await socketRef.current
        .timeout(8000)
        .emitWithAck("message:send", { content, roomName: activeRoom.name });
    } catch {
      setSendError("Mesaj gönderilemedi, tekrar dene.");
    } finally {
      setIsSending(false);
    }
  }

  function handleMessageEdit(messageId: string, content: string) {
    socketRef.current?.emit("message:edit", { messageId, content });
  }

  function fetchHistoryForMessage(messageId: string): Promise<MessageEdit[]> {
    if (!activeRoom) return Promise.resolve([]);
    return getMessageEditHistory(accessToken, activeRoom.name, messageId);
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
            onClick={() => setActivePanel("invites")}
            className="text-neutral-600 hover:text-neutral-400"
          >
            invites
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("delete-account")}
            className="text-neutral-600 hover:text-red-400"
          >
            hesabı sil
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
      ) : activePanel === "invites" ? (
        <InviteView
          accessToken={accessToken}
          onClose={() => setActivePanel("none")}
        />
      ) : activePanel === "delete-account" ? (
        <DeleteAccountView
          accessToken={accessToken}
          onDeleted={onLoggedOut}
          onClose={() => setActivePanel("none")}
        />
      ) : (
        <>
          <section className="flex-1 overflow-y-auto py-4 text-neutral-500">
            {messages.length === 0 ? (
              <p>henüz mesaj yok</p>
            ) : (
              <ul className="space-y-1">
                {messages.map((message) => {
                  const isMine =
                    message.authorUsername !== null &&
                    message.authorUsername === myProfile?.username;
                  const canViewHistory =
                    isMine || myProfile?.role === "moderator";
                  return (
                    <MessageItem
                      key={message.id}
                      message={message}
                      isMine={isMine}
                      canViewHistory={canViewHistory}
                      onSubmitEdit={handleMessageEdit}
                      fetchHistory={fetchHistoryForMessage}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          {sendError && <p className="text-red-400">{sendError}</p>}
          <form
            onSubmit={(event) => void handleSubmit(event)}
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
              disabled={!canSend || isSending}
              className="text-neutral-600 disabled:cursor-not-allowed"
            >
              {isSending ? "gönderiliyor..." : "gönder"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
