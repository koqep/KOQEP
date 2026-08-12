"use client";

import { useEffect, useState } from "react";
import { listInvites, type InviteDto } from "../../lib/api";
import { useFocusOnMount } from "./useFocusOnMount";

interface Props {
  accessToken: string;
  onClose: () => void;
}

export default function InviteView({ accessToken, onClose }: Props) {
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
        <h2 ref={headingRef} tabIndex={-1} className="text-neutral-400 outline-none">
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
        davet ettiğin biri moderasyona uğrarsa (susturulursa) kullanılmamış
        bir davetin iptal edilir; hiç kullanılmamış daveti kalmamışsa bir
        sonraki kazanacağın davetin düşer.
      </p>

      {invites === null ? (
        <p>yükleniyor...</p>
      ) : invites.length === 0 ? (
        <p>
          henüz kazanılmış bir davetin yok — mesaj gönderip seviye atladıkça
          burada görünecek.
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
                  ? "kullanıldı"
                  : invite.revokedAt
                    ? "iptal edildi"
                    : "kullanılabilir"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
