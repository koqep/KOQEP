# M1 — Real Auth: Invite Signup + Login

*Seed dev-login gerçek davetiye tabanlı kayıt ile değişir; opsiyonel TOTP, token akışı, şifre sıfırlama ve minimum bir güvenlik ağı (block) eklenir.*

**Goal:** Replace M0's seeded dev-login with real invite-gated signup, optional TOTP, and a working token lifecycle — plus the smallest possible abuse safety net.
**Demo:** A tester redeems a real invite code, creates an account, optionally turns on TOTP, logs in and out, resets their password, and blocks a test account.
**Estimated hours:** 55–85h (TOTP + recovery codes and a correctly-tested token/reset flow are the biggest single cost in the whole plan — see capacity check).

## Out of scope
- Invite-per-level-up (reputation doesn't exist until M4) — use a small founder-issued invite pool for now.
- User-created rooms (M3).
- Moderation tooling beyond block (M5).

## Acceptance criteria
- [ ] A real external tester can redeem an invite code and create an account.
- [ ] TOTP is available and optional; enabling it issues recovery codes.
- [ ] Login issues an access + refresh token; refresh rotates correctly.
- [ ] Password reset follows `docs/THREAT-MODEL.md` row 11: single-use/short-TTL reset link, email notification on reset, all sessions revoked on password change; if TOTP is enabled, reset alone does not grant login.
- [ ] A user can block another user, and blocked users can't message them.
- [ ] Tests cover signup, login, TOTP setup+recovery, password reset, and block.

## Tasks
- [ ] Invite code model + redemption endpoint (founder-issued pool for now).
- [ ] Signup + login endpoints, access/refresh token issuance (ADR-0002).
- [ ] TOTP setup + recovery codes (optional).
- [ ] Password reset flow with the THREAT-MODEL row-11 controls.
- [ ] Block-user feature.
- [ ] Tests for each flow.

## Risks
- TOTP recovery UX is the top solo-support-burden risk identified in Phase 1 — mitigation: the founder personally runs the recovery-code flow start to finish before any real invite goes out.

## Earliest real-user point
**This is it — end of M1, not M2 or later.** A real invited stranger can sign up, optionally enable TOTP, and talk in the one room that exists so far, with a block button as a safety net. Shipping this at M0 (seeded login, zero abuse controls) would not be defensible. Waiting until M5 (full report flow + moderator audit log) to add *any* safety net would be over-cautious for a small, personally-vouched-for invite tree — a single individual's ability to stop unwanted contact is enough at this stage. That's why block-user is pulled into M1 instead of deferred with the rest of moderation tooling.
