# 🧠 MindTrace — Seven Days. A Better Understanding of Yourself.

A private, playful **7-day guided self-discovery journey** built with Next.js. Five minutes a day of honest questions → a full personal wellness report, a certificate of completion with QR verification, dashboards, a 30-day continuation — all **stored locally on your own device**. No accounts. No servers. No data leaving your browser.

> MindTrace is a self-reflection tool, **not** a medical, diagnostic or therapeutic service. Crisis resources (Tele-MANAS **14416**, emergency **112** in India) are shown whenever written answers contain distress language.

---

## ✨ What's inside

| Area | Details |
|---|---|
| **Landing page** | Hero, "Why", 7-day journey cards, deliverables, privacy section, CTA |
| **Onboarding** | 13-question conversational wizard + explicit two-part consent; refresh-proof draft autosave |
| **Daily journey engine** | 7 themed question sets (48 curated core questions + 14 fun wildcard 🎲 questions), adaptive follow-ups based on earlier answers, skip-any-question, autosave + resume, per-day streak timer |
| **Crisis safety flow** | Local pattern detection on free-text answers → empathetic full-screen pause with real helplines (Tele-MANAS 14416, AASRA, iCall, 112, befrienders.org). Clearly stated that no alerts are sent on your behalf |
| **Dashboard** | Progress ring, 7-day map, mood line chart, wellness radar, streak, letter-to-future-self vault, personal journal, previous-responses accordion, reminder nudge time, data export/delete |
| **Analysis engine** (`src/lib/analysis.ts`) | Computes self-reported wellness indicators per day, strengths *with quoted evidence*, areas worth attention (with why + what to try), 7-day progress comparison (mood/stress/sleep), summary with explicit *insufficient-information* list, START/REDUCE/CONTINUE/AVOID action plan, daily routine, 4-week plan, criteria-based professional-support checkpoint |
| **Final report** (day 7 only) | Ten sections rendered from all seven days — locked until the journey is complete |
| **Certificate** | Canvas-rendered premium artwork → downloadable **PDF** (hand-rolled PDF writer, zero dependencies) with unique `MT7-XXXX-XXXX` ID + scannable **QR code** (hand-rolled QR encoder, versions 1–5) → `/verify?c=<id>` |
| **Verify page** | Public-looking verification that reveals **only** name, date and participation status |
| **Admin console** (`/admin`) | Password-gated aggregate statistics: profiles, completion funnel, retention-by-day, engagement totals, safety-event count (words never stored), storage health. Journals/letters/answers are structurally invisible |
| **Companion chat** (`/companion`) | Neuro answers your questions *from your own data* — quotes evidence, admits uncertainty, triggers the crisis flow when needed |

## 🚀 Run it locally

```bash
npm run dev
```

Then open **http://localhost:3000**

> Note: this project pins `next dev --webpack` (the `dev` script) because Turbopack is unsupported on some Windows platforms. Your first run may take ~10–20 s to compile.

Production build:

```bash
npm run build   # runs next build --webpack
npm start       # serve the production build on :3000
```

## 📦 Deploy anywhere

- **Vercel / Netlify / Render / Railway / any Node host** — it's a standard Next.js app: `npm run build && npm start` (or connect the repo and let the platform build it).
- Fully client-side by design: after the first HTML load, everything runs in the browser. The app has **zero runtime API routes and zero environment variables**.

## 🔒 Where your data lives

All data is in your browser's `localStorage` under the `mindtrace:*` namespace:

| Key | Contents |
|---|---|
| `mindtrace:users` / `mindtrace:current` | profiles + active profile id |
| `mindtrace:sessions:<uid>` | per-day question sets, answers, skips, timing |
| `mindtrace:journal:<uid>` / `mindtrace:letter:<uid>` | journal entries, day-1 letter vault |
| `mindtrace:reports:<uid>` | generated 7-day reports |
| `mindtrace:certs` | certificate IDs (reveals only name + date on /verify) |
| `mindtrace:safety:<uid>` | crisis-flow event count + resources shown (never the trigger words) |
| `mindtrace:moments:<uid>` | optional 30-day continuation pulses |

Export everything as JSON or delete it permanently from **Dashboard → Data controls**. Clearing browser data also removes it all.

## 🔑 Admin console

Visit `/admin` and use the demo passcode **`MINDTRACE-2026`**. It shows aggregate numbers only (profiles, completion rates, skips, counts of safety events, storage size). There is no code path that exposes journal text, letters or answer contents.

## 🗂️ Project structure

```
src/
  app/
    page.tsx            landing
    onboarding/         consent + profile wizard
    journey/            daily question engine (resume/autosave/crisis gate)
    dashboard/          charts, journal, letter vault, data controls
    report/             day-7 locked analysis report
    certificate/        canvas render + PDF/QR download
    verify/             certificate verification
    companion/          evidence-based companion chat
    admin/              aggregate-only admin console
    globals.css         Tailwind v4 theme (Tailwind-v4 CSS-first @theme)
  components/           Neuro mascot, icons, UI kit, charts (hand-rolled SVG), crisis overlay
  lib/
    types.ts            domain model
    db.ts               localStorage data layer
    questions.ts        the 7-day question bank + selection algorithm
    analysis.ts         report + companion answer engine
    crisis.ts           distress-pattern detection + real resources
    qr.ts               QR encoder (byte mode, levels 1–5, L, spec maps)
    pdf.ts              canvas→JPEG→minimal-PDF writer + certificate art
```

## 🛠️ Interesting engineering bits

- **Zero extra dependencies** — icons are inline lucide-style SVG, charts are hand-rolled SVG, the PDF is assembled byte-by-byte (A4 page + JPEG XObject), and the QR is a full spec-compliant encoder (GF(256) Reed–Solomon, BCH format info, alignment patterns, 8-mask penalty search). Works even when `npm` can't add packages.
- Strict data-locality: `localStorage` reads happen only after mount (`ClientGate`) to avoid hydration mismatches.
- Honest UX guardrails: reports label every number as a *self-reported wellness indicator*, list what the data didn't cover, and never diagnose.

## 🧑‍⚕️ Ethics & safety notes

- Consent asks users to acknowledge the not-medicine disclaimer and the local-storage model before the journey starts.
- The crisis overlay **never** claims to have alerted anyone; it presents direct dial links and ends the session gracefully with one click.
- The certificate states it certifies **participation only** — no assessment, clearance or clinical status.
- Skipping entire questions is normalised ("boundaries count as answers too"); skipped areas are reported as *insufficient information* rather than guessed.

---

Made with 🧠, five minutes at a time. Neuro says hi.
