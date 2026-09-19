# Build Phases — what to build when, and what NOT to build yet

Companion to the full system design in `C:\Users\saura\.claude\plans\goa-nd-study-proper-drifting-pizza.md`
(§0–§13). That document describes the end-state, production-grade architecture. **This file
is the opposite lens: it says what to actually build on day 1 vs. what to deliberately defer,
and the concrete trigger that tells you it's time to add each deferred piece.**

Rule for every phase below: if a piece of infrastructure exists only because "we'll need it
eventually," it does not go in that phase. It goes in the phase whose trigger condition it
solves. Day 1 has zero traffic — the only thing that matters on day 1 is a real WhatsApp
message going in and out correctly. Everything else is premature until a trigger below fires.

---

## Phase 0 — MVP: one number, real messages, nothing else

**Build:**
- FastAPI app, single process. Plain PostgreSQL (no partitioning, no pgvector, no read
  replicas, no PgBouncer — one connection pool is plenty at zero traffic).
- `tenants`, `users`, `whatsapp_accounts`, `contacts`, `conversations`, `messages` tables —
  the real schemas from the system design (§4.1–4.6), because the *shape* of the data is
  cheap to get right early and expensive to migrate later. Only the *scaling infrastructure*
  around them is deferred, not the schema itself.
- One webhook route: read raw body → verify `X-Hub-Signature-256` (mandatory from day 1 —
  this is a correctness/security requirement, not scale infrastructure, so it is never
  deferred) → write a `webhook_ingress` row → process **inline, in the request handler**
  (no queue yet) → respond 200.
- Inbound dispatch pipeline (§5) implemented as a single Python function called directly from
  the webhook handler — not a Celery task. At zero traffic, a synchronous DB write + maybe one
  outbound Graph API call comfortably finishes well inside Meta's response-time expectations.
- Outbound send: a plain function that calls the Graph API with `httpx`, no retry library, no
  circuit breaker, no rate limiter. Wrap the actual HTTP call in a try/except and log failures.
- Realtime inbox: skip SSE/Redis entirely. The dashboard just polls `GET /conversations/{id}/messages`
  every few seconds. This is fine at low traffic and removes an entire piece of infrastructure
  (Redis, pub/sub, reconnect logic) from day 1.
- No AI, no flow builder, no broadcasts, no templates beyond whatever's needed to send a
  `hello_world`/basic test template.

**Explicitly NOT built yet:** Celery, Redis, pgvector, table partitioning, KMS/envelope
encryption (use a single `ENCRYPTION_KEY` env var for now — upgrade later, see Phase 5), read
replicas, PgBouncer, circuit breakers, rate limiters, OpenTelemetry/Prometheus (basic
structlog + Sentry is enough to know if something breaks).

**Done when:** you can connect a real WhatsApp Business number, send it a message, see it in
a basic inbox, and reply to it, end to end, for real.

---

## Phase 1 — Templates + a working human inbox

**Build:**
- `whatsapp_templates` table + Meta submit/approve flow (§4.7, §7) — this is a hard product
  requirement (Meta requires templates for anything outside the 24h window), not
  infrastructure, so it's not deferrable the way scaling infra is.
- A real inbox UI/API: assignment, read/unread, internal notes (`is_internal` flag on
  `messages`), labels. Still polling-based, still no Redis.
- The 24-hour customer-care-window check before free-form sends (§10) — a correctness rule,
  build it now; it's a cheap `SELECT` query, not infrastructure.

**Still not built:** everything in the "not built yet" list from Phase 0 still applies.

**Done when:** a real small business could actually run their WhatsApp support through this,
manually, no automation.

---

## Phase 2 — Basic AI auto-reply (keyword search first, not vector search yet)

**Build:**
- `knowledge_sources` + `knowledge_chunks` tables, but **skip embeddings and pgvector for
  now.** Use Postgres full-text search (`tsvector`/`GIN` index) for retrieval. This is
  deliberately the same shortcut LeadForGrow took — and the system design calls that out as a
  thing to eventually fix — but "eventually" is the point: a full-text index is a five-minute
  setup, an embedding pipeline is real infrastructure (a provider integration, a chunking
  strategy, a vector index), and at low knowledge-base sizes full-text search is genuinely not
  worse in practice. Add the `embedding VECTOR` column later without needing to touch anything
  else (see trigger below).
- The AI agent (§8): keyword handoff gate → full-text retrieval → LLM call → confidence.
  Confidence can start as the simple LFG-style "chunk count" heuristic — the reranker +
  structured self-reported confidence from the system design is a quality upgrade, not a
  correctness requirement; do it when you have real conversations to notice the heuristic
  getting things wrong on.
- `inbox_status = 'intervened'` human-takeover suppression (§4.5, §8) — build this now, it's
  one column and one guarded `UPDATE`, and getting it wrong means AI talks over a human, which
  is a correctness bug, not a scale concern.

**Trigger to upgrade retrieval to real pgvector embeddings:** a knowledge base's full-text
search starts giving visibly wrong/irrelevant answers on real customer questions, OR any
tenant's knowledge base grows past a few hundred chunks where keyword search's recall
noticeably degrades. Until that happens, don't build the embedding pipeline.

**Still not built:** Celery/Redis, partitioning, circuit breakers, reranker.

---

## Phase 3 — The flow/automation builder (synchronous scheduling, still no Celery)

**Build:**
- `automation_flows` / `automation_executions` / `automation_execution_events` (§4.8, §6) —
  the graph model and publish-time validation (dedupe edges, require non-empty conditions,
  require every branch wired, require a reachable end node, require `timeout_minutes` on
  waits) are built from day 1 **because they're validation logic, not scaling infrastructure**
  — they cost nothing at low traffic and are exactly the bugs LeadForGrow hit in production.
- Delay/wait resumption: **no Celery yet.** Use a single lightweight cron-style loop — one
  `asyncio` background task in the same FastAPI process (or a tiny separate script run every
  60s via a system cron / a simple `while True: sleep(60)` process) that polls
  `automation_executions WHERE status='waiting' AND wait->>'until' < now()` and resumes them.
  This is exactly the "cron-polling" pattern the system design flags as inferior to
  Celery-eta scheduling — and at low traffic it is completely fine. The system design's
  criticism of polling was about *reliability under scale and multi-instance deployment*, not
  about polling being wrong in general.
- Execution debug endpoint (`GET .../executions/{id}/events`) — build it alongside the engine,
  not after; debugging a stuck flow with zero visibility is miserable regardless of scale.

**Trigger to move delay/wait scheduling to Celery + Redis (`apply_async(eta=...)`):** you
deploy more than one backend process/instance (polling from multiple instances risks double
handling unless you add `FOR UPDATE SKIP LOCKED`, which is itself a sign you've outgrown the
single-process assumption), OR delay precision matters (polling is only as precise as your
poll interval — fine for "wait 1 day," not fine for "wait 30 seconds"), OR you're restarting
the process often enough that in-flight polling loops become unreliable.

---

## Phase 4 — Broadcasts (still a simple loop, still no queue)

**Build:**
- `broadcasts` / `broadcast_recipients` (§4.9). Sending: a straightforward loop over pending
  recipients with a small delay between sends (mirrors LeadForGrow's original approach) run as
  a FastAPI `BackgroundTask` or the same lightweight background process from Phase 3 — not
  Celery.
- The Meta quality-rating circuit breaker logic (§7) — this is a correctness/compliance
  safeguard (protects the phone number from getting throttled by Meta), not scaling
  infrastructure, so it's built now even though nothing else about broadcasts is "production
  scale" yet.

**Trigger to move broadcast sending to a real queue (Celery + Redis, batched tasks):** a
broadcast's recipient count is large enough that the synchronous loop risks an HTTP timeout or
ties up the single background process for minutes (a good concrete line: once broadcasts
regularly exceed a few hundred recipients), OR you need broadcasts to survive a process
restart mid-send.

---

## Phase 5 — Introduce Celery + Redis (one migration, not a rewrite)

**This is the phase where the "not built yet" list from Phases 0–4 actually gets built,** all
at once, because by this point you have the concrete trigger(s) that justify it:
- Redis + Celery (broker, worker pool, Beat).
- Move: flow delay/wait resumption (Phase 3) to `apply_async(eta=...)` + Beat sweeper backup;
  broadcast sending (Phase 4) to batched Celery tasks with per-account rate limiting; webhook
  processing itself from "inline in the request handler" to "enqueue, ack fast, process
  async" (§5) — do this specific move as soon as *any* single webhook-triggered action (an AI
  call, a flow start, a slow DB query) risks pushing response time close to what's comfortable
  for Meta's webhook delivery, even before broadcasts/flows justify it.
- Redis-backed circuit breaker + rate limiter for outbound Graph API calls (§3, §11) — add
  once you've actually seen a 429/quality-drop from Meta, not preemptively.

**Trigger:** any one of the individual triggers in Phases 3/4/§5 above fires, or you're about
to onboard a customer whose expected volume makes "no queue" clearly wrong ahead of time.

---

## Phase 6 — Scale hardening (only when real usage demands it)

Each item here has its own independent trigger — don't do all of them together "to be safe":

| Deferred piece | Trigger to actually build it |
|---|---|
| `messages` table partitioning (§4.6) | Table size/row count starts making queries or vacuum noticeably slow — a concrete signal, not a calendar date. Rough ballpark: tens of millions of rows, but watch `pg_stat` query times, don't guess. |
| pgvector real embeddings (if not already added in Phase 2) | Per the Phase 2 trigger. |
| Reranker + structured LLM confidence (§8) | You've observed the simple chunk-count confidence heuristic mis-firing (bad handoffs or bad auto-replies) on real conversations. |
| KMS-based envelope encryption (replacing the single `ENCRYPTION_KEY` env var) | Before onboarding your first real paying customer's real WhatsApp token — this is a security bar tied to "real customer data exists," not a traffic bar. Don't wait for scale to do this one; do it before Phase 0 goes live with a real (non-test) WABA. |
| Read replicas | Reporting/analytics queries start visibly competing with live traffic for primary DB capacity. |
| PgBouncer | Connection count from API+worker pods approaches Postgres's `max_connections` — i.e., you've actually scaled to multiple pods. |
| Postgres Row-Level Security (defense-in-depth tenant isolation) | Before onboarding a second real tenant whose data must never leak to the first — a correctness/security bar, do this early, independent of traffic. |
| OpenTelemetry tracing | You've had an incident where "which of these five async steps was slow" was hard to answer from logs alone. |
| SSE realtime inbox (replacing polling) | Users complain the inbox feels laggy, or your polling interval is generating meaningful load on its own. |

---

## The one-line version

Build the **schemas and correctness/security rules** for the full feature set early (they're
cheap and hard to retrofit). Build the **scaling infrastructure** (queues, partitioning,
caches, circuit breakers, replicas) only when a concrete trigger in this file fires, not
because the system design mentions it. Day 1 has no traffic — the only failure mode that
matters on day 1 is "the message didn't send or didn't arrive," not "this won't scale to a
million users yet."
