# M6 — Legal & Launch Readiness

*Gerçek kullanıcı verisini sorumlu şekilde tutmak için gereken son parçalar: gizlilik politikası, 5651/KVKK kontrolü, izleme, yedekleme, erişilebilirlik.*

**Goal:** Close the remaining Phase 1/5 open items before pointing real acquisition efforts (the manifesto/waitlist test from `docs/review/CRITIQUE.md`'s Riskiest Assumption) at the product.
**Demo:** Privacy policy and ToS are live and linked; a simulated outage triggers an alert within minutes; a backup is restored successfully in a test environment.
**Estimated hours:** 37–62h founder-hours (revised 2026-07-30 — see `docs/BACKLOG.md`'s "2026-07-30 — LANSMAN KARARI" denetimi: mobil uyumluluk eklendi, erişilebilirlik satırının kapsamı yukarı revize edildi — şu an `apps/web` genelinde toplam 2 `aria-*` kullanımı var, gerçek bir tarama/düzeltme işi bu kadar ucuz olmayacak). The 5651/KVKK legal check adds calendar time waiting on a third party, on top of these hours — see capacity check.

## Out of scope
- Anything not required to responsibly hold real user data — this is a hardening milestone, not a feature milestone.

## Acceptance criteria
- [ ] Privacy policy and ToS are published and linked from signup, and state a minimum age (KVKK's child-data provisions) — a policy line + a signup checkbox, not an ID-verification flow.
- [ ] The 5651/KVKK anonymize-on-delete approach (ADR-0005, `docs/THREAT-MODEL.md` row 8) has had a real legal sanity check, not just this review's best guess.
- [ ] An uptime check and error tracker are live and alerting the founder.
- [ ] A documented backup/restore runbook exists and has been exercised at least once — a real restore, not just a backup that's never been tested. A general "something broke at 3am, now what" runbook is written alongside it, not a separate task.
- [ ] The UI passes a basic screen-reader/contrast check (Phase 1 accessibility finding) — a real pass, not a token one: `aria-*` coverage across every component (2 uses exist today, both test-targeting artifacts, not deliberate accessibility work), keyboard navigability, and contrast on the black/white monospace/CRT-effect theme specifically (the theme choice itself is a real contrast risk, not just a generic checklist item).
- [ ] The web app is usable at common mobile viewport widths (checked, not assumed) — no broken/overflowing layout at ~375px, since the first closed cohort will open it from phones and no responsive work exists today (confirmed: zero Tailwind breakpoint classes anywhere in `apps/web`).
- [x] Transactional email (password reset, M1 Slice C) sends from a verified, branded domain with SPF/DKIM/DMARC configured — not Resend's shared `onboarding@resend.dev` sender. Done 2026-07-29, ahead of this milestone: `koqep.com` connected via Cloudflare, auto-configure added SPF/DKIM/DMARC, "Verified" in Resend.

## Tasks
- [ ] Draft privacy policy + ToS, including a minimum-age statement + signup checkbox.
- [ ] Commission or perform the 5651/KVKK legal check — start this in parallel with M4/M5 build work, not after.
- [ ] Set up uptime monitoring + free-tier error tracking.
- [ ] Write the backup/restore runbook (extended to a general incident runbook, not just backup/restore); perform one test restore.
- [ ] Real accessibility pass on the terminal UI: `aria-*`/semantic-role audit across every component, keyboard-only navigation check, contrast check specific to the black/white monospace/CRT theme.
- [ ] Mobile responsive pass: test at common phone viewport widths, fix broken/overflowing layout (header buttons + room tabs are the most likely failure point at narrow widths).
- [x] Verify a sending domain in Resend (SPF/DKIM/DMARC DNS records) and set `EMAIL_FROM_ADDRESS` to a branded sender — `docs/BACKLOG.md` item A11, previously flagged but unplaced; became concrete once M1 Slice C started actually sending email. Done 2026-07-29 (`koqep.com` via Cloudflare, `EMAIL_FROM_ADDRESS=noreply@koqep.com` being set in `apps/api/.env`).

## Risks
- The legal check may reveal a real blocker (e.g., a stricter reading of 5651) — mitigation: start it early enough (parallel with M4/M5) that a finding here doesn't become a late surprise that delays launch.
