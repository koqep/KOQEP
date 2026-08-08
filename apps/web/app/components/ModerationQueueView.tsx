"use client";

import { useEffect, useState } from "react";
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

const MUTE_DURATION_HOURS = 24;

interface Props {
  accessToken: string;
  onClose: () => void;
}

export default function ModerationQueueView({ accessToken, onClose }: Props) {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  async function handleRemoveContent(reportId: string) {
    setError(null);
    setPendingId(reportId);
    try {
      await removeReportedContent(accessToken, reportId);
      removeFromQueue(reportId);
    } catch {
      setError("İçerik kaldırılamadı, tekrar dene.");
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
  async function handleMute(reportId: string, reportedUserId: string) {
    setError(null);
    setPendingId(reportId);
    try {
      await muteUser(accessToken, reportedUserId, MUTE_DURATION_HOURS);
    } catch {
      setError("Kullanıcı susturulamadı, tekrar dene.");
    } finally {
      setPendingId(null);
    }
  }

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
        <h2 className="text-neutral-400">
          <span className="text-neutral-600">#</span> moderasyon
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-600 hover:text-neutral-400"
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
              <p className="mb-1 text-neutral-500">
                {report.reportedUsername ?? "silinmiş kullanıcı"}
                {report.reason && (
                  <span className="text-neutral-600"> — {report.reason}</span>
                )}
              </p>
              <p className="mb-2 text-neutral-200">
                <MessageContent content={report.reportedContent} />
              </p>
              <div className="flex items-center gap-4">
                {reportedUserId && (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === report.id}
                      onClick={() => void handleMute(report.id, reportedUserId)}
                      className="text-neutral-600 hover:text-red-400 disabled:cursor-not-allowed"
                    >
                      sustur ({MUTE_DURATION_HOURS} saat)
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === report.id}
                      onClick={() =>
                        void handleUnmute(report.id, reportedUserId)
                      }
                      className="text-neutral-600 hover:text-neutral-400 disabled:cursor-not-allowed"
                    >
                      susturmayı kaldır
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={pendingId === report.id}
                  onClick={() => void handleRemoveContent(report.id)}
                  className="text-neutral-600 hover:text-red-400 disabled:cursor-not-allowed"
                >
                  içeriği kaldır
                </button>
                <button
                  type="button"
                  disabled={pendingId === report.id}
                  onClick={() => void handleDismiss(report.id)}
                  className="text-neutral-600 hover:text-neutral-400 disabled:cursor-not-allowed"
                >
                  reddet
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <RoomModerationSection accessToken={accessToken} />
    </section>
  );
}
