"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { io, Socket } from "socket.io-client";
import {
  logout,
  getCurrentUser,
  getMessageEditHistory,
  listRooms,
  type UserProfile,
  type MessageEdit,
  type Room,
} from "../../lib/api";
import TotpSettingsView from "./TotpSettingsView";
import BlockedUsersView from "./BlockedUsersView";
import InviteView from "./InviteView";
import DeleteAccountView from "./DeleteAccountView";
import CreateRoomView from "./CreateRoomView";
import RoomHeader from "./RoomHeader";
import ChatPanel from "./ChatPanel";

type ActivePanel =
  | "none"
  | "totp"
  | "blocked"
  | "invites"
  | "delete-account"
  | "create-room";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const MAX_MESSAGE_LENGTH = 2000;

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
}

interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<Room | null>(null);
  const fetchGenerationRef = useRef(0);
  const hasConnectedBeforeRef = useRef(false);
  const messagesSectionRef = useRef<HTMLElement | null>(null);
  const pendingScrollAdjustmentRef = useRef<number | null>(null);

  // handleLoadOlder mesajları listenin BAŞINA ekliyor - hiçbir şey
  // yapılmazsa scroll görsel olarak aşağı "zıplar" (yeni içerik üstte
  // açılınca). scrollHeight farkını scrollTop'a ekleyip aynı mesajı
  // görünür tutuyor. Sadece pendingScrollAdjustmentRef set edildiğinde
  // çalışıyor - yeni mesaj/düzenleme gibi diğer `messages` güncellemeleri
  // için no-op.
  useLayoutEffect(() => {
    const section = messagesSectionRef.current;
    if (pendingScrollAdjustmentRef.current !== null && section) {
      section.scrollTop += section.scrollHeight - pendingScrollAdjustmentRef.current;
    }
    pendingScrollAdjustmentRef.current = null;
  }, [messages]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id ?? null;
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  async function fetchRoomHistory(
    roomName: string,
    authHeaders: HeadersInit,
    cursor?: string,
  ): Promise<MessagePage | null> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const historyResponse = await fetch(
      `${API_URL}/rooms/${roomName}/messages${query}`,
      { headers: authHeaders },
    );
    if (!historyResponse.ok) return null;
    return (await historyResponse.json()) as MessagePage;
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
          // nextCursor'a BİLEREK dokunmuyor - bu, geçmiş sayfalama değil,
          // bağlantı kesikken kaçırılan canlı mesajları yakalama amaçlı.
          if (!fresh || fetchGenerationRef.current !== generation) return;
          setMessages((previous) =>
            mergeMessagesById(previous, fresh.messages),
          );
        }

        getCurrentUser(accessToken)
          .then((profile) => {
            if (!cancelled) setMyProfile(profile);
          })
          .catch(() => {
            // Profil alınamazsa düzenle/geçmiş butonları hiç görünmez -
            // sohbetin geri kalanı bundan bağımsız çalışmaya devam eder.
          });

        const fetchedRooms = await listRooms(accessToken);
        if (cancelled) return;
        const firstRoom = fetchedRooms[0];
        if (!firstRoom || cancelled) return;
        setRooms(fetchedRooms);
        setActiveRoom(firstRoom);

        const history = await fetchRoomHistory(firstRoom.name, authHeaders);
        if (history && !cancelled) {
          setMessages(history.messages);
          setNextCursor(history.nextCursor);
        }

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
          } else if (payload?.code === "ROOM_ARCHIVED") {
            // Yedek yol - composer zaten activeRoom.status'a göre proaktif
            // devre dışı kalıyor, bu sadece WS round-trip'ini bekleyen
            // nadir bir yarış durumu için.
            setSendError("Bu oda arşivlenmiş, sadece okunabilir.");
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
    setMessages(history?.messages ?? []);
    setNextCursor(history?.nextCursor ?? null);
  }

  async function handleToggleShowArchived() {
    const next = !showArchived;
    setShowArchived(next);
    try {
      const fetchedRooms = await listRooms(accessToken, next);
      setRooms(fetchedRooms);
    } catch {
      // Sessizce yoksay - switcher eski listede kalır, sonraki reload'da düzelir.
    }
  }

  async function handleLoadOlder() {
    if (!activeRoom || !nextCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    const generation = ++fetchGenerationRef.current;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const page = await fetchRoomHistory(activeRoom.name, authHeaders, nextCursor);
    setIsLoadingOlder(false);
    if (!page || fetchGenerationRef.current !== generation) return;
    if (messagesSectionRef.current) {
      pendingScrollAdjustmentRef.current = messagesSectionRef.current.scrollHeight;
    }
    setMessages((previous) => [...page.messages, ...previous]);
    setNextCursor(page.nextCursor);
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

  const canSend =
    isReady &&
    draft.trim().length > 0 &&
    (activeRoom === null || activeRoom.status === "active");

  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-2xl flex-col p-4">
      <RoomHeader
        rooms={rooms}
        activeRoom={activeRoom}
        onRoomSwitch={(room) => void handleRoomSwitch(room)}
        onCreateRoomClick={() => setActivePanel("create-room")}
        showArchived={showArchived}
        onToggleShowArchived={() => void handleToggleShowArchived()}
        onOpenTotp={() => setActivePanel("totp")}
        onOpenBlocked={() => setActivePanel("blocked")}
        onOpenInvites={() => setActivePanel("invites")}
        onOpenDeleteAccount={() => setActivePanel("delete-account")}
        onLogout={() => void handleLogout()}
      />

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
      ) : activePanel === "create-room" ? (
        <CreateRoomView
          accessToken={accessToken}
          onCreated={(room) => {
            setRooms((prev) => [...prev, room]);
            setActivePanel("none");
            void handleRoomSwitch(room);
          }}
          onClose={() => setActivePanel("none")}
        />
      ) : (
        <ChatPanel
          messagesSectionRef={messagesSectionRef}
          messages={messages}
          myProfile={myProfile}
          onMessageEditSubmit={handleMessageEdit}
          fetchHistoryForMessage={fetchHistoryForMessage}
          nextCursor={nextCursor}
          isLoadingOlder={isLoadingOlder}
          onLoadOlder={() => void handleLoadOlder()}
          sendError={sendError}
          activeRoom={activeRoom}
          draft={draft}
          onDraftChange={setDraft}
          isReady={isReady}
          canSend={canSend}
          isSending={isSending}
          onSubmit={(event) => void handleSubmit(event)}
        />
      )}
    </main>
  );
}
