# ADR-0005: Data retention — anonymize-on-delete, not hard-delete

**Date:** 2026-07-28
**Status:** Accepted

## Context
*Orijinal spec, kişisel verilerin 30 gün içinde tamamen silinmesini istiyordu — ama başkalarının okuduğu/yanıtladığı herkese açık mesajlar bu silmeyle çelişiyor. Phase 1 eleştirisinde bu çelişki açıkça işaretlendi.*

The original spec required all personal data to be permanently deleted after 30 days. But KOQEP's public rooms mean other users' conversations reference and reply to a given message — hard-deleting it breaks the thread for everyone who read or replied to it. This contradiction was flagged explicitly in the Phase 1 critique and needed a resolution before the data model could be finalized.

## Decision
On account deletion (or the 30-day window, whichever applies), hard-delete all account-level PII (email, TOTP secret, any stored profile fields). Message content stays in place but is anonymized — the author link is stripped/replaced with a generic placeholder, so the thread remains intact for other users but is no longer attributable to the deleted account.

## Alternatives considered
- **Hard-delete everything, including message content** — rejected: breaks public threads other users' conversations depend on, discovered only when someone's reply suddenly references a ghost message.
- **Delete nothing (soft-flag only)** — rejected: violates the founder's own stated privacy commitment and likely fails a straightforward reading of GDPR/KVKK erasure expectations.

## Consequences
- Positive: public conversation history stays coherent; account-level PII is genuinely gone.
- Cost / risk accepted: this is believed to satisfy GDPR Art. 17 and KVKK's equivalent in practice (Discord and Reddit both use anonymization over hard-delete for this reason), but this is not verified against Turkey-specific case law — flagged as an open item, worth a cheap legal check before real user data is at stake, not before v1 code.
- Cost to reverse later: moderate — switching to hard-delete later means retroactively breaking existing threads; switching away from anonymization toward "keep everything" would need a policy and ToS change, not a schema change.

## Addendum (2026-08-21, 5651 traffic-log scope review)
The lawyer's binding answer on 5651 (Turkish law) traffic-log retention — **18 months** — creates a deliberate, narrow exception to this ADR's own "account deletion hard-deletes PII" decision. The new `TrafficLog` table (`docs/milestones/M6b-traffic-log-5651.md`) links to `User` via `userId` with **`onDelete: SetNull`, not `Cascade`** — the same pattern this codebase already uses for `Message.author`, `ReputationEvent.userId`, and `ModerationAuditLog`'s user references (all `SetNull`, none `Cascade`). This means a `TrafficLog` row **survives account deletion** and keeps counting down its own 18-month retention clock, independent of when (or whether) the account itself is deleted — the IP address and connection metadata it holds are exactly the kind of "account-level PII" this ADR's Decision section says gets hard-deleted, except here a separate, more specific legal obligation (5651) overrides that default. This is a categorically different exception from ADR-0006's room-hard-delete carve-out (that one *removes more* than this ADR's default; this one *keeps more*, and only for a fixed, legally-mandated window) — both are deliberate, recorded exceptions, not silent drift from the rule.

**Still open, not resolved by the above:** whether this ADR's own anonymize-on-delete approach (for message authorship, the ADR's original subject) itself holds up under Turkey-specific case law was **not** part of the question asked of the lawyer on 2026-08-21 — only the traffic-log retention duration was asked. The "not yet legally verified" caveat in the Consequences section above still stands and is tracked separately (`docs/THREAT-MODEL.md` row 8, `docs/milestones/M6b-traffic-log-5651.md`'s founder-task list).
