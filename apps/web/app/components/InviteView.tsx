"use client";

import { useEffect, useState } from "react";
import { listInvites, type InviteDto } from "../../lib/api";

interface Props {
  accessToken: string;
}

export default function InviteView({ accessToken }: Props) {
  const [invites, setInvites] = useState<InviteDto[] | null>(null);

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
