# M2 — Core Rooms + Messaging Hardening

*Tek sabit oda gerçek çekirdek odalara (#general, #meta) dönüşür; mesaj düzenleme ve düzenleme geçmişi, rate limiting eklenir.*

**Goal:** Promote M0's single hardcoded room into the real always-on core rooms, and harden messaging with edit history and rate limits.
**Demo:** A tester posts in #general and #meta, edits a message, and a second tester (moderator role, even if unused yet) can see the edit history while a third regular tester cannot.
**Estimated hours:** 28–42h.

## Out of scope
- User-created rooms (M3).
- Reputation/XP (M4).

## Acceptance criteria
- [ ] #general and #meta exist and are permanently active (never eligible for archive/delete).
- [ ] A user can edit their own message; prior content is stored in `MessageEdit`.
- [ ] Edit history is visible only to the message's author and to moderators (`docs/THREAT-MODEL.md` row 3) — enforced, not just UI-hidden.
- [ ] Rate limits (per-user, per-IP, per-connection) reject abusive send rates.
- [ ] A basic load test at ~50 concurrent WS connections holds up without errors.

## Tasks
- [ ] Seed core rooms (#general, #meta) with `status: active`, non-archivable.
- [ ] Message edit endpoint + `MessageEdit` table.
- [ ] Access-control check for edit-history reads (author + moderator only, service-layer enforced).
- [ ] Rate limiter middleware at the WS gateway and REST API.
- [ ] Tests for edit history access control and rate limiting.
- [ ] Basic load test.
- [ ] Real invite-issuance endpoint (not detailed yet — scope to be clarified next session). Added because `docs/THREAT-MODEL.md`'s Open items named M2 as the concrete trigger for this: there's currently no authenticated API to create an `Invite`, only manual Postgres inserts, and that also turned out to be the only way to bootstrap the very first production user.

## Risks
- None major beyond normal build risk — this milestone mostly hardens M0/M1 scope rather than adding new surface area.
