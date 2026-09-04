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
  leaveRoom,
  reportMessage,
  listOpenReports,
  refreshAccessToken,
  type UserProfile,
  type MessageEdit,
  type Room,
} from "../../lib/api";
import {
  storeLocale,
  translations,
  DEFAULT_LOCALE,
  interpolate,
  type Dictionary,
  type Locale,
} from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";
import TotpSettingsView from "./TotpSettingsView";
import BlockedUsersView from "./BlockedUsersView";
import InviteView from "./InviteView";
import DeleteAccountView from "./DeleteAccountView";
import CreateRoomView from "./CreateRoomView";
import DiscoverRoomsView from "./DiscoverRoomsView";
import ModerationQueueView from "./ModerationQueueView";
import ProfileView from "./ProfileView";
import SettingsView from "./SettingsView";
import FeedbackView from "./FeedbackView";
import LanguageSettingsView from "./LanguageSettingsView";
import TopBar from "./TopBar";
import RoomSidebar from "./RoomSidebar";
import ChatPanel from "./ChatPanel";
import SidePanel, { SIDE_PANEL_TITLE_ID } from "./SidePanel";
import CenteredModal from "./CenteredModal";

// M10 Faz 2 Slice B: "sidebar" (mobil oda listesi overlay'i) diğer
// panellerle AYNI activePanel/requestClosePanel/SidePanel hattını
// kullanıyor - ayrı bir isSidebarOpen state'i Slice A'nın bulduğu iki
// gerçek bug'ı (containing-block, focus-restore) ikinci bir mekanizmada
// tekrar riske atardı. M10 Faz 2 Slice D+E: "profile" de AYNI hatta, ama
// bu türün EKSTRA bir bilgi (hangi kullanıcı) taşıması gerekiyor - bkz.
// aşağıdaki viewingProfileUsername.
// M13 Slice A: "sidebar"/"moderation" ESKİ SidePanel mekanizmasında
// kalıyor (kullanıcı onayı - navigasyon deseni/sık-aksiyonlu içerik,
// ortada-modal'a uygun değil), diğer paneller CenteredModal'a geçiyor -
// bkz. getPanelTitle.
// M13 Slice B: "settings" AccountMenu'nün eski 4 ayrı öğesinin (totp/
// blocked/invites/delete-account) yerine açılan bir gezinme paneli -
// SettingsView'daki bir satıra tıklamak activePanel'i DOĞRUDAN o hedefe
// çeviriyor (settings→totp gibi), CenteredModal UNMOUNT OLMUYOR (ikisi
// de AYNI ternary dalına düşüyor), sadece title/children değişiyor.
// M13 Slice C: "feedback" AccountMenu'de ÜST SEVİYEDE kalıyor (settings'in
// ALTINA taşınmadı, henüz gerçek bir panel değildi) ama artık doğrudan bir
// mailto: linki DEĞİL - AYNI CenteredModal mekanizmasıyla açılan statik
// bir panel (FeedbackView), gerçek mailto: linki panelin İÇİNDE.
type ActivePanel =
  | "none"
  | "totp"
  | "blocked"
  | "invites"
  | "delete-account"
  | "create-room"
  | "discover-rooms"
  | "moderation"
  | "sidebar"
  | "profile"
  | "settings"
  | "feedback"
  | "language";

type CenteredModalPanel = Exclude<ActivePanel, "none" | "sidebar" | "moderation">;

// CenteredModal'ın paylaşılan "KOQEP · {title}" başlığı için - eskiden
// her panel bileşeni kendi başlığını üretiyordu, artık şell'in
// sorumluluğu (bkz. CenteredModal.tsx). M9 Slice D1: statik bir
// `Record` yerine `dict.panelTitles`'tan okunuyor (bkz. i18n.ts) - EN
// değerleri bugünkü panel başlıklarıyla BİREBİR aynı, bu slice bir
// kopya değişikliği DEĞİL. activePanel'in kebab-case değerlerini
// dict.panelTitles'ın camelCase anahtarlarına eşliyor.
function getPanelTitle(panel: CenteredModalPanel, dict: Dictionary): string {
  const titles = dict.panelTitles;
  switch (panel) {
    case "totp":
      return titles.totp;
    case "blocked":
      return titles.blocked;
    case "invites":
      return titles.invites;
    case "delete-account":
      return titles.deleteAccount;
    case "create-room":
      return titles.createRoom;
    case "discover-rooms":
      return titles.discoverRooms;
    case "profile":
      return titles.profile;
    case "settings":
      return titles.settings;
    case "feedback":
      return titles.feedback;
    case "language":
      return titles.language;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export const MAX_MESSAGE_LENGTH = 2000;
const DRAFT_STORAGE_PREFIX = "koqep:draft:";
const DRAFT_STORAGE_DEBOUNCE_MS = 500;
// globals.css'in --motion-duration-base'iyle AYNI tutulmalı (M10 Faz 2
// Slice A) - CSS değişkeni JS'te doğrudan okunmuyor, ikisi elle senkron.
const PANEL_CLOSE_MS = 240;

function readDraftsFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const drafts: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue;
    const roomId = key.slice(DRAFT_STORAGE_PREFIX.length);
    const value = window.localStorage.getItem(key);
    if (value) drafts[roomId] = value;
  }
  return drafts;
}

function clearAllDraftsFromStorage() {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(DRAFT_STORAGE_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key);
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
  editedAt: string | null;
}

interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

interface Props {
  accessToken: string;
  initialTotpEnabled: boolean;
  onLoggedOut: () => void;
}

export default function RoomView({
  accessToken,
  initialTotpEnabled,
  onLoggedOut,
}: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    readDraftsFromStorage(),
  );
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [contentRemovedNotice, setContentRemovedNotice] = useState<
    string | null
  >(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  // M9 Slice D1: kendi state'i DEĞİL - myProfile.locale'den her render'da
  // türetilir (myProfile null iken DEFAULT_LOCALE'e düşer, storeLocale'in
  // localStorage'a yazdığı bootstrap-öncesi ipucundan BAĞIMSIZ - burası
  // SADECE User.locale otoriteyi yansıtır). `dict` bir PROP olarak
  // child'lara akar - `t(key)` fonksiyonu YOK (bkz. lib/i18n.ts).
  const locale: Locale = myProfile?.locale ?? DEFAULT_LOCALE;
  const dict: Dictionary = translations[locale];
  // Ayarlar→dil panelinin onLocaleChange callback'i - satır ~464/477/498'deki
  // partial-update deseniyle BİREBİR aynı (setMyProfile), + storeLocale ile
  // localStorage aynası güncellenir (RoomView'ın bootstrap effect'iyle AYNI
  // senkron kuralı).
  function handleLocaleChange(newLocale: Locale) {
    setMyProfile((prev) => (prev ? { ...prev, locale: newLocale } : prev));
    storeLocale(newLocale);
  }
  const [showArchived, setShowArchived] = useState(false);
  const [openReportCount, setOpenReportCount] = useState(0);
  // M10 Faz 2 Slice D+E: "profile" panel türünün taşıdığı ekstra bilgi -
  // mevcut 8 panel türünün hiçbiri buna ihtiyaç duymuyordu.
  const [viewingProfileUsername, setViewingProfileUsername] = useState<
    string | null
  >(null);
  const socketRef = useRef<Socket | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<Room | null>(null);
  const roomsRef = useRef<Room[]>([]);
  // M9 Slice D1: activeRoomRef'le AYNI gerekçe - bootstrap effect'i
  // `[accessToken]`'a bağlı, SADECE accessToken değişince yeniden
  // çalışıyor. WS `exception` handler'ı locale'i OKUMASI gerektiği için
  // (dil değişince mesajlar da değişsin diye) bir ref'ten okuyor, kendi
  // closure'ındaki (mount anındaki) bayat `locale` değerinden değil.
  const localeRef = useRef<Locale>(locale);
  const fetchGenerationRef = useRef(0);
  const hasConnectedBeforeRef = useRef(false);
  const messagesSectionRef = useRef<HTMLElement | null>(null);
  const pendingScrollAdjustmentRef = useRef<number | null>(null);
  const draftDebounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const panelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // M10 Faz 2 Slice A: panelin kendi "close" butonu, backdrop tıklaması,
  // Escape VE oda değiştirme/oluşturma sırasında panel açıksa - HEPSİ bu
  // TEK yoldan geçiyor, böylece kapanış her zaman animasyonlu (SidePanel'in
  // isClosing prop'u) ve tutarlı oluyor.
  function requestClosePanel() {
    if (activePanel === "none" || isPanelClosing) return;
    setIsPanelClosing(true);
    panelCloseTimerRef.current = setTimeout(() => {
      setActivePanel("none");
      setIsPanelClosing(false);
      panelCloseTimerRef.current = null;
    }, PANEL_CLOSE_MS);
  }

  // M10 Faz 2 Slice D+E: hesap▾ menüsündeki "profile" (kendi profili) VE
  // bir mesajın grup-başı etiketine tıklamak (başkasının profili) AYNI
  // fonksiyonu çağırıyor - kod tekrarı yok.
  function handleViewProfile(username: string) {
    setViewingProfileUsername(username);
    setActivePanel("profile");
  }

  useEffect(() => {
    return () => {
      if (panelCloseTimerRef.current) clearTimeout(panelCloseTimerRef.current);
    };
  }, []);

  // drafts state bellek-içi kaynak-doğruluk; localStorage yazımı her tuş
  // vuruşunda değil, oda başına debounce'lu (500ms) - sekme kapanması/
  // tarayıcı çökmesi senaryosunu da kapsayan ikinci bir kalıcılık katmanı.
  function setRoomDraft(roomId: string, value: string) {
    setDrafts((prev) => ({ ...prev, [roomId]: value }));
    const timers = draftDebounceTimersRef.current;
    if (timers[roomId]) clearTimeout(timers[roomId]);
    timers[roomId] = setTimeout(() => {
      if (typeof window === "undefined") return;
      const key = DRAFT_STORAGE_PREFIX + roomId;
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    }, DRAFT_STORAGE_DEBOUNCE_MS);
  }

  // Bir odanın taslağını hem bellekten hem localStorage'dan HEMEN temizler
  // (gönderim sonrası, odadan ayrılınca, oda silinince) - bekleyen bir
  // debounce yazımı varsa onu da iptal eder (yoksa eski değer gecikmeli
  // olarak geri yazılabilirdi).
  function clearRoomDraft(roomId: string) {
    const timers = draftDebounceTimersRef.current;
    if (timers[roomId]) {
      clearTimeout(timers[roomId]);
      delete timers[roomId];
    }
    setDrafts((prev) => {
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_PREFIX + roomId);
    }
  }

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

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  // M5 Slice D: room:deleted dinleyicisi bir yedek odaya geçerken GÜNCEL
  // oda listesine ihtiyaç duyuyor - state'in kendisi yerine ref üzerinden
  // (activeRoomRef/activeRoomIdRef ile AYNI desen).
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // M5 Slice B: mutedUntil sadece mount'ta ve WS push'larında güncelleniyor
  // - süre doğal olarak dolduğunda hiçbir re-render tetiklenmez (sessiz bir
  // oda, başka WS trafiği yoksa composer süresiz devre dışı kalabilirdi).
  // mutedUntil'e kadar bir zamanlayıcı kurup boş bir re-render tetikliyoruz,
  // isMuted (aşağıda) yeniden hesaplanır.
  useEffect(() => {
    const mutedUntil = myProfile?.mutedUntil;
    if (!mutedUntil) return;
    const ms = new Date(mutedUntil).getTime() - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(() => {
      setMyProfile((prev) => (prev ? { ...prev } : prev));
    }, ms);
    return () => clearTimeout(timer);
  }, [myProfile?.mutedUntil]);

  // M10 Faz 2 Slice B: TopBar'ın "moderation [N]" rozeti - yeni bir backend
  // count endpoint'i/WS event'i yok, mevcut listOpenReports() zaten tüm
  // listeyi döndürüyor. Moderatör kuyruğu AÇIKKEN ModerationQueueView'ın
  // kendi onQueueCountChange'i bunu anlık günceller; kapalıyken en-son-
  // açılıştaki (ya da mount'taki) kadar taze kalır - kabul edilebilir bir
  // sınırlama, yeni bir işlem gerektirmiyor. Moderatör OLMAYAN durumda
  // effect'in içinde senkron setState ÇAĞRILMIYOR (React'in yeni "effect
  // içinde senkron setState kademeli render'a yol açar" kuralı) - "0" hâli
  // aşağıdaki JSX'te render anında türetiliyor (bkz. openReportCount kullanımı).
  useEffect(() => {
    if (myProfile?.role !== "moderator") return;
    let cancelled = false;
    listOpenReports(accessToken)
      .then((reports) => {
        if (!cancelled) setOpenReportCount(reports.length);
      })
      .catch(() => {
        // Sessizce yoksay - rozet 0 kalır, moderatör kuyruğu açınca zaten güncellenir.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, myProfile?.role]);

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
            // M9 Slice B: giriş sonrası localStorage artık sadece bir ayna -
            // User.locale otorite, buraya SADECE senkron tutmak için yazılır.
            storeLocale(profile.locale);
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

        // KRİTİK, 2026-08-27: apps/api'nin handleConnection'ı
        // (messages.gateway.ts) süresi dolmuş/geçersiz bir access token'la
        // gelen bağlantıyı SESSİZCE disconnect ediyor - hiçbir hata event'i
        // yok. Bu, engine.io bağlantısı KURULDUKTAN sonra (auth kontrolü
        // handleConnection'ın İÇİNDE) olduğu için client'ta "connect_error"
        // DEĞİL "disconnect" (reason: "io server disconnect") olarak
        // görünüyor - GERÇEK bir Playwright koşumuyla ölçülüp doğrulandı
        // (ilk taslak yanlışlıkla "connect_error" dinliyordu). socket.io-
        // client'ın kendi dokümantasyonu: "io server disconnect" nedeniyle
        // kapanan bir bağlantıda otomatik-yeniden-bağlanma BİLEREK devre
        // dışı - client'ın kendisi socket.connect()'i MANUEL çağırmalı.
        // Sonuç: isReady KALICI false kalır, composer süresiz "disabled"
        // görünür, HİÇBİR yeniden deneme bile olmaz (production'da GERÇEKTEN
        // yaşandı - "yasak/uyarı" imleci, kutu devre dışı). Gerçek bir authed
        // HTTP çağrısının (authedGetJson/authedPostJson) zaten yaptığı 401->
        // refreshAccessToken() akışının AYNISI burada da tetikleniyor: refresh
        // başarılı olursa onAccessTokenRefreshed (page.tsx) accessToken
        // state'ini günceller, bu effect [accessToken] bağımlılığı yüzünden
        // YENİDEN çalışıp TAZE token'la BAMBAŞKA bir socket kurar (manuel
        // socket.connect() GEREKMİYOR - aşağıdaki cleanup zaten eski,
        // bağlantısı kesik socket'i kapatır). Refresh de başarısız olursa
        // (refresh token da geçersiz) - projenin var olan deseniyle AYNI
        // şekilde sessizce yutuluyor (bkz. getCurrentUser'ın catch'i) -
        // kullanıcı bir sonraki authed HTTP isteğinde zaten normal 401
        // akışıyla karşılaşacak.
        socket.on("disconnect", (reason) => {
          if (cancelled || reason !== "io server disconnect") return;
          refreshAccessToken().catch(() => {
            // Sessizce yoksay - bkz. yukarıdaki yorum.
          });
        });

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
        // M5 Slice B: moderatör mute/unmute uyguladığı ANDA, deneme
        // yapmadan gerçek zamanlı bildirim - myProfile TEK kaynak, ayrı bir
        // state yok.
        socket.on(
          "moderation:muted",
          (payload: { mutedUntil: string; reason: string }) => {
            if (cancelled) return;
            setMyProfile((prev) =>
              prev
                ? {
                    ...prev,
                    mutedUntil: payload.mutedUntil,
                    muteReason: payload.reason,
                  }
                : prev,
            );
          },
        );
        socket.on("moderation:unmuted", () => {
          if (cancelled) return;
          setMyProfile((prev) =>
            prev ? { ...prev, mutedUntil: null, muteReason: null } : prev,
          );
        });
        // M7b Slice D2: broadcastMessageUpdate'in (herkes görür) AYRI,
        // SADECE yazara giden hedefe-özel bildirim - hesap-seviyesinde,
        // aktif odadan bağımsız (room-switch'te OTOMATİK temizlenmiyor).
        socket.on(
          "moderation:content-removed",
          (payload: { reason: string }) => {
            if (cancelled) return;
            setContentRemovedNotice(payload.reason);
          },
        );
        // M7a Slice C: moderatör atandığında/kaldırıldığında "moderasyon"
        // butonunun bir sonraki reconnect'e kadar beklemeden anlık
        // görünmesi/kaybolması için - mute/unmute'un AYNI deseni.
        socket.on(
          "moderation:role-changed",
          (payload: { role: "user" | "moderator" }) => {
            if (cancelled) return;
            setMyProfile((prev) =>
              prev ? { ...prev, role: payload.role } : prev,
            );
          },
        );
        // M5 Slice D: oda-geneli moderatör aksiyonları - HERKES için (sadece
        // moderatör değil), moderatörün kendi soketi de aynı odaya join'li
        // olduğu için AYNI broadcast'i alıyor - ayrı bir REST-response-
        // tetikli senkronizasyona gerek yok.
        socket.on(
          "room:renamed",
          (payload: { roomId: string; name: string }) => {
            if (cancelled) return;
            setRooms((prev) =>
              prev.map((r) =>
                r.id === payload.roomId ? { ...r, name: payload.name } : r,
              ),
            );
            setActiveRoom((prev) =>
              prev && prev.id === payload.roomId
                ? { ...prev, name: payload.name }
                : prev,
            );
          },
        );
        // M7b Slice H2: room:renamed'ın AYNI desen.
        socket.on(
          "room:announcement-updated",
          (payload: { roomId: string; announcement: string | null }) => {
            if (cancelled) return;
            setRooms((prev) =>
              prev.map((r) =>
                r.id === payload.roomId
                  ? { ...r, announcement: payload.announcement }
                  : r,
              ),
            );
            setActiveRoom((prev) =>
              prev && prev.id === payload.roomId
                ? { ...prev, announcement: payload.announcement }
                : prev,
            );
          },
        );
        socket.on("room:archived", (payload: { roomId: string }) => {
          if (cancelled) return;
          setRooms((prev) =>
            prev.map((r) =>
              r.id === payload.roomId
                ? { ...r, status: "archived" as const }
                : r,
            ),
          );
          setActiveRoom((prev) =>
            prev && prev.id === payload.roomId
              ? { ...prev, status: "archived" as const }
              : prev,
          );
          // ChatPanel.tsx zaten activeRoom.status !== "active" iken
          // composer'ı salt-okunur yapıyor - herkes için ücretsiz, yeni bir
          // UI dalı gerekmiyor.
        });
        socket.on("room:deleted", (payload: { roomId: string }) => {
          if (cancelled) return;
          const next = roomsRef.current.filter((r) => r.id !== payload.roomId);
          setRooms(next);
          if (activeRoomIdRef.current === payload.roomId) {
            const fallback = next[0] ?? null;
            setActiveRoom(fallback);
            clearRoomDraft(payload.roomId);
            if (fallback) {
              const generation = ++fetchGenerationRef.current;
              void fetchRoomHistory(fallback.name, authHeaders).then(
                (fresh) => {
                  if (cancelled || fetchGenerationRef.current !== generation) {
                    return;
                  }
                  setMessages(fresh?.messages ?? []);
                  setNextCursor(fresh?.nextCursor ?? null);
                },
              );
            } else {
              setMessages([]);
              setNextCursor(null);
            }
          }
        });
        socket.on(
          "exception",
          (payload: { code?: string; mutedUntil?: string }) => {
            if (cancelled) return;
            setIsSending(false);
            // M9 Slice D1: tüm kodlar TEK bir sözlükten (error-messages.ts)
            // akıyor - MUTED'ın mutedUntil yan etkisi ve MESSAGE_TOO_LONG'un
            // {max} interpolasyonu ayrı ele alınıyor, geri kalan (eskiden
            // eksik olan MESSAGE_INVALID_CONTENT/ROOM_ACCESS_DENIED dahil)
            // otomatik doğru mesajı alıyor. `localeRef` - bu closure'ın
            // bağlı olduğu bootstrap effect'i SADECE accessToken değişince
            // yeniden çalışıyor, güncel locale'i ref'ten okumak gerekiyor.
            const currentLocale = localeRef.current;
            if (payload?.code === "MUTED" && payload.mutedUntil) {
              const mutedUntil = payload.mutedUntil;
              setMyProfile((prev) => (prev ? { ...prev, mutedUntil } : prev));
            }
            const message =
              payload?.code === "MESSAGE_TOO_LONG"
                ? interpolate(
                    translateErrorCode("MESSAGE_TOO_LONG", currentLocale) ?? "",
                    { max: MAX_MESSAGE_LENGTH },
                  )
                : (translateErrorCode(payload?.code, currentLocale) ??
                  translations[currentLocale].chatPanel.messageCouldNotBeSent);
            setSendError(message);
          },
        );
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
    requestClosePanel();
    if (next.id === activeRoom?.id) return;
    setActiveRoom(next);

    const generation = ++fetchGenerationRef.current;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const history = await fetchRoomHistory(next.name, authHeaders);
    if (fetchGenerationRef.current !== generation) return;
    setMessages(history?.messages ?? []);
    setNextCursor(history?.nextCursor ?? null);
  }

  // room:deleted WS handler'ının AYNI "aktif oda listeden düşerse fallback'e
  // geç" mantığı - burada sunucu-push yerine kullanıcının kendi eylemiyle
  // tetikleniyor.
  async function handleLeaveRoom(room: Room) {
    try {
      await leaveRoom(accessToken, room.id);
    } catch {
      // Sessizce yoksay - switcher eski listede kalır, kullanıcı tekrar deneyebilir.
      return;
    }
    const next = roomsRef.current.filter((r) => r.id !== room.id);
    setRooms(next);
    if (activeRoomIdRef.current !== room.id) return;
    const fallback = next[0] ?? null;
    setActiveRoom(fallback);
    clearRoomDraft(room.id);
    if (!fallback) {
      setMessages([]);
      setNextCursor(null);
      return;
    }
    const generation = ++fetchGenerationRef.current;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const fresh = await fetchRoomHistory(fallback.name, authHeaders);
    if (fetchGenerationRef.current !== generation) return;
    setMessages(fresh?.messages ?? []);
    setNextCursor(fresh?.nextCursor ?? null);
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
    const content = (activeRoom ? drafts[activeRoom.id] : undefined)?.trim() ?? "";
    if (!content || !socketRef.current || !activeRoom || isSending) {
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    setSendError(null);
    setIsSending(true);
    clearRoomDraft(activeRoom.id);
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
      setSendError("Message could not be sent, try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleMessageEdit(messageId: string, content: string) {
    socketRef.current?.emit("message:edit", { messageId, content });
  }

  function handleMessageDelete(messageId: string) {
    socketRef.current?.emit("message:delete", { messageId });
  }

  function fetchHistoryForMessage(messageId: string): Promise<MessageEdit[]> {
    if (!activeRoom) return Promise.resolve([]);
    return getMessageEditHistory(accessToken, activeRoom.name, messageId);
  }

  function handleReportMessage(messageId: string): Promise<void> {
    if (!activeRoom) return Promise.reject(new Error("no active room"));
    return reportMessage(accessToken, activeRoom.name, messageId);
  }

  async function handleLogout() {
    socketRef.current?.close();
    try {
      await logout();
    } catch {
      // Çıkış API çağrısı başarısız olsa da yerel oturumu kapat - kullanıcı
      // takılıp kalmasın, sunucu tarafı token zaten süresi dolunca geçersiz olur.
    }
    // Gizlilik önlemi: paylaşımlı bir bilgisayarda çıkış yapmayan/farklı
    // hesapla giren biri önceki kullanıcının taslağını görmesin - Slice A'nın
    // access-token'ı BİLEREK localStorage'a hiç yazmama kararıyla aynı ihtiyat.
    clearAllDraftsFromStorage();
    onLoggedOut();
  }

  const isMuted = myProfile?.mutedUntil
    ? new Date(myProfile.mutedUntil) > new Date()
    : false;

  const draft = (activeRoom ? drafts[activeRoom.id] : undefined) ?? "";

  const canSend =
    isReady &&
    draft.trim().length > 0 &&
    (activeRoom === null || activeRoom.status === "active") &&
    !isMuted;

  const isPanelOpen = activePanel !== "none";

  return (
    <main className="animate-fade-in flex h-dvh flex-col">
      {/* M10 Faz 2 Slice A: TopBar+sidebar+ChatPanel artık HER ZAMAN mount
          kalır - panel açıkken native inert (React 19) alt ağacı klavye/
          erişilebilirlik ağacından çıkarır, dim ile görsel olarak da
          bastırılır. Bu, panel kapanınca ChatPanel'in yeniden mount olup
          scroll pozisyonunu sıfırladığı gerçek, fark edilmemiş bir bug'ı da
          yan etki olarak düzeltiyor (messagesSectionRef'in DOM node'u artık
          hiç kaybolmuyor). M10 Faz 2 Slice B: kapsam TopBar + masaüstü
          sidebar'ı da içine aldı - bir panel açıkken arka plandaki hesap▾/
          moderasyon/oda satırlarının hepsi etkileşimsiz olmalı, tutarlı
          modal semantiği. */}
      <div
        inert={isPanelOpen}
        className={
          "chat-dim-transition flex h-full min-h-0 flex-col " +
          (isPanelOpen ? "opacity-40" : "opacity-100")
        }
      >
        <TopBar
          onOpenSidebar={() => setActivePanel("sidebar")}
          onCreateRoomClick={() => setActivePanel("create-room")}
          onDiscoverRoomsClick={() => setActivePanel("discover-rooms")}
          isModerator={myProfile?.role === "moderator"}
          openReportCount={myProfile?.role === "moderator" ? openReportCount : 0}
          onOpenModeration={() => setActivePanel("moderation")}
          username={myProfile?.username ?? null}
          onOpenProfile={handleViewProfile}
          onOpenSettings={() => setActivePanel("settings")}
          onOpenFeedback={() => setActivePanel("feedback")}
          onLogout={() => void handleLogout()}
          dict={dict}
        />

        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="rooms"
            className="hidden w-64 shrink-0 flex-col border-r border-neutral-800 p-4 md:flex"
          >
            <RoomSidebar
              rooms={rooms}
              activeRoom={activeRoom}
              onRoomSwitch={(room) => void handleRoomSwitch(room)}
              onLeaveRoom={(room) => void handleLeaveRoom(room)}
              showArchived={showArchived}
              onToggleShowArchived={() => void handleToggleShowArchived()}
              locale={locale}
            />
          </aside>

          <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col p-4">
            <ChatPanel
              messagesSectionRef={messagesSectionRef}
              messages={messages}
              myProfile={myProfile}
              isMuted={isMuted}
              mutedUntil={myProfile?.mutedUntil ?? null}
              muteReason={myProfile?.muteReason ?? null}
              onMessageEditSubmit={handleMessageEdit}
              onMessageDeleteSubmit={handleMessageDelete}
              fetchHistoryForMessage={fetchHistoryForMessage}
              onReportMessage={handleReportMessage}
              onViewProfile={handleViewProfile}
              nextCursor={nextCursor}
              isLoadingOlder={isLoadingOlder}
              onLoadOlder={() => void handleLoadOlder()}
              sendError={sendError}
              contentRemovedNotice={contentRemovedNotice}
              onDismissContentRemovedNotice={() => setContentRemovedNotice(null)}
              activeRoom={activeRoom}
              draft={draft}
              onDraftChange={(value) =>
                activeRoom ? setRoomDraft(activeRoom.id, value) : undefined
              }
              isReady={isReady}
              canSend={canSend}
              isSending={isSending}
              onSubmit={(event) => void handleSubmit(event)}
            />
          </div>
        </div>
      </div>

      {isPanelOpen && (
        activePanel === "sidebar" || activePanel === "moderation" ? (
          <SidePanel
            isClosing={isPanelClosing}
            onRequestClose={requestClosePanel}
            side={activePanel === "sidebar" ? "left" : "right"}
          >
            {activePanel === "sidebar" ? (
              <RoomSidebar
                titleId={SIDE_PANEL_TITLE_ID}
                onClose={requestClosePanel}
                rooms={rooms}
                activeRoom={activeRoom}
                onRoomSwitch={(room) => void handleRoomSwitch(room)}
                onLeaveRoom={(room) => void handleLeaveRoom(room)}
                showArchived={showArchived}
                onToggleShowArchived={() => void handleToggleShowArchived()}
                locale={locale}
              />
            ) : (
              <ModerationQueueView
                titleId={SIDE_PANEL_TITLE_ID}
                accessToken={accessToken}
                onClose={requestClosePanel}
                onQueueCountChange={setOpenReportCount}
              />
            )}
          </SidePanel>
        ) : (
          <CenteredModal
            isClosing={isPanelClosing}
            onRequestClose={requestClosePanel}
            title={getPanelTitle(activePanel as CenteredModalPanel, dict)}
            dict={dict}
          >
            {activePanel === "totp" ? (
              <TotpSettingsView
                accessToken={accessToken}
                initialEnabled={totpEnabled}
                onEnabledChange={setTotpEnabled}
                dict={dict}
                locale={locale}
              />
            ) : activePanel === "blocked" ? (
              <BlockedUsersView accessToken={accessToken} dict={dict} locale={locale} />
            ) : activePanel === "invites" ? (
              <InviteView accessToken={accessToken} dict={dict} />
            ) : activePanel === "delete-account" ? (
              <DeleteAccountView
                accessToken={accessToken}
                onDeleted={onLoggedOut}
                dict={dict}
                locale={locale}
              />
            ) : activePanel === "create-room" ? (
              <CreateRoomView
                accessToken={accessToken}
                onCreated={(room) => {
                  setRooms((prev) => [...prev, room]);
                  void handleRoomSwitch(room);
                }}
              />
            ) : activePanel === "discover-rooms" ? (
              <DiscoverRoomsView
                accessToken={accessToken}
                onJoined={(room) => {
                  setRooms((prev) => [...prev, room]);
                  void handleRoomSwitch(room);
                }}
              />
            ) : activePanel === "profile" && viewingProfileUsername ? (
              <ProfileView
                accessToken={accessToken}
                username={viewingProfileUsername}
                dict={dict}
                locale={locale}
              />
            ) : activePanel === "settings" ? (
              <SettingsView onNavigate={setActivePanel} dict={dict} />
            ) : activePanel === "language" ? (
              <LanguageSettingsView
                accessToken={accessToken}
                initialLocale={locale}
                onLocaleChange={handleLocaleChange}
                dict={dict}
              />
            ) : activePanel === "feedback" ? (
              <FeedbackView dict={dict} />
            ) : null}
          </CenteredModal>
        )
      )}
    </main>
  );
}
