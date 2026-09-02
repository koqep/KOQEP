# KOQEP — Data Model

*Şemanın kendisi migration dosyalarında yaşar; burada varlıklar, ilişkiler ve neden-sonuç ilişkileri tutulur.*

## Entities
*Sekiz çekirdek varlık: User, Invite, Room, RoomMember, Message, MessageEdit, ReputationEvent, ReadCursor. Presence kalıcı değil, in-process yaşar.*

**User** — an account. Email, optional TOTP secret (encrypted at rest, field-level AES-256-GCM — ADR-0008), a free-text `region` field (informational only, never used for access or filtering — ADR-0006), `inviter_id` (self-referential, nullable only for the root account), and `total_xp`/`level` — a materialized/cached derivation of the `ReputationEvent` log (ADR-0004), never the source of truth itself; both default to `0` for every account, including the founder's own (M4 Slice A/C).

**Invite** — a code issued by a user on level-up (PRD: 1 per level, starting at Level 1). `used_by` is nullable until consumed.

**Room** — either core (fixed set, e.g. #general, #meta) or user-created. `status` moves one-way: active → archived → deleted (ADR-0006). `last_message_at` drives the 14-day archive timer; `last_viewed_at` drives the 60-day delete timer once archived. `password_hash` (nullable, argon2 — M11c) is the first real access-gating field: when set, joining requires the matching password, and reading/sending messages requires an existing `RoomMember` row (see below).

**RoomMember** — `(user, room)` join row, `@@unique([userId, roomId])`. Scopes WS broadcast fan-out and the "mine"/"discoverable" room lists at 500-user scale (ADR-0009) — **not** an access-control mechanism for password-less rooms: any authenticated user can still read/post to any active, password-less room by name regardless of membership. **Exception (M11c):** for a room with `password_hash` set, a `RoomMember` row (created by a successful, password-verified join) is now required before reading or sending messages in that room. Backfilled once (core rooms × all users, room creators, real message participants) for pre-existing data; silent "lurkers" (read but never posted) are a known, accepted gap — no per-user view-tracking exists today.

**Message** — belongs to a room. `author_id` becomes null only when its account is anonymized on deletion (ADR-0005) — content itself is never deleted for that reason.

**MessageEdit** — one row per edit, preserving prior content for review by the message's author and moderators only — never public (resolved Phase 5, `docs/THREAT-MODEL.md` row 3; addresses Phase 1's message-edit-as-abuse-vector finding).

**ReputationEvent** — an append-only XP ledger (ADR-0004). Current level is a materialized/cached derivation of this log, never the source of truth itself. `user_id` and `source_message_id` are both nullable with SET NULL on delete (not RESTRICT/cascade) — deliberately, so the event survives account deletion and room/message hard-delete (M3 Slice C), matching the retention table's "never" trigger below; a RESTRICT default would have broken both of those already-shipped delete paths (M4 Slice A, 2026-08-04).

**ReadCursor** — `(user, room) → last_read_message_id`, server-owned, monotonic only (resolves Phase 1's multi-device read-state finding). Presence/typing state is explicitly **not** a persisted entity — it lives in-process per `ARCHITECTURE.md`.

## Relationships
*User bir davetçiye sahiptir (kökteki hesap hariç); Room-Message-MessageEdit zinciri; ReputationEvent ve ReadCursor kullanıcıya bağlı bağımsız log tabloları.*

- User 1—N Invite (as issuer)
- User 0/1—1 User (`inviter_id`, self-referential tree — plain adjacency list, no ltree/closure table per Phase 1)
- Room N—M User (via RoomMember)
- Room 1—N Message
- Message 1—N MessageEdit
- User 1—N ReputationEvent
- Message 0/1—N ReputationEvent (`source_message_id`, nullable — which message earned the XP, for audit; not every event needs one)
- User 1—N ReadCursor, Room 1—N ReadCursor

## Invariants
*Kırılmaması gereken kurallar: tek davetçi, mesaj içeriği asla silinmez, oda durumu tek yönlü, XP kaydı değiştirilemez.*

- Every user has exactly one inviter except the first (root) account.
- A message's `author_id` is nulled only when its owning account is deleted; message content is never deleted for that reason.
- Room `status` only moves forward (active → archived → deleted); archived rooms are read-only, so nothing can revive one mid-chain.
- Core rooms are permanently active — never eligible for the archive/delete lifecycle.
- `ReputationEvent` rows are immutable — insert-only, never updated.
- `ReadCursor.last_read_message_id` only moves forward per (user, room).

## Growth & partitioning strategy
*Mesaj hacmi bu ölçekte düşük kalır; partition veya ltree'ye gerek yok, sadece gerçek bir yavaşlama ölçülürse gündeme gelir.*

Message volume stays low at ~600 users (soft ceiling, not a target). A standard index on `(room_id, created_at)` plus Prisma cursor pagination is sufficient. No time-partitioning and no ltree/closure table in v1, per the Phase 1 findings that both would solve problems 10-100x this scale away — revisit only if message rows or invite-tree depth queries become measurably slow, not preemptively.

## Retention & deletion policy
*Hesap PII'si 30 günde tamamen silinir; mesaj içeriği kalır ama yazarı anonimleşir; kullanıcı odaları 14 gün sessizlikte arşivlenir, arşivde 60 gün daha izlenmezse silinir.*

| Data | Trigger | Action |
|---|---|---|
| Account PII (email, TOTP secret) | Account deletion / 30-day window | Hard delete |
| Message content | Account deletion | Anonymize author link only; content stays |
| User-created room | 14 days, no new message | Archive (read-only, hidden from browse) |
| Archived room | +60 days, zero views | Hard delete |
| Core rooms | never | Never archived/deleted |
| ReputationEvent | never | Immutable, retained indefinitely |
| TrafficLog (şema TAMAMLANDI, yazma mantığı henüz yok — `docs/milestones/M6b-traffic-log-5651.md` Slice B) | 18 ay (5651, avukat cevabı 2026-08-21) | Otomatik cron ile hard delete (Slice F, henüz yok) — `userId` hesap silinse bile `SetNull` ile korunur, ADR-0005 Addendum. `serviceType` plain-string (ReputationEvent deseni), `integrityHash` NOT NULL (her satır `sha256Hex` taşır), WS `connectionId` START/END satırlarını eşler. |
