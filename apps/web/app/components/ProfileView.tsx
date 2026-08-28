"use client";

import { useEffect, useState } from "react";
import { getPublicProfile, ApiError, type PublicUserProfile } from "../../lib/api";
import { LargeAvatar } from "./Avatar";
import { useFocusOnMount } from "./useFocusOnMount";

interface Props {
  accessToken: string;
  username: string;
  onClose: () => void;
  titleId: string;
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfileView({
  accessToken,
  username,
  onClose,
  titleId,
}: Props) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

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
          err instanceof ApiError && err.status === 404
            ? "This user could not be found."
            : "Connection error. Try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, username]);

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-neutral-400 outline-none">
          <span className="text-muted">#</span> profile
        </h2>
        <button type="button" onClick={onClose} className="text-muted hover:text-neutral-400">
          close
        </button>
      </div>

      {error ? (
        <p className="text-red-400">{error}</p>
      ) : profile === null ? (
        <p>loading...</p>
      ) : (
        <div className="flex flex-col gap-2">
          <LargeAvatar seed={profile.username} className="text-neutral-200" />
          <p className="text-neutral-200">{profile.username}</p>
          <p>joined {formatJoinDate(profile.createdAt)}</p>
          <p>
            level {profile.level} — {profile.totalXp} XP
          </p>
        </div>
      )}
    </section>
  );
}
