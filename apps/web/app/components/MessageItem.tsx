"use client";

import { useRef, useState, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "./RoomView";
import MessageContent from "./MessageContent";
import type { MessageEdit } from "../../lib/api";
import { inputClassName } from "./formStyles";
import { useDismissableMenu } from "./useDismissableMenu";
import type { Dictionary } from "../../lib/i18n";

const menuItemClassName =
  "px-2 py-1 text-left text-muted hover:text-neutral-400";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string | null;
  roomId: string;
  editedAt: string | null;
}

interface Props {
  message: Message;
  isMine: boolean;
  isMuted: boolean;
  canViewHistory: boolean;
  isGroupStart: boolean;
  onSubmitEdit: (messageId: string, content: string) => void;
  onSubmitDelete: (messageId: string) => void;
  fetchHistory: (messageId: string) => Promise<MessageEdit[]>;
  onReport: (messageId: string) => Promise<void>;
  onViewProfile: (username: string) => void;
  className?: string;
  dict: Dictionary;
}

// M10 Faz 2 Slice C: 24-saat format (hour12: false) mockup'taki "03:12"
// örneğiyle BİREBİR eşleşiyor - ayrıca çıktıyı HER ZAMAN sabit 5 karaktere
// ("HH:MM") sabitleyip grup-başı/devam-mesajı satırları arasında genişlik
// tahmini gerektirmeden hizalama garantiliyor (bkz. aşağıdaki gutter).
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MessageItem({
  message,
  isMine,
  isMuted,
  canViewHistory,
  isGroupStart,
  onSubmitEdit,
  onSubmitDelete,
  fetchHistory,
  onReport,
  onViewProfile,
  className,
  dict,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<MessageEdit[] | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reportState, setReportState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuOpensUpward, setMenuOpensUpward] = useState(true);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  function closeMenu() {
    setIsMenuOpen(false);
    menuTriggerRef.current?.focus();
  }

  const menuContainerRef = useDismissableMenu<HTMLDivElement>({
    isOpen: isMenuOpen,
    onClose: closeMenu,
  });

  // Statik "hep yukarı aç" kararı (bottom-full) mesaj listesinin en
  // ÜSTÜNDEKİ bir satırda menüyü viewport'un DIŞINA (negatif y) itiyordu -
  // gerçek bir Playwright ölçümüyle bulundu (y:-34). Açılışta trigger'ın
  // viewport'a göre üstünde GERÇEKTEN yeterli yer var mı ölç, yoksa aşağı aç.
  const ESTIMATED_MENU_HEIGHT_PX = 170;
  function toggleMenu() {
    if (!isMenuOpen) {
      const rect = menuTriggerRef.current?.getBoundingClientRect();
      setMenuOpensUpward(!rect || rect.top >= ESTIMATED_MENU_HEIGHT_PX);
    }
    setIsMenuOpen((value) => !value);
  }

  // AccountMenu.select()'in AYNI deseni - odağı ÖNCE trigger'a taşı, SONRA
  // menüyü kapat, SONRA aksiyonu çalıştır (bkz. AccountMenu.tsx:43-49).
  function selectAction(action: () => void) {
    menuTriggerRef.current?.focus();
    setIsMenuOpen(false);
    action();
  }

  async function handleReport() {
    setReportState("sending");
    try {
      await onReport(message.id);
      setReportState("sent");
    } catch {
      setReportState("error");
    }
  }

  function startEditing() {
    setDraft(message.content);
    setIsEditing(true);
    // "⋯" menüsünden edit'e girip iptal edince sil-onayının sessizce geri
    // gelmemesi için - ikisi bağımsız state, aksi halde eski state sızardı.
    setIsConfirmingDelete(false);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return;
    onSubmitEdit(message.id, content);
    setIsEditing(false);
  }

  async function toggleHistory() {
    if (isHistoryOpen) {
      setIsHistoryOpen(false);
      setHistoryEntries(null);
      setHistoryError(null);
      return;
    }
    setIsHistoryOpen(true);
    setHistoryError(null);
    try {
      const entries = await fetchHistory(message.id);
      setHistoryEntries(entries);
    } catch {
      setHistoryError(dict.messageItem.historyLoadError);
    }
  }

  const authorLabel = message.authorUsername ?? dict.messageItem.deletedUser;
  // Yerel bir const'a çıkarmak, aşağıdaki nested onClick closure'ında
  // TypeScript'in bunu string olarak DARALTMASINI sağlıyor - message.
  // authorUsername'a doğrudan bir property-access olarak erişmek closure
  // sınırını aşamaz (TS'in bilinen bir kısıtı), `as string` cast'i gerektirirdi.
  const clickableAuthorUsername = message.authorUsername;

  // canViewHistory = isMine || moderator (ChatPanel.tsx) - yani kendi
  // mesajında bu her zaman true, "⋯" tetikleyicisi sil-onayı açıkken bile
  // asla tamamen kaybolmaz.
  const hasMenuActions =
    (isMine && !isMuted) ||
    (isMine && !isConfirmingDelete) ||
    canViewHistory ||
    (!isMine && reportState !== "sent");

  return (
    <li className={"text-neutral-200" + (className ? ` ${className}` : "")}>
      {isEditing ? (
        <form
          onSubmit={handleEditSubmit}
          className="flex items-center gap-2 py-1"
        >
          <input
            type="text"
            aria-label={dict.messageItem.editAriaLabel}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- "düzenle"ye tıklandıktan sonra beliren alan, sürpriz odak sıçraması değil.
            autoFocus
            className={`flex-1 ${inputClassName}`}
          />
          <button
            type="submit"
            className="text-muted hover:text-neutral-400"
          >
            {dict.messageItem.saveButton}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-muted hover:text-neutral-400"
          >
            {dict.common.cancel}
          </button>
        </form>
      ) : (
        // M11a Slice F: avatar + edit/delete/history/report Slice C'nin
        // saat için kurduğu group-hover/focus-within desenini paylaşıyor -
        // "are you sure?"/yes/cancel onay UI'ı BİLEREK dışarıda (aktif bir
        // onay durumu, hover'dan bağımsız görünür kalmalı).
        <div className="group flex items-baseline gap-2">
          <span
            className={
              "shrink-0 whitespace-nowrap text-right text-muted" +
              (isGroupStart
                ? ""
                : " invisible group-hover:visible group-focus-within:visible")
            }
          >
            {formatTime(message.createdAt)}
          </span>
          {isGroupStart &&
            (clickableAuthorUsername ? (
              // M10 Faz 2 Slice D+E: {authorLabel}: metni KENDİ ayrı
              // <span>'inde KALIYOR - message-grouping.spec.ts'in
              // getByText("baskasi:", {exact: true}) sorguları birleştirilmiş
              // bir string'de eşleşmeyi kaybederdi. Kendi mesajını tıklamak
              // da AYNI mekanizmayla kendi profiline açılır - authorLabel
              // M11a Slice A'dan beri isMine farketmeksizin her zaman gerçek
              // kullanıcı adı. M13 Slice E: küçük avatar glyph'i kaldırıldı,
              // tıklanabilirlik SADECE metin etiketinden geliyor.
              <button
                type="button"
                onClick={() => onViewProfile(clickableAuthorUsername)}
                className="text-muted hover:text-neutral-400"
              >
                <span>{authorLabel}:</span>
              </button>
            ) : (
              // Silinmiş yazarlı mesajlar tıklanamaz - authorId onlar için
              // zaten hiç yok, profile açacak bir hedef yok.
              <span className="text-muted">{authorLabel}:</span>
            ))}
          <span className="flex-1">
            <MessageContent content={message.content} />
            {message.editedAt && (
              <span className="text-muted"> {dict.messageItem.editedSuffix}</span>
            )}
          </span>
          {hasMenuActions && (
            <div ref={menuContainerRef} className="relative">
              <button
                ref={menuTriggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label={dict.messageItem.messageActionsAriaLabel}
                onClick={toggleMenu}
                className={
                  "text-muted hover:text-neutral-400" +
                  (isMenuOpen
                    ? " visible"
                    : " invisible group-hover:visible group-focus-within:visible")
                }
              >
                <span aria-hidden="true">⋯</span>
              </button>
              {isMenuOpen && (
                <div
                  role="menu"
                  aria-label={dict.messageItem.messageActionsAriaLabel}
                  className={
                    "absolute right-0 z-30 flex w-40 flex-col gap-1 border border-neutral-800 bg-neutral-950 p-2" +
                    (menuOpensUpward ? " bottom-full mb-1" : " top-full mt-1")
                  }
                >
                  {isMine && !isMuted && (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => selectAction(startEditing)}
                      className={menuItemClassName}
                    >
                      {dict.messageItem.editButton}
                    </button>
                  )}
                  {isMine && !isConfirmingDelete && (
                    // Mute kontrolü BİLEREK YOK - susturulmuş kullanıcı da
                    // kendi mesajını silebilmeli (silme yeni içerik
                    // EKLEMİYOR, sabit bir placeholder'a değiştiriyor,
                    // mute'un koruduğu risk yok).
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() =>
                        selectAction(() => setIsConfirmingDelete(true))
                      }
                      className="px-2 py-1 text-left text-muted hover:text-red-400"
                    >
                      {dict.messageItem.deleteButton}
                    </button>
                  )}
                  {canViewHistory && (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() =>
                        selectAction(() => void toggleHistory())
                      }
                      className={menuItemClassName}
                    >
                      {isHistoryOpen
                        ? dict.messageItem.hideHistoryButton
                        : dict.messageItem.historyButton}
                    </button>
                  )}
                  {!isMine && reportState !== "sent" && (
                    <button
                      role="menuitem"
                      type="button"
                      disabled={reportState === "sending"}
                      onClick={() => selectAction(() => void handleReport())}
                      className={
                        menuItemClassName + " disabled:cursor-not-allowed"
                      }
                    >
                      {reportState === "error"
                        ? dict.messageItem.tryAgainButton
                        : reportState === "sending"
                          ? dict.messageItem.reportingButton
                          : dict.messageItem.reportButton}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {isMine && isConfirmingDelete && (
            <>
              <span className="text-red-400">
                {dict.messageItem.confirmDeleteQuestion}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSubmitDelete(message.id);
                  setIsConfirmingDelete(false);
                }}
                className="text-red-400 hover:text-red-300"
              >
                {dict.messageItem.yesButton}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="text-muted hover:text-neutral-400"
              >
                {dict.common.cancel}
              </button>
            </>
          )}
          {!isMine && reportState === "sent" && (
            <span className="text-muted">{dict.messageItem.reportedLabel}</span>
          )}
        </div>
      )}

      {isHistoryOpen && (
        <div className="ml-4 border-l border-neutral-800 pl-2">
          {historyError ? (
            <p className="text-red-400">{historyError}</p>
          ) : historyEntries === null ? (
            <p className="text-muted">{dict.common.loading}</p>
          ) : historyEntries.length === 0 ? (
            <p className="text-muted">{dict.messageItem.noEditHistory}</p>
          ) : (
            <ul className="space-y-0.5">
              {historyEntries.map((entry, index) => (
                <li key={index} className="text-muted">
                  {formatTime(entry.editedAt)} —{" "}
                  <MessageContent content={entry.previousContent} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
