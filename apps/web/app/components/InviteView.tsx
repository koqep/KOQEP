"use client";

import { useEffect, useState } from "react";
import { listInvites, type InviteDto } from "../../lib/api";
import { useFocusOnMount } from "./useFocusOnMount";

interface Props {
  accessToken: string;
  onClose: () => void;
  titleId: string;
}

export default function InviteView({ accessToken, onClose, titleId }: Props) {
  const [invites, setInvites] = useState<InviteDto[] | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let cancelled = false;
    listInvites(accessToken)
      .then((result) => {
        if (!cancelled) setInvites(result);
      })
      .catch(() => {
        if (!cancelled) setInvites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="text-neutral-400 outline-none">
          <span className="text-muted">#</span> invites
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-neutral-400"
        >
          close
        </button>
      </div>

      <p className="mb-4 text-muted">
        if someone you invited gets moderated (muted), one of your unused
        invites gets revoked; if you have no unused invites left, your next
        earned invite is deducted instead.
      </p>

      {invites === null ? (
        <p>loading...</p>
      ) : invites.length === 0 ? (
        <p>
          you haven&apos;t earned any invites yet — they&apos;ll show up here
          as you send messages and level up.
        </p>
      ) : (
        <ul className="space-y-2">
          {invites.map((invite) => (
            <li
              key={invite.code}
              className="flex items-center justify-between gap-4"
            >
              <span className="select-all font-mono text-neutral-200">
                {invite.code}
              </span>
              <span className="text-muted">
                {invite.usedAt
                  ? "used"
                  : invite.revokedAt
                    ? "revoked"
                    : "available"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
