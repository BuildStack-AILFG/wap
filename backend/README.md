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
| POST | `/forgot-password` | `email` | Always returns success (doesn't leak account existence); logs the reset token server-side for now — wire up real email sending in Phase 1+ |
| POST | `/reset-password` | `token, new_password` | |
| GET | `/me` | — (Bearer token or `access_token` cookie) | |

## What's deliberately NOT here yet (see `lib/PHASES.md`)

- No Redis/Celery — everything runs inline in the request handler, which is
  correct for zero traffic.
- No email sending for password reset — the raw token isn't emailed anywhere
  yet; wire up a provider (Resend/SendGrid) when this is actually needed.
- No Google OAuth, no real Stripe/Razorpay billing — `plan_id` just defaults
  to `'trial'` on signup.
- No account lockout after failed attempts.

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

3. Generate a public domain, then set `NEXT_PUBLIC_API_URL=https://<domain>/api` on the frontend host and redeploy it.

Health check: `GET /api/health`. Locally the frontend keeps using `frontend/.env.local`
(`http://localhost:8000/api`); that file never reaches the hosted build.

After changing backend code locally, restart uvicorn manually — `--reload` is unreliable on OneDrive folders.

