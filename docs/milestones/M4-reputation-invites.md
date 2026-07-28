# M4 — Reputation + Invite-Per-Level

*XP olay-günlüğü olarak tutulur, seviye bu günlükten hesaplanır. Her seviye atlayışta 1 davet kazanılır (Level 1'den itibaren), davetçi başına rate-limit uygulanır.*

**Goal:** Replace M1's founder-issued invite pool with the real mechanism: an append-only reputation event log driving level, and 1 invite granted per level-up.
**Demo:** A tester sends enough messages to level up and sees a new invite appear; replaying the event log after a simulated rule change produces a corrected level without touching stored totals directly.
**Estimated hours:** 20–30h.

## Out of scope
- Monetization (Boost-for-XP is killed per `docs/review/CRITIQUE.md`; alternatives are a later prototype, per `docs/PRD.md` open questions).

## Acceptance criteria
- [ ] Sending a message (and other defined actions) appends a `ReputationEvent` row.
- [ ] Current level is computed/materialized from the event log, never stored as an authoritative mutable counter (ADR-0004).
- [ ] Leveling up grants exactly 1 new invite, starting at Level 1.
- [ ] Invite issuance is rate-limited per inviter (`docs/THREAT-MODEL.md` row 1).
- [ ] A test demonstrates replaying the event log after a simulated XP-rule change, proving the event-log choice pays off.

## Tasks
- [ ] `ReputationEvent` table + append-on-action logic.
- [ ] Level materialization (cached, recomputable from the log).
- [ ] Invite-grant-on-level-up trigger.
- [ ] Per-inviter invite issuance rate limit.
- [ ] Tests, including the rule-change replay scenario.

## Risks
- The exact level/XP formula is a product guess, not a validated curve — mitigation: ship a simple linear formula first and treat tuning as a post-launch iteration, not a blocker for this milestone.
