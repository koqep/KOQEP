# M5 — Moderation & Abuse Tooling

*Rapor akışı sadece raporlanan içeriği moderatöre gösterir; şeffaf geçici susturma (shadow ban değil); her moderatör erişimi ve aksiyonu değiştirilemez bir denetim günlüğüne yazılır.*

**Goal:** Give the founder (sole moderator) real tools: a report flow, transparent temp-mute, and an audit log over their own access.
**Demo:** A tester reports an abusive DM; the founder sees only that reported content, applies a temp-mute that the muted user is visibly notified of, and the audit log shows exactly what was accessed and when.
**Estimated hours:** 26–38h.

## Out of scope
- Multi-moderator role management — there is exactly one moderator (the founder) at this scale.

## Acceptance criteria
- [ ] A user can report a message or DM; the report exposes only the reported content to the moderator (`docs/THREAT-MODEL.md` row 10) — not ambient access to all DMs.
- [ ] A moderator can apply a temp-mute; the muted user is visibly notified — no shadow ban.
- [ ] Every moderator access to edit history or reported content, and every moderation action, is written to an append-only audit log (`docs/THREAT-MODEL.md` row 12): who, what, on whom, when.
- [ ] Same-actor multi-report pattern (row 10's weak backstop) triggers a flag for moderator attention.

## Tasks
- [ ] Report endpoint + minimal moderator review queue, scoped to reported content only.
- [ ] Temp-mute mechanism + user-facing notice.
- [ ] Audit log table + write-on-access-and-action, reusing the append-only pattern from `ReputationEvent` (ADR-0004).
- [ ] Multi-report pattern detection (same account reported/blocked by several distinct users in a window).
- [ ] Tests for report scoping, mute visibility, and audit log completeness.

## Risks
- This is the last real safeguard between "small trusted group" and "invite-only but abuse-prone" — mitigation: treat it as non-negotiable even under time pressure; it's cheap relative to the damage one bad actor does to a small community.
