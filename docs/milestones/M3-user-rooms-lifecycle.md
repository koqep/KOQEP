# M3 — User-Created Rooms + Lifecycle

*Kullanıcılar kendi odalarını açabilir; 14 gün sessizlikte arşivlenir, arşivde 60 gün daha izlenmezse silinir. Oda oluşturma günde 1 ile sınırlı.*

**Goal:** Let users create their own topic rooms, with the archive/delete lifecycle from `docs/ARCHITECTURE.md`/ADR-0006 enforced automatically.
**Demo:** A tester creates a room; a second, empty test room that's been silent for 14 days (simulated via a fast-forwarded clock in tests) shows as archived and read-only; an archived room with no views for 60 more days is gone from the DB.
**Estimated hours:** 25–38h (first-time scheduled/cron job on the chosen platform is the main unknown). Sequencing note (2026-07-30): `docs/milestones/M2.5-identity-reliability.md` runs before this milestone, not after — username and WS reliability are foundational, not room-lifecycle work, so they got their own milestone instead of being folded in here.

## Out of scope
- Reputation-gated room creation (any signed-up user can create one, per `docs/PRD.md`).

## Acceptance criteria
- [ ] A user can create a room with a free-form topic; creation is capped at 1 per user per 24h (`docs/THREAT-MODEL.md` row 6).
- [ ] A room with no new messages for 14 days becomes read-only and disappears from the active browse list, but stays linkable.
- [ ] An archived room with zero views for a further 60 days is hard-deleted.
- [ ] The browse list excludes archived and deleted rooms by default.
- [ ] Tests cover both lifecycle transitions (archive and delete) and the creation rate limit.

## Tasks
- [ ] Room creation endpoint + per-user 24h rate limit.
- [ ] Scheduled job: archive rooms past the 14-day silence threshold (simple cron-triggered endpoint, not a queue system — per ADR-0003's monolith-first decision).
- [ ] Scheduled job: hard-delete archived rooms past the 60-day zero-view threshold.
- [ ] Browse-list query excluding archived/deleted.
- [ ] Tests, including both scheduled jobs run against a controllable clock.

## Risks
- Background job reliability on a $50/mo host — mitigation: keep both jobs as simple, idempotent, cron-triggered HTTP endpoints rather than introducing a separate queue/worker system, consistent with the monolith-first decision.
