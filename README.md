# MUTMLSA Backend

Express + PostgreSQL (Supabase) API powering the MUTMLSA site — membership
applications, member/payment tracking, chat assistant, newsletter, and
site games.

## Stack

- **Express** — REST API
- **PostgreSQL** via **Supabase** — connected directly via `pg` (not
  Supabase's client SDK), so RLS should be enabled on every table since
  the backend bypasses it via a direct connection string
- **Groq** — powers the chat assistant (`openai/gpt-oss-120b`)
- **Resend** — optional email notifications on new submissions

## Tables

- `membership_applications` — Join form submissions (status: pending/confirmed)
- `members` — confirmed members, with `registration_paid` (one-time) status
- `semester_payments` — per academic-year/semester payment tracking
- `contact_messages` — general contact form submissions
- `newsletter_subscribers` — email-only newsletter list
- `bingo_cards` — Bingo game state (`filled_squares` JSONB, name-based lookup)
- (Lab Quiz / Speed Round tables, if persisted — see their respective model files)

## Key endpoints

| Route | Purpose |
|---|---|
| `POST /api/membership/apply` | Join form submission (rate-limited, dedupes by email) |
| `POST /api/contact` | Contact form (rate-limited) |
| `POST /api/chat` | Chat assistant (rate-limited), with keyword-based campus location lookup |
| `GET/POST/PATCH /api/admin/members/*` | Admin-only: applications, members, payment status (password-gated) |
| `POST /api/newsletter/subscribe` | Public newsletter signup |
| `GET /api/newsletter` | Admin-only: subscriber list |
| `POST /api/newsletter/backfill` | Admin-only: add existing members to subscriber list |
| `POST /api/newsletter/backfill-applications` | Admin-only: add all applicants (confirmed or not) |
| `POST/GET/PATCH /api/bingo/*` | Bingo card creation, lookup by name, square fill/clear, leaderboard |

## Security

- Admin routes protected by a single shared password (`x-admin-password`
  header, checked via `adminAuth` middleware) — appropriate for a small
  club's trust level, not a full auth system
- Rate limiting (`express-rate-limit`) on public forms, admin login
  attempts, and the chat endpoint
- CORS restricted to the deployed frontend via `FRONTEND_URL`
- All secrets (DB connection string, Groq/Resend API keys, admin
  password) live in environment variables, never committed

## Keeping the service awake

Render's free tier sleeps after ~15 minutes idle. A GitHub Actions
workflow (`.github/workflows/keep-alive.yml`) pings `/health` every 10
minutes, which also runs a trivial Supabase query — this keeps both
Render and Supabase active and avoids cold-start delays for real visitors.

## Environment variables

DATABASE_URL=
DB_SSL=true
PORT=4000
FRONTEND_URL=
ADMIN_PASSWORD=
GROQ_API_KEY=
RESEND_API_KEY= (optional)
NOTIFY_FROM_EMAIL= (optional)
NOTIFY_TO_EMAIL= (optional)


## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run dev
```

Tables are created automatically on startup — no manual migrations.

## Deployment

Deployed on **Render** (free tier), connected to a **Supabase** Postgres
database via the pooler connection string.
