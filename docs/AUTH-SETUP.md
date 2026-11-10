# Auth & Email setup (Supabase dashboard)

These are **dashboard-only** settings — the app cannot change them itself.
Open your project → https://supabase.com/dashboard (no secrets are recorded in this file).

## 1) Site URL & redirect allowlist *(one-time, required)*

**Authentication → URL Configuration**
- **Site URL:** `http://localhost:3000` during development; your production domain later.
- **Redirect URLs** add:
  - `http://localhost:3000/**`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`

Why: confirmation-password-recovery links must land back inside the app
(`/auth/callback` exchanges the `?code=` for a session).

## 2) Email confirmation + delivery

**Place:** Authentication → Providers → Email

| Setting | Development | Production |
|---|---|---|
| **Confirm email** | **OFF** (instant signup sessions; unblocks local testing) | ON |
| Custom SMTP (Project Settings → Auth → SMTP) | optional | **strongly recommended ON** |

### Why emails may not arrive (the 429 filler)
- The **built-in email service is intentionally rate-limited** (small per-hour/per-IP
  quota). Retrying signup in quick succession returns `HTTP 429` and — importantly —
  **sends nothing at all**, even on the successful-looking attempts.
- Built-in sender mail often lands in **spam** (sender looks like `noreply@mail.app.supabase.io`).
- Signup on an **already-registered** email does NOT re-send the link; use the
  app's **Resend confirmation** button (present on the "check inbox" state and on the
  login screen after an `email_not_confirmed` error).

### Production email (choose one)
- **Brevo / SendGrid / Postmark / Resend** — create an account, verify your domain,
  then in Project Settings → Auth → SMTP enable custom SMTP and fill host/user/pass.
  This removes the strict quota entirely.
- Gmail app-password workaround works but Google throttles it; a real transactional
  provider is the sturdy path.

## 3) Rate-limit facts (why the UI waits instead of retrying)
- `/auth/v1/signup` and resend endpoints: a few requests per minute per IP; triggered
  429s keep a short cooldown window — pressing faster extends waiting.
- The auth pages therefore enforce ≥45–60 s cooldown before any resend.

## 4) Password reset links
`resetPasswordForEmail` redirects to `${origin}/auth/callback?next=/reset-password`
already; nothing else to configure beyond (1).
