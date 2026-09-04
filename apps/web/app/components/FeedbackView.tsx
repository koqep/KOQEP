"use client";

import { FEEDBACK_EMAIL } from "../../lib/contact";
import type { Dictionary } from "../../lib/i18n";

interface Props {
  dict: Dictionary;
}

export default function FeedbackView({ dict }: Props) {
  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <p className="mb-4 text-muted">{dict.feedback.description}</p>
      <p className="mb-4 select-all font-mono text-neutral-200">
        {FEEDBACK_EMAIL}
      </p>
      <a
        href={`mailto:${FEEDBACK_EMAIL}?subject=KOQEP%20feedback`}
        className="self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100"
      >
        {dict.feedback.writeEmail}
      </a>
    </section>
  );
}
