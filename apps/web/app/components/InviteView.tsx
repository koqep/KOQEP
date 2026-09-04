"use client";

import { useEffect, useState } from "react";
import { listInvites, type InviteDto } from "../../lib/api";
import type { Dictionary } from "../../lib/i18n";

interface Props {
  accessToken: string;
  dict: Dictionary;
}

export default function InviteView({ accessToken, dict }: Props) {
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
      <p className="mb-4 text-muted">{dict.invite.policyParagraph}</p>

      {invites === null ? (
        <p>{dict.common.loading}</p>
      ) : invites.length === 0 ? (
        <p>{dict.invite.emptyList}</p>
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
                  ? dict.invite.used
                  : invite.revokedAt
                    ? dict.invite.revoked
                    : dict.invite.available}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
