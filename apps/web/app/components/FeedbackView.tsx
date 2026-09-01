"use client";

import { FEEDBACK_EMAIL } from "../../lib/contact";

export default function FeedbackView() {
  return (
    <section className="flex-1 overflow-y-auto py-4 text-neutral-400">
      <p className="mb-4 text-muted">
        found a bug, have an idea, or something feels off? we read every
        message.
      </p>
      <p className="mb-4 select-all font-mono text-neutral-200">
        {FEEDBACK_EMAIL}
      </p>
      <a
        href={`mailto:${FEEDBACK_EMAIL}?subject=KOQEP%20feedback`}
        className="self-start bg-neutral-200 px-4 py-1.5 text-neutral-950 hover:bg-neutral-100"
      >
        write an email
      </a>
    </section>
  );
}
