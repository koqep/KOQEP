"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  listOpenReports,
  removeReportedContent,
  dismissReport,
  muteUser,
  unmuteUser,
  type ReportSummary,
} from "../../lib/api";
import MessageContent from "./MessageContent";
import RoomModerationSection from "./RoomModerationSection";
import AssignModeratorSection from "./AssignModeratorSection";
import { useFocusOnMount } from "./useFocusOnMount";
import { inputClassName } from "./formStyles";

const MUTE_DURATION_HOURS = 24;

interface PendingReasonAction {
  reportId: string;
  reportedUserId?: string;
  kind: "mute" | "remove";
}

interface Props {
  accessToken: string;
  onClose: () => void;
}

export default function ModerationQueueView({ accessToken, onClose }: Props) {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // M7b Slice D2: "sustur"/"içeriği kaldır" artık tek-tık DEĞİL - AC
  // "bildirim SEBEP içeriyor" diyor, ikisi de AYNI paylaşılan sebep
  // formunu tetikliyor (kod tekrarını önlemek için).
  const [pendingReasonAction, setPendingReasonAction] =
    useState<PendingReasonAction | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let cancelled = false;
    listOpenReports(accessToken)
      .then((result) => {
        if (!cancelled) setReports(result);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  function removeFromQueue(reportId: string) {
    setReports((prev) => (prev ?? []).filter((r) => r.id !== reportId));
  }

  function startReasonAction(
    reportId: string,
    kind: "mute" | "remove",
    reportedUserId?: string,
  ) {
    setError(null);
    setPendingReasonAction({ reportId, kind, reportedUserId });
    setReasonDraft("");
  }

  async function submitReasonAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingReasonAction) return;
    const reason = reasonDraft.trim();
    if (!reason) return;
    const { reportId, kind, reportedUserId } = pendingReasonAction;
    setError(null);
    setPendingId(reportId);
    try {
      if (kind === "mute") {
        if (!reportedUserId) return;
        await muteUser(accessToken, reportedUserId, MUTE_DURATION_HOURS, reason);
      } else {
        await removeReportedContent(accessToken, reportId, reason);
        removeFromQueue(reportId);
      }
      setPendingReasonAction(null);
    } catch {
      setError(
        kind === "mute"
          ? "Kullanıcı susturulamadı, tekrar dene."
          : "İçerik kaldırılamadı, tekrar dene.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleDismiss(reportId: string) {
    setError(null);
    setPendingId(reportId);
    try {
      await dismissReport(accessToken, reportId);
      removeFromQueue(reportId);
    } catch {
      setError("Rapor reddedilemedi, tekrar dene.");
    } finally {
      setPendingId(null);
    }
  }

  // M5 Slice B: rapor yaşam döngüsünden BAĞIMSIZ - Report.status'a
  // dokunmuyor, satır kaybolmuyor (removeFromQueue ÇAĞRILMIYOR). "sustur"
  // butonu görsel olarak "içeriği kaldır"dan ÖNCE geliyor - moderatör hem
  // içeriği kaldırıp hem susturmak isterse, ÖNCE sustur, sonra kaldır/reddet
  // sırası gerekiyor (tersi çalışmaz, satır kaldır/reddet'te kayboluyor).
  async function handleUnmute(reportId: string, reportedUserId: string) {
    setError(null);
    setPendingId(reportId);
    try {
      await unmuteUser(accessToken, reportedUserId);
    } catch {
      setError("Susturma kaldırılamadı, tekrar dene.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="text-neutral-400 outline-none">
          <span className="text-muted">#</span> moderasyon
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-neutral-400"
        >
          close
        </button>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {reports === null ? (
        <p>yükleniyor...</p>
      ) : reports.length === 0 ? (
        <p>açık rapor yok</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const reportedUserId = report.reportedUserId;
            return (
            <li
              key={report.id}
              className="border border-neutral-800 p-2"
            >
              {report.isFlagged && (
                <p className="mb-1 text-red-400">
                  [çoklu rapor — {report.distinctReporterCount} farklı
                  kullanıcı]
                </p>
              )}
              <p className="mb-1 text-muted">
                {report.reportedUsername ?? "silinmiş kullanıcı"}
                {report.reason && (
                  <span className="text-muted"> — {report.reason}</span>
                )}
              </p>
              <p className="mb-2 text-neutral-200">
                <MessageContent content={report.reportedContent} />
              </p>
              {pendingReasonAction?.reportId === report.id ? (
                <form
                  onSubmit={(event) => void submitReasonAction(event)}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="moderatör sebebi"
                    value={reasonDraft}
                    onChange={(event) => setReasonDraft(event.target.value)}
                    placeholder="sebep..."
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- "sustur"/"içeriği kaldır"a tıklandıktan sonra beliren alan, sürpriz odak sıçraması değil.
                    autoFocus
                    className={`flex-1 ${inputClassName}`}
                  />
                  <button
                    type="submit"
                    disabled={
                      pendingId === report.id || reasonDraft.trim().length === 0
                    }
                    className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    onayla
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingReasonAction(null)}
                    className="text-muted hover:text-neutral-400"
                  >
                    iptal
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-4">
                  {reportedUserId && (
                    <>
                      <button
                        type="button"
                        disabled={pendingId === report.id}
                        onClick={() =>
                          startReasonAction(report.id, "mute", reportedUserId)
                        }
                        className="text-muted hover:text-red-400 disabled:cursor-not-allowed"
                      >
                        sustur ({MUTE_DURATION_HOURS} saat)
                      </button>
                      <button
                        type="button"
                        disabled={pendingId === report.id}
                        onClick={() =>
                          void handleUnmute(report.id, reportedUserId)
                        }
                        className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                      >
                        susturmayı kaldır
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={pendingId === report.id}
                    onClick={() => startReasonAction(report.id, "remove")}
                    className="text-muted hover:text-red-400 disabled:cursor-not-allowed"
                  >
                    içeriği kaldır
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === report.id}
                    onClick={() => void handleDismiss(report.id)}
                    className="text-muted hover:text-neutral-400 disabled:cursor-not-allowed"
                  >
                    reddet
                  </button>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}

      <RoomModerationSection accessToken={accessToken} />
      <AssignModeratorSection accessToken={accessToken} />
    </section>
  );
}
