# Backend — Auth + Plans (Phase 0/1 MVP)

Python/FastAPI backend for login, registration, and the plan/quota schema, per
`lib/PHASES.md` and the plan file's "Auth, Plans & Dashboard Shell" section.

This code was written without a working Python/Postgres environment on this
machine — **it has not been run yet.** Follow the steps below on a machine
with Python 3.12+ and either Docker or a local Postgres install.

## 1. Start Postgres

With Docker (recommended for local dev):

```
docker run --name whatsapp-automation-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=whatsapp_automation -p 5432:5432 -d postgres:16
```

Or point `DATABASE_URL`/`DATABASE_URL_SYNC` in `.env` at any existing Postgres 14+ instance.

## 2. Set up the Python environment

```
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

## 3. Configure environment variables

```
copy .env.example .env
```

Then edit `.env` — at minimum set `JWT_SECRET` and `REFRESH_TOKEN_SECRET` to
real random values (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).

## 4. Run migrations and seed plans

```
alembic upgrade head
python scripts/seed_plans.py
```

## 5. Run the API

```
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/api/health` → `{"status": "ok"}`

## Endpoints (all under `/api/auth`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | `company_name, full_name?, email, password` | Creates a Tenant + User (owner) + trial plan, logs in immediately |
| POST | `/login` | `email, password` | Returns `must_rotate_password` if the stored password no longer meets the current policy |
| POST | `/refresh` | `refresh_token` | Rotates the refresh token |
| POST | `/logout` | `refresh_token` | Revokes it |
| POST | `/forgot-password` | `email` | Always returns success (doesn't leak account existence); emails a reset link when `RESEND_API_KEY` is set |
| POST | `/reset-password` | `token, new_password` | |
| GET | `/me` | — (Bearer token or `access_token` cookie) | |

## What's in the platform

| Area | What it does |
|---|---|
| **WhatsApp** (`/api/whatsapp`) | Connect a number manually (WABA ID, phone number ID, token, app secret) or via Meta Embedded Signup; tokens are encrypted at rest; quality rating, tier, webhook health, test send, template sync |
| **Webhooks** (`/api/webhooks/whatsapp[/{key}]`) | Signature-verified (`X-Hub-Signature-256`), idempotent inbound messages, delivery/read/failed statuses, template status, quality updates, opt-out/opt-in keywords, click-to-WhatsApp ad attribution |
| **Inbox** (`/api/inbox`) | Conversations, live message polling, replies, media, private notes, assign / resolve / labels, human takeover (pauses automation), 24-hour window enforcement |
| **Templates** (`/api/templates`) | Validated builder (header/body/footer/buttons/variables), submit to Meta, sync, status webhooks, delete on Meta, starter library, AI drafting |
| **Broadcasts** (`/api/broadcasts`) | Audience from all/tag/segment/CSV, variable mapping, send-now/schedule, pacing, rate-limit pause + resume, retry failed, delivery/read/reply funnel, CSV export |
| **Automation** | Welcome / away (business hours) / delayed replies, custom replies (exact/contains/any), flow engine (questions with validation, buttons, lists, conditions, delays, webhooks, AI, handoff), event triggers |
| **AI agent** (`/api/ai`) | Knowledge base (text, FAQ, website crawl) with Postgres full-text retrieval, grounded replies via the Anthropic API, confidence-based human handoff, lead qualification, usage metering |
| **Widget** (`/api/widgets`, `/api/public/*`) | Embeddable website chat button + lead capture, click-to-chat links, QR codes |
| **Developer** | API keys + public REST API (`/api/v1`), signed outbound webhooks, Shopify / WooCommerce / Razorpay / Stripe / generic inbound hooks (`/api/hooks/{token}`), Slack notifications |
| **Team** | Roles (owner/admin/agent/viewer), invitations, auto-assignment (round robin / least busy), analytics, notifications |

Design notes: single process by design (see `lib/PHASES.md`). Background work (scheduled broadcasts, flow waits, delayed replies) runs in-process and elects one
leader with a Postgres advisory lock, so two replicas never double-send. Move to Celery/Redis when a trigger in `PHASES.md` fires.

## Testing

```bash
docker run -d --name wa-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wa_test -p 55432:5432 postgres:16-alpine
pip install -r requirements-dev.txt
pytest            # runs migrations on a fresh schema, then ~70 integration tests against a fake Meta Graph API
```

For a manual end-to-end run without a Meta account, start `uvicorn tests.fake_meta_server:app --port 9100` and set `GRAPH_API_BASE=http://127.0.0.1:9100`.

## Not built yet

- WhatsApp Commerce (catalog, checkout bot, orders), WhatsApp Forms (Meta Flows), Voice AI and CRM pipeline — these depend on Meta Commerce / Flows APIs or voice providers and are not part of this build.
- Online payments / subscriptions — plans are enforced (quotas) but upgrades are handled manually.
- Google OAuth sign-in, account lockout beyond IP/account rate limits, multi-workspace switching for one login.

## Deploying (Railway)

The repo ships a production `Dockerfile` and `railway.toml`. On every boot the container runs
`alembic upgrade head` and the idempotent plan seed, then serves on `$PORT`.

1. Create a Railway project, add a **PostgreSQL** service, and add this `backend/` folder as a service.
2. Set these variables on the backend service:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres service's URL (any `postgres://` / `postgresql://` URL works) |
   | `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | two different long random strings (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
   | `ENVIRONMENT` | `production` |
   | `CORS_ORIGINS` | your production frontend origin(s), comma-separated |
   | `CORS_ORIGIN_REGEX` | optional, e.g. `https://.*\.vercel\.app` to allow Vercel preview deploys |
   | `ENCRYPTION_KEY` | a long random string — **required** to store WhatsApp tokens, AI keys and integration secrets; don't rotate it casually |
   | `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | optional platform-level AI key / transactional email (see `.env.example` for the rest) |

3. Generate a public domain, then set `NEXT_PUBLIC_API_URL=https://<domain>/api` on the frontend host and redeploy it.

Health check: `GET /api/health`. Locally the frontend keeps using `frontend/.env.local`
(`http://localhost:8000/api`); that file never reaches the hosted build.

After changing backend code locally, restart uvicorn manually — `--reload` is unreliable on OneDrive folders.

