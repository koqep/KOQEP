# ADR-0006: Room model — core + user-created rooms, archive/delete lifecycle, no geography

**Date:** 2026-07-28
**Status:** Accepted

## Context
*Orijinal Country → Region → City oda hiyerarşisi, 100-600 kullanıcı ölçeğinde neredeyse tamamen boş yüzlerce oda üretiyordu — Phase 1'de FATAL bulgu olarak işaretlendi. Kurucu bu hiyerarşiyi tamamen kaldırmayı ve odaların kullanıcı tarafından üretilmesini istedi.*

The original spec's Country → Region → City room hierarchy would produce hundreds of rooms, nearly all permanently silent at KOQEP's realistic scale (100-600 users) — flagged as a FATAL finding in the Phase 1 critique because a silent room reads as a dead platform on first impression. The founder decided to remove geography from room structure entirely and let users create their own topic-based rooms instead, which introduces a new problem: unbounded, unmoderated room growth on a $50/mo infra budget.

## Decision
A small fixed set of always-on core rooms (e.g. #general, #meta) exists from launch and never archives. Any user can additionally create a topic-based room. A user-created room auto-archives (read-only, hidden from the active browse list, still linkable) after 14 days with no new messages. An archived room that also receives zero views for a further 60 days is hard-deleted. No room is filtered, grouped, or gated by geography anywhere in the product; the profile's "region" field is purely informational and self-set.

## Alternatives considered
- **Country → Region → City hierarchy** — rejected: Phase 1 FATAL finding; guarantees empty rooms and a dead-platform first impression at this scale.
- **Fully open room creation with no lifecycle** — rejected: unbounded storage growth with no cost control, on a budget that can't absorb it; also leaves dead rooms visible forever, reintroducing the same "ghost town" problem from a different angle.

## Consequences
- Positive: room structure grows organically with actual usage instead of a speculative taxonomy; storage cost stays bounded; no user ever sees a wall of empty rooms.
- Cost / risk accepted: the exact 14-day/60-day windows and room-creation rate limits are untuned defaults (open question carried from the PRD) — may need adjustment once real usage data exists.
- Cost to reverse later: low-to-moderate. Tuning the archive/delete windows is a config change. Reintroducing any geographic structure later would be a genuine product change, not just a config flip, but nothing in this decision blocks that path if the community ever grows large enough to need it.

## Addendum (2026-07-31, M3 scope review)
"Hard-deleted" here genuinely means the room's `Message`/`MessageEdit` rows are deleted along with the `Room` row (in a single transaction, child-to-parent FK order) — not just the `Room` row with orphaned messages left behind, and not a soft-hide. This was made explicit because it appears to conflict with `CLAUDE.md`'s "mesaj içeriği asla hard-delete edilmez" rule (sourced from ADR-0005, which is scoped to account deletion — an author's link gets anonymized, but the message and the thread around it survive because *other people* are still relying on that thread being coherent). Room deletion is a different situation: the entire room and everyone's messages in it are removed together, nobody is left with a thread missing one participant's replies, and "storage cost stays bounded" (this ADR's own stated positive consequence) only holds if the messages actually go. `CLAUDE.md` carries a one-line pointer to this exception; this paragraph is the actual reasoning.
