"use client";

import { useEffect, useState } from "react";
import { getPublicProfile, ApiError, type PublicUserProfile } from "../../lib/api";
import { LargeAvatar } from "./Avatar";
import type { Dictionary, Locale } from "../../lib/i18n";
import { interpolate } from "../../lib/i18n";
import { translateErrorCode } from "../../lib/error-messages";

interface Props {
  accessToken: string;
  username: string;
  dict: Dictionary;
  locale: Locale;
}

function formatJoinDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfileView({
  accessToken,
  username,
  dict,
  locale,
}: Props) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // username, panel her açıldığında TAZE bir mount ile geliyor (arka plan
  // panel açıkken inert - başka bir mesajın profiline tıklamak mümkün
  // değil), bu yüzden effect pratikte SADECE mount'ta bir kez çalışıyor -
  // React'in "effect içinde senkron setState kademeli render'a yol açar"
  // kuralı yüzünden (RoomView.tsx'in moderation-count effect'iyle AYNI
  // düzeltme) başlangıç sıfırlaması burada GEREKMİYOR, state zaten
  // useState(null) ile null başlıyor.
  useEffect(() => {
    let cancelled = false;
    getPublicProfile(accessToken, username)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? (translateErrorCode(err.code, locale) ?? err.message)
            : dict.common.connectionError,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, username, dict, locale]);

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      {error ? (
        <p className="text-red-400">{error}</p>
      ) : profile === null ? (
        <p>{dict.common.loading}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <LargeAvatar seed={profile.username} className="text-neutral-200" />
          <p className="text-neutral-200">{profile.username}</p>
          <p>
            {interpolate(dict.profile.joined, {
              date: formatJoinDate(profile.createdAt, locale),
            })}
          </p>
          <p>
            {interpolate(dict.profile.levelXp, {
              level: profile.level,
              xp: profile.totalXp,
            })}
          </p>
          {/* M13 Slice E: seviye/XP çubuğu - yüzde backend'de hesaplanıyor
              (XP_PER_LEVEL frontend'e hiç açılmıyor, ADR-0002). */}
          <div
            role="progressbar"
            aria-valuenow={Math.round(profile.xpProgressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={dict.profile.xpProgressAriaLabel}
            className="mt-1 h-1 w-40 border border-neutral-800"
          >
            <div
              className="h-full bg-neutral-200"
              style={{ width: `${profile.xpProgressPercent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
