# ADR-0004: Reputation/XP as an append-only event log

**Date:** 2026-07-28
**Status:** Accepted

## Context
*İtibar/XP sistemi kötüye kullanım tespiti ve seviye-davet mekaniği için kritik; kuralları zamanla değişecek bir sistemi mutable sayaçlarla kurmak, hataları geriye dönük düzeltmeyi imkansız hale getirir.*

Reputation/XP drives invite rights (1 invite per level-up) and is a trust signal used for sybil resistance. The rules that grant XP will change over time (abuse patterns, tuning, bug fixes). Storing reputation as a single mutable running total makes any past mistake — a bug that over-granted XP, or an abuse-rule change — impossible to correct without manual, per-account reconciliation.

## Decision
Store every XP-granting action as an immutable, append-only event (user, action type, amount, timestamp, source message/room reference where relevant). Current level/XP is a materialized value computed from that log, cached for read performance, but never the source of truth.

## Alternatives considered
- **Mutable running counter per user** — rejected: cheaper to implement now, but any retroactive correction (bug fix, abuse-rule change, moderator action) requires manually patching numbers with no audit trail of why.

## Consequences
- Positive: full audit trail for abuse investigation; XP rule changes can be replayed against history instead of requiring a one-off data migration; supports the moderation and abuse-review needs flagged in Phase 1.
- Cost / risk accepted: slightly more storage and a materialization/caching step instead of a single `UPDATE` — acceptable at this scale (600 users, low event volume).
- Cost to reverse later: high. Migrating from mutable counters to an event log after the fact means reconstructing history that was never recorded — effectively unrecoverable for past events. Cheap to do correctly from day one.
