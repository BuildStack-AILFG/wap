# Study LeadForGrow's WhatsApp automation + plan a build for whatsapp-automation/backend

**Status: DONE.** Jump to [**§0–§13: the full system design**](#system-design-whatsapp-business-automation-platform) at the bottom of this file for the actual deliverable — everything above it is the supporting research that informed it.

## Context
The user wants a deep study of how `leadforgrow` (a mature, working product at
`C:\Users\saura\OneDrive\Desktop\leadforgrow`) implements WhatsApp automation end-to-end —
not just the marketing site (already covered in an earlier homepage task), but the real
product: Meta WhatsApp Business API integration, message templates, the no-code chatbot/flow
builder, broadcasts, AI auto-replies, and the underlying chat data model — so that the
(currently empty) `whatsapp-automation/backend` project can be built the same way.

Research is split across 3 parallel Explore agents:
1. Meta WhatsApp API integration & webhooks (send/receive, credentials, signature verification)
2. Templates, chatbot/flow builder engine, broadcasts, sequences
3. AI auto-reply engine (Python RAG backend) + core Conversation/Message data model + message
   dispatch/orchestration logic

## Status
Research complete (3 Explore agents + a follow-up read on lead-capture-from-Meta-Ads) and
synthesized into a full staff-level system design by a Plan agent (below, §0–§13). This *is*
the deliverable the user asked for — no code has been written; the user will review this
design and discuss it before any implementation begins.

## User's decisions (from clarifying questions)
- **Scope**: Full system — templates, visual flow builder, broadcasts, sequences, AI reply,
  and the realtime inbox, all for WhatsApp only. Also include how leads arrive via Meta Ads/
  integrations (researched below). This plan is the deliverable for now — no code yet; the
  user will review this design in a UI/discussion pass before implementation starts.
- **Backend language**: **Python** (not Node — a deliberate departure from LeadForGrow's
  stack; the plan must translate every JS pattern above into Python-idiomatic equivalents:
  FastAPI, Celery/RQ, SQLAlchemy, etc.)
- **Database**: delegated to me. Recommendation (to justify in the final design): **PostgreSQL
  as the single primary datastore** (with JSONB columns for flexible parts — flow node/edge
  data, custom fields, conversation metadata) + **pgvector extension for real embedding-based
  RAG** (fixes LeadForGrow's fake `$text`-search RAG) + **Redis** for cache, realtime pub/sub,
  and as the Celery broker. One primary datastore (vs. Mongo) gives relational integrity for
  multi-tenant correctness and directly avoids LeadForGrow's own documented tech debt (two
  parallel conversation models, missing indexes per `audit-db.md`) via one normalized schema
  instead of two competing document shapes.
- **Scale target**: explicitly "production-grade, no failures at scale, built so a very large
  number of users/businesses can run on it" — the design must address horizontal scalability,
  queue-driven async processing (not the synchronous broadcast-loop anti-pattern found in
  LeadForGrow), sharding/partitioning for the Message table, caching, rate limiting, circuit
  breakers for Meta API calls, and observability — not just feature parity.

---

## Follow-up research: lead capture via Meta Ads / integrations (`lib/meta/leadgenHandler.js`, `models/automation/Lead.js`)

- **Flow**: Meta sends a `leadgen` webhook change (`field:'leadgen'`, `value:{leadgen_id,
  page_id, form_id}`) → business resolved by Page ID (`findBusinessByMetaPageId`, checking the
  generic `Integration` model first, then a legacy `Business.integrationCredentials.
  facebookAds.pageId` fallback) → `processMetaLeadgenWebhook()` fetches full lead field data
  from Graph API (`getMetaLeadDetails(leadgenId, accessToken)` — the webhook payload itself
  only contains IDs, not the actual submitted answers, so a follow-up Graph call is mandatory)
  → `leadManager.processMetaLead(businessId, leadPayload)` upserts a `Lead` doc → logged to
  `IntegrationLog`. On an expired/invalid token, the owning `Integration` is marked
  `needs_reauth` rather than silently failing repeatedly.
- **Dedup**: partial unique index on `{businessId, metaLeadId}` (only when `metaLeadId` is a
  string) prevents double-processing the same Meta lead; a second partial unique index on
  `{businessId, whatsappId}` similarly dedupes WhatsApp-originated leads. This partial-index
  dedup pattern (rather than app-level "check then insert") is worth reusing directly.
- **`Lead` schema fields relevant to ad/WhatsApp attribution**: `source` (enum incl. `whatsapp,
  webhook, ad, meta_ads, instagram_ad, facebook_ad, bot, referral`), `adId, metaLeadId,
  campaignName, adSetName, adName, adHeadline, adSourceType, referralData (Mixed), formId,
  whatsappId (Meta WA id, indexed), optedOutOfWhatsApp/optedOutAt/optedOutReason` (compliance —
  built directly into the Lead, checked by `buildAudience()` for every broadcast).
- **Click-to-WhatsApp ads**: a *different* path than the leadgen form webhook — when a user
  taps a "Send Message" ad and messages the business number directly, that arrives as a normal
  WhatsApp inbound message whose `message.referral` object (parsed in Agent 1's `parseMetaWebhook`)
  carries `source_type/ad_id/headline/source_url` — i.e. **ad-attributed leads can arrive via
  two entirely different webhook shapes** (a `leadgen` form-fill event vs. a WhatsApp message
  with `referral` metadata) and both must set the same attribution fields on the `Lead`/
  `Conversation`. The fresh build should normalize both into one "lead attribution" write path
  rather than duplicating the field-setting logic per source, unlike what the field-name
  overlap here suggests LeadForGrow may be doing.
- **Reusable pattern**: resolve tenant (business) by external ID (Page ID / phone_number_id)
  *before* any Graph API call, verify/refresh integration health inline (mark `needs_reauth` on
  token failure so the UI can prompt reconnection), and always write an `IntegrationLog` entry
  regardless of outcome — same audit-everything philosophy as `MetaWebhookIngress`.

---

## Agent 1 findings: Meta WhatsApp Cloud API integration (send/receive/webhooks)

### End-to-end flow
- **Outbound:** `sendAutoWhatsApp(lead, business, template, ...)` in `lib/integrations/whatsapp.js`
  → picks Meta or Interakt provider → `sendMetaMessage()` builds Graph API payload →
  `fetchExternal()` POSTs `https://graph.facebook.com/v21.0/{phoneNumberId}/messages` →
  stores returned `wamid` via `recordOutgoingMessage()` (writes to both the modern
  omnichannel Message/Conversation model AND a legacy `WhatsAppConversation` model, keyed by
  phone number without leading `+`, for compatibility).
- **Inbound:** Meta POSTs to a webhook route → raw body captured → `MetaWebhookIngress` audit
  doc created first → `X-Hub-Signature-256` verified (HMAC-SHA256, `crypto.timingSafeEqual`)
  → payload routed by shape (statuses / template-status / leadgen / Instagram / messages) →
  `parseMetaWebhook()` normalizes → `leadManager.processIncomingMessage()` upserts a Lead and
  records the message (and can trigger automation).
- Two overlapping webhook routes exist: `app/api/webhooks/meta/route.js` (single shared URL,
  resolves business from payload's `phone_number_id`) and
  `app/api/webhooks/meta/[businessId]/route.js` (per-business URL, business from path param).
  **For the fresh build, pick ONE pattern** (recommend per-business path param — simpler
  tenant resolution, no ambiguity) rather than maintaining both.

### Connecting a number (setup)
No embedded signup — fully manual "paste your own credentials" via a generic integrations
catalog (`lib/integrations/catalog.js`, id `whatsapp-cloud`):
```
accessToken (permanent token, secret), phoneNumberId, businessAccountId (WABA ID), verifyToken (secret)
```
Verify/test = `GET /{phoneNumberId}` (returns `verified_name`, `display_phone_number`),
optionally send a real `hello_world` template to a test number. Quality/tier check before
broadcasts: `GET /{phoneNumberId}?fields=quality_rating,messaging_limit_tier,throughput,status`.

### Data model (fields to reuse)
- `Business.integrationCredentials.whatsapp`: `enabled, provider(meta|interakt), apiKey(AES-256-CBC
  encrypted), phoneNumberId, businessAccountId, appId, appSecret, verifyToken, lastVerified` —
  indexed on `phoneNumberId` and `businessAccountId` for webhook→tenant resolution.
- Newer generic `Integration` model (provider-agnostic): `businessId, integrationId, status,
  health, credentials, oauth{accessToken(select:false),...}, sync{...}, webhook{events,
  retryRules{maxRetries,backoffSeconds}, secretKey(select:false)}, accountInfo{...}`.
- `IntegrationLog`: activity trail (`action, status, message, metadata, durationMs`), TTL 90 days.
- `MetaWebhookIngress`: full raw audit log per webhook POST (`headers, rawBody, payload,
  signature{received,expected,verified,secretSource}, parsed{...}, processing{step,result,error},
  outcome`), TTL 30 days — **good pattern: log every webhook call regardless of outcome.**
- Secrets encrypted at rest via `lib/encryption.js` (AES-256-CBC, `iv:ciphertext`, key from
  `ENCRYPTION_KEY` env).

### Sending — reusable implementation details
- Endpoint: `POST /{phoneNumberId}/messages`, `Authorization: Bearer <token>`.
- **24h customer-care window enforced client-side** before calling Meta: checks for an
  inbound Message in the last 24h before allowing free-form text (no template) — fails fast
  with a clear error instead of a real API error 131047.
- Template payload built from the *stored* `WhatsAppTemplate` doc's components (not
  caller-supplied), filling `{{n}}` placeholders; media headers must be a public `link` URL at
  send time.
- Parameter sanitization: strip `\r\n\t`, collapse long space runs, cap 1024 chars.
- Media: `lib/integrations/whatsappMedia.js` — image/video/document/audio via `{type, [type]:
  {link, filename?, caption?}}`.
- Interactive: `lib/integrations/whatsappInteractive.js` — buttons (max 3, 20-char titles) and
  lists (max 10 sections × 10 rows, Meta's exact limits mirrored in validation).
- Template management (`lib/whatsapp/templates.js`, axios-based): `fetchMetaTemplates()`
  (paginated, `requestWithBackoff()` **honors `Retry-After` on 429**), `createMetaTemplate()`,
  `getMetaTemplateById()`, `deleteMetaTemplate()`, `uploadMediaToMeta()` (Meta's two-step
  Resumable Upload API for template header samples).
- Error decoding: `lib/whatsapp/metaErrors.js::decodeMetaError()` — hand-maintained map of
  Meta error codes (131047 window closed, 131048 rate limit, 131049 quality-drop, 132012 param
  mismatch, 190 token expired, 10 permission denied) → `{title, explanation, actionable}` —
  **worth copying verbatim as a support-friendly error UX pattern.**

### Receiving — verification & parsing
- GET handshake: compare `hub.verify_token` to stored/expected token, echo `hub.challenge`.
- Signature verify: `lib/webhookSecurity.js::verifyMetaSignature()` — HMAC-SHA256 over **raw
  body string**, `crypto.timingSafeEqual`. Candidate secrets gathered from business's meta-ads
  Integration record, env `META_APP_SECRET`, legacy credential fields.
- Parsing: `lib/whatsapp/parser.js::parseMetaWebhook()` normalizes by `message.type` (text,
  media, button, interactive list/button reply) and extracts ad-click `referral` attribution.
- Routing order in the POST handler: leadgen → Instagram → template-status-update →
  WhatsApp delivery/read/failed statuses → WhatsApp inbound message (fallback).
- Status webhook (`lib/omnichannel/messageStatus.js::processWhatsAppStatuses`): maps
  sent/delivered/read/failed, updates matching `Message` docs by wamid, updates
  `Broadcast.recipients[].status` + analytics counters, emits realtime event, logs failures to
  an Activity timeline with decoded error.
- **Always respond HTTP 200** even on internal failure (Meta disables webhooks on non-2xx).

### Security bugs documented in their own audits — avoid these in the fresh build
1. Test/inject webhook endpoints sat under the public unauthenticated `/api/webhooks/` prefix
   in production — **never expose test/debug webhook endpoints outside dev.**
2. Instagram webhook branch processed with **zero signature verification**; leadgen branch
   only verified "if a header was present" — **verify signature unconditionally, before any
   DB write, for every payload branch**, not just the final message branch.
3. A token-check helper "failed open" (returned `true`) when its expected env var was unset —
   **never let a missing secret silently disable verification; refuse instead.**
4. Two near-duplicate signature-verification modules existed (one dead/unused) — keep exactly
   one signature-verification implementation.

### Recommended shape for the fresh build (backend)
One webhook route that: (a) reads raw body first, (b) verifies `X-Hub-Signature-256`
unconditionally before any DB write for every payload shape, (c) resolves tenant only after
signature passes, (d) logs every request to an ingress-audit collection regardless of outcome,
(e) responds 200 fast and defers heavy processing. Centralize the Graph API version
(`v21.0`) as one constant rather than repeating the literal.

---

## Agent 2 findings: Templates, flow builder, broadcasts, sequences, worker

### Templates (`WhatsAppTemplate` model, `lib/whatsapp/templates.js`)
- Fields: `name` (regex-enforced, unique per business+name+language), `language`, `category`
  (MARKETING/UTILITY/AUTHENTICATION), `status` (DRAFT/PENDING/APPROVED/REJECTED/DISABLED/PAUSED),
  `isDeleted` (soft delete), `source` (native/imported), `components[]` (HEADER/BODY/FOOTER/
  BUTTONS with `example.body_text` sample values for `{{n}}` placeholders and
  `example.header_handle`/`header_media_url` for media headers), Meta sync fields
  (`metaTemplateId, metaStatus, metaRejectionReason, metaCategoryChangedTo, metaSubmittedAt`).
- `toMetaPayload()` doc method converts to the exact Graph API submission shape.
- Lifecycle: create DRAFT → `validateTemplate()` (counts `{{n}}` placeholders against provided
  examples, enforces char limits) → `createMetaTemplate()` → status becomes PENDING → synced
  both **push** (via `message_template_status_update` webhook) and **pull** (`refresh`/`sync`
  endpoints, `fetchMetaTemplates()` bulk-imports templates created directly in Meta Business
  Manager).
- Variable filling at send time always uses the *stored* template as source of truth (not
  caller-supplied), sanitizes each param, falls back to `lead.name` if a slot is empty.
  Free-form sends gated by the same 24h-window check from Agent 1.

### WhatsApp Flow Builder — the real no-code chatbot engine (`lib/whatsappFlows/**`)
**This is a React-Flow graph (nodes+edges), separate from the unrelated `app/automation/chatbot`
folder (which is just an embeddable *website* widget, source-tagged `Bot` — not WhatsApp at all;
don't conflate the two when building.)**

- `WhatsAppFlow`: `businessId, name, status(draft/published/archived), triggerType
  (incoming_message/keyword/contact_created/lead_created/manual/webhook), triggerConfig
  (e.g. {keywords, matchMode}), edges[], version/publishedVersion, webhookSecret,
  analytics{totalExecutions, completed, failed, active, dropped, conversions}`.
- Nodes in a separate `FlowNode` collection (`flowId, nodeKey, type, position{x,y}, data,
  analytics{entered,completed,dropped}`). **On publish, a full snapshot
  (`publishedSnapshot: {nodes, edges, triggerType, triggerConfig}`) is written — the engine
  only ever executes the snapshot, never the live-edited draft**, so editing after publish is
  safe. `FlowVersion` stores history for rollback.
- Node type catalog: triggers (incoming_message, keyword, contact_created, lead_created,
  manual, webhook); actions (send_template, send_text, send_image/video/document/audio,
  send_buttons, send_list, delay, add_tag/remove_tag, update_lead, create_lead, http/webhook,
  ai_response, end); logic (wait_reply, if_else, switch, goto, save_variable).
- **Execution engine** (`lib/whatsappFlows/engine.js`) — a per-contact state machine:
  `FlowExecution` (`flowId, leadId, phone, status(active/waiting/completed/failed/cancelled/
  test), currentNodeKey, wait{type:reply|delay, until, saveAs, expectedButtons}, variables
  (mixed bag, {{key}} substitution via renderTemplate), logs[]` append-only trace).
  `continueExecution()` is a while-loop over `nextNodes(edges, sourceKey, handle)` (handle =
  'default'/'true'/'false'/switch-case), capped at `MAX_STEPS=40`, stopping when a node
  returns `{wait}` or `{end:true}`.
- Trigger matching (`matchAndStartFlows`) dedupes: won't start a new execution if one is
  already active/waiting for that lead+flow.
- Resume paths: `resumeFlowWaitForReply` (finds waiting `wait.type:'reply'` executions for a
  lead, saves the reply into `variables[wait.saveAs]`, continues) and
  `resumeDueFlowDelays(limit)` (polls `wait.type:'delay'` executions past `wait.until` —
  **polling-based, not event-driven**, called both by a `setInterval` in
  `workers/automation-worker.js` and by `app/api/cron/whatsapp-flows/route.js` as a serverless
  backup, because a naive single scheduler dies on redeploys/serverless cold starts).
- Wired into the inbound pipeline: `leadManager.js` calls `resumeFlowWaitForReply` first; only
  if nothing resumed does it call `matchAndStartFlows` — **if a flow claims the message, AI
  auto-reply (Agent 3's findings) is skipped entirely for that message.**
- Also triggerable via a public per-flow webhook (`POST /api/automation/whatsapp-flows/webhook/
  [secret]`) for external system integration, and manual start/test from the builder UI.

**Concrete flow JSON shape** (from real example export `garage-flow-fixed.json`):
```json
{
  "format": "leadforgrow-whatsapp-flow", "version": 1,
  "flow": { "name": "...", "triggerType": "incoming_message", "tags": [...] },
  "nodes": [
    { "id": "trigger_1", "type": "trigger_incoming_message", "position": {"x":50,"y":50}, "data": {...} },
    { "id": "action_welcome", "type": "action_send_template", "data": {"templateName":"garage_welcome","language":"en"} },
    { "id": "wait_vehicle_type", "type": "logic_wait_reply", "data": {"saveAs":"vehicle_type","timeoutMinutes":1440} },
    { "id": "list_services", "type": "action_send_list", "data": {"body":"...","sections":[...],"saveAs":"service"} }
  ],
  "edges": [ { "id": "...", "source": "...", "target": "...", "sourceHandle": "default|true|false" } ]
}
```

### Broadcasts (`Broadcast` model, `lib/broadcasts/engine.js`)
- `audience{type: manual|tags|filter, ...}`, `content{body, whatsappTemplate,
  whatsappTemplateName, variableMapping[]}`, `recipients[]`, `analytics{total,sent,failed,
  qualityDrops}`.
- `buildAudience()` always excludes opted-out leads per channel, caps at `limit||5000`.
- **`sendBroadcast()` is a synchronous in-process loop with a fixed 400ms throttle between
  sends — NOT a real queue.** Explicit comment acknowledges this only works for <100
  recipients within a serverless HTTP timeout. Has a genuinely good guardrail worth keeping:
  every 10 attempts, checks if Meta quality-drop error codes (131049/131050/131026) exceed 20%
  and aborts remaining sends if so (protects the phone number's quality rating).
- **Rebuild recommendation: don't copy the synchronous loop.** Enqueue one job per
  batch/recipient in BullMQ and let a worker drain it with rate limiting — keep the
  quality-drop circuit breaker, just move it into the worker.

### Sequences — a second, more advanced graph engine (`lib/sequences/engine.js`)
- `AutomationSequence`: `workflowMode: graph|linear`, graph mode uses the same node/edge shape
  as flows; linear mode uses `steps[]` (`delayDays, channel, messageTemplate, exitOnAnyReply,
  exitKeywords[], pauseOnReply, isGoal`) plus A/B test variants.
- `SequenceExecution`: `currentNodeId, status, context{activeWait, loopCounts, parallel{}},
  logs[]`.
- **Key architectural difference from the flow engine: delays are real BullMQ-scheduled jobs**
  (`queueWorkflowNode()` → `automationQueue.add('workflow-node', {...}, {delay})`), not
  cron-polled — this is the better pattern of the two.
- Supports delay/wait_until, event-waits (wait_reply/wait_payment/wait_meeting/wait_deal_won
  with timeout branch), condition/split, loop (max iterations), parallel_branch/merge, goto.
- `resolveWait(leadId, eventType)` lets any part of the app wake a sequence early
  (atomic findOneAndUpdate to prevent double-resolution races).

**Architectural wart flagged for the rebuild**: LeadForGrow ended up with **two parallel
graph-execution engines** (WhatsApp flows vs. sequences) with overlapping node/edge concepts
but different scheduling strategies (cron-polling vs. real delayed jobs) and different Mongo
collections. **A clean rebuild should unify these into one graph-execution engine with
pluggable trigger types, using the BullMQ-delayed-job pattern everywhere** (not the
cron-polling pattern — see pitfalls below for why polling caused real bugs).

### Worker & queue (`workers/automation-worker.js`, `lib/queue.js`)
- Standalone process (`IS_WORKER=true`) running a BullMQ `Worker` on `automation-queue`
  (job types: lead-trigger, sequence-step, workflow-node, email-auto-reply), plus two
  `setInterval(60s)` loops: `resumeDueFlowDelays(50)` and `processDueTasks()`.
- `defaultJobOptions: {attempts:5, backoff: exponential 5s, removeOnComplete:true,
  removeOnFail:false}`; failed-after-5-attempts jobs logged to a `FailedJob` dead-letter
  collection.
- **Graceful degrade**: if `REDIS_URL` is unset/erroring, queue functions fall back to
  synchronous execution or `setTimeout` in-process — app "works" without Redis but loses
  durability and delayed jobs die on process restart. (Reasonable pattern for dev; for
  production scale, require Redis.)
- `app/api/cron/whatsapp-flows/route.js` — external cron backup (Vercel Cron/GitHub Actions),
  `CRON_SECRET`-protected, calls the same `resumeDueFlowDelays(100)` — belt-and-suspenders
  because serverless platforms don't keep `setInterval` processes alive.

### Documented production pitfalls (`FLOW_FIX_QUICK_START.md`, `WHATSAPP_FLOW_ISSUES.md`) —
### build these safeguards in from day one, not as a later patch:
1. **Duplicate edges** confuse node-lookup — dedupe edges on save/import.
2. **Empty condition values** (`{operator:'contains', value:''}`) always match — validate
   non-empty required fields at save/publish time.
3. **Missing false branches** on if/else — flow silently halts (not fails) when a condition's
   unwired branch is hit. Publish-time validator must require every handle wired.
4. **No terminal node reachable from every path** — conversions/analytics never fire. Publish
   validator should require a reachable `action_end` from every path, not just check for a
   trigger node.
5. **Delay-resume must have a guaranteed periodic caller** — an engine with `wait:{type:delay}`
   semantics is useless without cron/worker/BullMQ actually invoking the resume function. Have
   more than one path calling it (worker interval + external cron) since serverless kills
   long-lived processes.
6. **Reply-waits need a timeout** — otherwise a flow waits forever for a reply that never
   comes; expire waiting executions past `wait.until` before processing valid ones.
7. **Ship an execution-log/debug endpoint (`GET .../executions`) from day one** — stuck flows
   are nearly undebuggable without visibility into `FlowExecution.logs[]`.
8. **Button/list reply parsing must be reliable** — the resume logic depends entirely on
   correctly extracting `buttonId`/`listId`/`text` from Meta's interactive-reply webhook shape.

### Key files (Agent 2)
`models/automation/WhatsAppTemplate.js`, `lib/whatsapp/templates.js`,
`lib/whatsapp/templateStatusWebhook.js`, `lib/whatsappFlows/engine.js`,
`lib/whatsappFlows/constants.js`, `models` for `WhatsAppFlow`/`FlowNode`/`FlowExecution`/
`FlowVersion`, `lib/broadcasts/engine.js`, `lib/sequences/engine.js`, `lib/queue.js`,
`workers/automation-worker.js`, `app/api/cron/whatsapp-flows/route.js`,
`garage-flow-fixed.json` (real example flow export — good reference for exact node/edge shape).

---

## Agent 3 findings: AI auto-reply engine + core chat data model + message dispatcher

### The Python `backend-ai/` service is a disconnected prototype — do not port as the real system
FastAPI app (`main.py`, actually binds port 5055, README says 8000 — stale docs), most
endpoints (`/ai/revenue-leak-audit`, `/ai/growth-strategy`, etc.) are **hardcoded/templated
fake-AI f-strings**, unrelated to WhatsApp. Only `/ai/rag-chat` is real RAG (LangChain
`RecursiveCharacterTextSplitter` → `HuggingFaceEmbeddings(all-MiniLM-L6-v2)` → FAISS →
`ChatGroq(llama-3.1-8b-instant)`), but it's called from exactly one throwaway test page
(`app/rag-test/page.jsx`, raw browser fetch to `localhost:5055`) — **never wired into the
actual WhatsApp webhook, leadManager, or any production auto-reply path.** No real vector
search is used anywhere in production.

### The real, production AI auto-reply system is plain JS inside the Next.js app (`lib/ai/**`)
- **Provider abstraction** (`lib/ai/providers/index.js`): picks Groq > OpenAI > remote > local
  based on which env key is present. `providers/groq.js` calls
  `https://api.groq.com/openai/v1/chat/completions` directly (model default
  `openai/gpt-oss-20b`), supports blocking and SSE streaming.
- **Knowledge base models**: `KnowledgeSource` (`businessId, name, type(website/pdf/docx/txt/
  faq/catalog/company/custom), url, fileUrl, content, faqs[{question,answer}],
  catalog[{name,description,price,sku}], customInstructions, status(pending/indexing/ready/
  error), chunkCount, lastIndexedAt`), `KnowledgeChunk` (`businessId, sourceId, content,
  chunkIndex, tokenEstimate, embedding:[Number] — schema field exists but is DEAD, never
  populated`, MongoDB text index on `content`).
- **Ingestion** (`lib/ai/rag/ingest.js`): website → Puppeteer crawl (title/meta/innerText up to
  50k chars); faq → Q:/A: pairs; catalog → product list; file → fetch+extract (crude regex
  PDF text extraction, no real parser); hand-rolled `chunkText(text,{chunkSize:800,
  overlap:100})` breaking on nearest newline/period; bulk-insert chunks, no embeddings computed.
- **Retrieval is NOT vector search** despite the schema field — `lib/ai/rag/retriever.js` does
  MongoDB `$text` search first, falls back to regex keyword `$or` scan, results cached
  in-memory. **This is a corner worth actually improving in a fresh build** (real embeddings +
  vector search, e.g. reusing the FAISS/LangChain pattern that already exists as a prototype
  in `backend-ai/`, or a proper vector DB) rather than copying the keyword-search shortcut.
- **AI settings** live on `Business.settings.ai` (no separate collection):
  `enabled, tone, personality, languages, customInstructions, confidenceThreshold,
  handoffEnabled, handoffKeywords, workingHoursOnly, model, agentEnabled,
  replyAssistEnabled, whatsappAutoReply` (this last one defaults OFF — explicit opt-in,
  separate from the general "AI enabled" toggle).
- **System prompt** (`lib/ai/prompts.js`): names the assistant, injects tone/personality/
  languages/instructions, hard rule *"answer ONLY using the provided knowledge base context...
  never invent prices/policies/details"*, appends knowledge context + customer-memory block.
- **The auto-reply agent** (`lib/ai/agent.js::runSalesAgent`) — what fires on an inbound
  WhatsApp message:
  1. **Keyword handoff gate** checked *before* calling the LLM at all — if the message contains
     a handoff keyword (default list includes human/agent/refund/cancel/complaint/legal/sue/
     angry/scam/fraud etc.), immediately returns a canned handoff reply, `confidence:1`.
  2. Else: retrieves knowledge chunks, loads lead "memory" (`AiMemory` model — CRM facts
     extracted heuristically by regex from conversation, e.g. budget mentions/urgency), last
     10 turns of history, calls the LLM at `temperature:0.4`.
  3. **Confidence is a heuristic based purely on retrieved-chunk count**, not an LLM-reported
     score: `chunks>=2 → 0.9, chunks===1 → 0.7, else → 0.4`; `handoff = confidence <
     confidenceThreshold` (default 0.6). **Worth improving in a fresh build** — e.g. have the
     model self-report a confidence/next-action, rather than inferring it from retrieval count.
  4. On provider error, falls back to a templated reply using the first chunk snippet, or a
     generic handoff message if there's no knowledge at all.
- Sibling `lib/ai/reply.js::generateReply()` — same machinery, used for **manual "AI Reply
  Assist"** in the human inbox (suggest, don't auto-send), with selectable style
  (smart/short/detailed/professional/friendly/sales).

### Core Conversation/Message/Contact data model
- `models/omnichannel/Conversation.js` — one per channel+participant, unique compound index
  `{businessId, channel, participantId}`: `status(open/closed/spam/archived),
  inboxStatus(unread/read/intervened), unreadCount, lastMessageAt/Preview/Direction/Origin,
  labels[], isPinned/Favorite/Archived/Spam, assignmentHistory[]`.
  **`inboxStatus:'intervened'` is the flag that suppresses AI auto-reply once a human takes
  over — and the upsert logic explicitly refuses to downgrade an intervened conversation back
  to unread on a new inbound message**, so AI doesn't resume after human takeover. This is an
  important, deliberate, reusable pattern.
- `models/automation/Message.js` — every channel's messages in one collection:
  `businessId, leadId, conversationId, channel, direction(incoming/outgoing),
  type(text/image/video/audio/document/sticker/location/contacts/button/interactive/...),
  content{body,html,caption,fileName,mimeType,mediaId,mediaUrl,attachments[]}, timestamp,
  status(sent/delivered/read/failed/received/draft/scheduled),
  origin(user/automation/sequence/broadcast/meeting/system) — provenance for inbox filter
  chips, isInternal (internal notes are just Message docs with this flag, excluded from
  unread-count and customer-facing triggers)`.
- `models/automation/Contact.js` — separate from `Lead`: standard contact fields
  (names/phones[]/emails[]/company/tags/customFields).
- **Documented tech debt (their own `audit-db.md`): two parallel conversation models** — legacy
  `WhatsAppConversation` (per-lead WA summary) is kept in sync alongside the new
  `omnichannel/Conversation` on every write, purely for backward compat. **Pick ONE model in
  the fresh build.**

### Realtime sync — Server-Sent Events, not WebSockets/polling
- `lib/realtime/hub.js`: process-wide `EventEmitter` (in-process fallback) + optional Redis
  pub/sub for multi-instance (auto-disables permanently on auth failure).
- `lib/realtime/publish.js`: typed emit helpers (`emitChatMessage, emitChatRead,
  emitChatMessageStatus, emitChatTyping, emitNotification, ...`).
- `app/api/realtime/stream/route.js`: `GET` returning a `ReadableStream`
  (`Content-Type: text/event-stream`), JWT-authenticated, 25s heartbeat.
- Client: plain browser `EventSource` wrapped in a hook (`useRealtime`), auto-reconnect 3s.
  **This SSE pattern is simpler than WebSockets and worth reusing directly** for a fresh build
  — no socket.io dependency, works over plain HTTP, reconnects trivially.

### The dispatcher — single orchestration point deciding an incoming message's fate
`lib/automation/leadManager.js::processIncomingMessage(businessId, parsedData)`, called from
the webhook handler after signature verification. **Exact precedence order** (critical to
replicate faithfully — this is the core business logic of the whole product):
1. Noise/OTP filter (regex) → skip immediately if matched.
2. Opt-out ("STOP"/"unsubscribe"/etc.) detection → mark opted out, stop entirely (Meta policy
   compliance — no free-text allowed outside 24h window after opt-out).
3. Idempotency check by `messageId` against a webhook log (skip duplicates).
4. Lead/Contact resolution (upsert), fires new-lead automation triggers.
5. **Persist message + conversation FIRST, unconditionally** (`recordChannelMessage`) — a human
   always sees the message in the inbox regardless of what automation does afterward. Emits
   the realtime SSE event here.
6. Resume any paused sequences waiting on a reply.
7. Notify the assigned owner (in-app + optional WhatsApp ping).
8. Generic workflow/automation event dispatch.
9. **WhatsApp Flow engine**: try resuming a waiting flow execution first; if nothing resumed,
   try matching/starting a new flow. `flowHandled = (resumed.length>0 || started.length>0)`.
10. **AI auto-reply gate — runs ONLY if ALL of**: business exists, `!flowHandled`,
    conversation not `intervened`, within configured working hours (if that setting is on),
    message body non-empty, `aiSettings.enabled !== false`, `aiSettings.whatsappAutoReply ===
    true`. Then loads last 10 messages as history, calls `runSalesAgent()`, and — **critical
    safety rail** — only actually sends the WhatsApp reply if `ai.reply && !ai.handoff`; if
    handoff is flagged, nothing is sent and the message just sits in the inbox for a human.

**So the precedence is: noise/OTP → opt-out → (sequence branching always runs) → flow
resume/match (flows take full priority over AI) → human-intervention check → business-hours
check → AI settings gate → AI's own confidence/handoff decision. A message always lands in the
human inbox first (step 5); AI/flow/automation are additive side effects on top of that same
write, never an alternative path that skips the inbox.** This precedence order is the single
most important piece of business logic to replicate correctly in the fresh build.

### Key files (Agent 3)
`lib/automation/leadManager.js` (`processIncomingMessage` — THE dispatcher),
`app/api/webhooks/meta/[businessId]/route.js`, `lib/omnichannel/conversationService.js`,
`models/omnichannel/Conversation.js`, `models/automation/Message.js`,
`models/automation/Contact.js`, `lib/realtime/hub.js`, `lib/realtime/publish.js`,
`app/api/realtime/stream/route.js`, `app/automation/hooks/useRealtime.js`,
`lib/ai/agent.js`, `lib/ai/reply.js`, `lib/ai/rag/{retriever,ingest,chunker}.js`,
`lib/ai/prompts.js`, `lib/ai/memory.js`, `lib/ai/settings.js`,
`lib/ai/providers/{index,groq,openai}.js`, `models/ai/{KnowledgeSource,KnowledgeChunk,
AiMemory}.js`, `lib/whatsappFlows/engine.js` (shared with Agent 2's findings).

---
---

# System Design: WhatsApp Business Automation Platform

**Target repo:** `C:\Users\saura\OneDrive\Desktop\whatsapp-automation\backend` (currently empty)
**Reference product studied:** LeadForGrow (`C:\Users\saura\OneDrive\Desktop\leadforgrow`) — every "LFG" reference below points to the research sections above this one in the same file.
**Language:** Python. **This is the actual deliverable the user asked for — a full system design document, not code.**

## 0. Scale assumption (stated explicitly, since it drives every partitioning/index decision below)

"A million users" is treated as: **thousands to low tens-of-thousands of tenant businesses**, a long tail of small tenants plus a handful of very large ones, and a **cumulative message volume in the hundreds of millions to billions of rows over the platform's life**, with sustained inbound+outbound throughput in the range of thousands of messages/second at peak (broadcast fan-out spikes) and tens of thousands of concurrent SSE inbox connections. Every partitioning, indexing, and queueing decision below is sized for that profile, not for a single giant tenant. If the actual target is "a million *tenant businesses*," that changes the isolation model (§10) toward mandatory per-tenant sharding sooner than proposed here — flag it if so.

## 1. Goals & Non-Goals

**Goals**
- WhatsApp-only, multi-tenant SaaS backend: template messages + Meta approval lifecycle, a visual no-code flow/automation graph builder with a reliable execution engine, broadcast campaigns, follow-up sequences (unified into the same graph engine — see §7), AI auto-reply with real vector retrieval, a realtime team inbox, and lead capture/attribution from Meta Lead Ads and click-to-WhatsApp ads.
- Horizontally scalable, stateless API tier; heavy work always on a queue, never inline in a request/webhook handler.
- Faithful reproduction of LFG's inbound-message precedence order (§5) — that ordering *is* the product's business logic, not an implementation detail.
- One primary datastore (Postgres) — no dual document-model tech debt, no fake vector search.

**Non-goals (explicit scope boundaries)**
- No email/SMS/Instagram channel. The data model (channel-typed `Conversation`/`Message`) leaves an obvious extension seam, but nothing here is built for it now.
- No embedded-signup / OAuth flow for connecting a WABA in v1 — mirrors LFG's manual "paste your credentials" flow (access token, phone_number_id, WABA ID, verify token), since Meta's Embedded Signup requires Tech Provider approval that's an orthogonal business step, not an architecture concern. The credential *storage/rotation* design (§4, §10) is built so Embedded Signup can be bolted on later without a schema change.
- No microservice split at v1 (justified in §3) — a modular monolith with independently scalable worker pools.
- No omnichannel unification, no CRM/deal-pipeline features beyond what's needed for lead attribution.

## 2. High-Level Architecture

```
                              ┌──────────────────────────────┐
                              │        Meta Graph API         │
                              │  WhatsApp Cloud API v21+,     │
                              │  Lead Ads, Template mgmt      │
                              └───────────┬───────────────────┘
                     outbound sends /     │   ▲  inbound webhooks
                     template mgmt/media  │   │  (messages, statuses,
                                           │   │   leadgen, template-status)
                     ┌─────────────────────┘   └───────────────────────┐
                     ▼                                                 │
       ┌───────────────────────────┐                                  │
       │   Webhook Ingress Tier     │◄─────────────────────────────────┘
       │  FastAPI, stateless,      │   1. read raw body
       │  scaled/deployed          │   2. verify X-Hub-Signature-256 (mandatory,
       │  independently from the   │      no fail-open, single implementation)
       │  dashboard API            │   3. write WebhookIngress audit row (always)
       │  (own k8s Deployment/HPA) │   4. enqueue Celery task by shape
       └────────────┬───────────────┘   5. return HTTP 200 in <50ms
                     │ enqueue
                     ▼
       ┌────────────────────────────┐        ┌────────────────────────────┐
       │           Redis            │◄──────►│   Celery Worker Pools       │
       │ - Celery broker + backend  │        │ queues: inbound, flows,     │
       │ - response/session cache   │        │ broadcast, ai, default,     │
       │ - Pub/Sub (SSE fan-out)    │        │ scheduled (eta-based)       │
       │ - rate-limit token buckets │        │ + Celery Beat (sweeper,     │
       │ - circuit-breaker state    │        │   template sync, TTL purge) │
       └────────────┬────────────────┘        └────────────┬────────────────┘
                     │ pub/sub fanout                       │ reads/writes
                     ▼                                      ▼
       ┌────────────────────────────┐        ┌──────────────────────────────────┐
       │    API / Dashboard Tier     │◄──────►│      PostgreSQL 16 (primary)      │
       │ FastAPI, stateless,         │  async  │ tenants, users, contacts,         │
       │ horizontally scaled         │  SQLA   │ conversations, messages           │
       │ - REST/JSON CRUD            │  + pool │   (time-partitioned),             │
       │ - SSE realtime inbox        │  via    │ templates, automation_flows,      │
       │   (subscribes to Redis      │ PgBouncer│ automation_executions,           │
       │    channel per open tenant) │        │ broadcasts, broadcast_recipients, │
       └────────────┬─────────────────┘        │ knowledge_sources/chunks          │
                     │                          │   (pgvector HNSW),                │
                     ▼                          │ integrations, webhook_ingress     │
       ┌────────────────────────────┐          │  + 1-2 read replicas for reporting │
       │  Next.js Frontend (exists) │          └──────────────────────────────────┘
       └────────────────────────────┘
```

**Inbound data flow:** Meta → Webhook Ingress (verify + audit + enqueue + 200) → Celery `process_inbound_event` → precedence pipeline (§5) → Postgres write (always) → Redis publish → SSE push to any connected dashboard tabs for that tenant.

**Outbound data flow:** Dashboard action / flow node / broadcast batch → Celery task → rate-limit + circuit-breaker check (Redis) → `httpx` call to Graph API with `tenacity` retry/backoff → write `Message` row + Meta `wamid` → status webhook later updates it.

## 3. Tech Stack (with justification)

| Concern | Choice | Why |
|---|---|---|
| Web framework | **FastAPI** | Async-native, Pydantic-integrated validation, OpenAPI for free (frontend contract), the de facto Python choice for this shape of system. |
| Validation/schemas | **Pydantic v2** | Rust-core validation is fast enough to sit in the webhook hot path; used for both API I/O and flow-graph node/edge validation (§6). |
| ORM / DB access (API tier) | **SQLAlchemy 2.0 (async) + asyncpg** | Async matches FastAPI's event loop; 2.0's typed `Mapped[...]` style keeps models close to plain dataclasses. |
| DB access (worker tier) | **SQLAlchemy 2.0 (sync) + psycopg** | Deliberate departure from the API tier — Celery's execution model is fundamentally synchronous; fighting that with `asyncio.run()` per task adds complexity for no benefit. Two engines, one shared model layer (models are engine-agnostic; only the `Session`/`AsyncSession` factory differs by process). |
| Migrations | **Alembic** | Standard pairing with SQLAlchemy. |
| Background jobs / queue | **Celery 5.x + Redis broker** | Chosen over Arq/RQ/Dramatiq for the *ecosystem*, not raw throughput: mature `apply_async(eta=...)` for exact-time delayed jobs (the direct Python analog to BullMQ's delayed jobs LFG's sequences engine used correctly), per-task `rate_limit`, `autoretry_for` with exponential backoff, task routing to named queues, Celery Beat for periodic sweepers, and Flower/Prometheus exporters for the observability bar this project has to hit. Trade-off accepted: Celery tasks are sync, so workers use the sync DB engine and a sync `httpx.Client` — a well-worn, boring pattern, which is exactly what you want in the tier that must never silently drop a customer's message. |
| Primary datastore | **PostgreSQL 16** | See dedicated justification below. |
| Vector search | **pgvector (HNSW index)** | Confirmed over a dedicated vector DB (Qdrant/Pinecone) for v1: per-tenant knowledge bases are small (thousands–low tens of thousands of chunks each per the LFG ingestion sources — website/PDF/FAQ/catalog), so a second specialized store buys nothing at this scale and adds an operational dependency + a second place secrets/tenant-isolation bugs can hide. Revisit only if a single tenant's KB grows past ~500K chunks or cross-tenant query latency becomes measurable (§8 flags the exact caveat). |
| Cache / pub-sub / rate-limit state / broker | **Redis 7** | One piece of infrastructure serving four roles keeps the ops surface small; matches the user's own recommendation. |
| Connection pooling at scale | **PgBouncer** (transaction pooling mode) in front of Postgres | Each API/worker pod holds its own SQLAlchemy pool; without PgBouncer, pod-count × pool-size blows past `max_connections` well before "a million users" scale. |
| HTTP client to Graph API | **httpx** (async in API tier, sync in workers) + **tenacity** for retry/backoff | `httpx` supports both models cleanly; `tenacity` gives declarative retry policies (respecting `Retry-After` on 429s — LFG's `requestWithBackoff` pattern) without hand-rolled loops. |
| Circuit breaker | Custom Redis-backed breaker (closed/open/half-open per WABA `phone_number_id`) | A library like `pybreaker` is in-process only; with N stateless pods, breaker state must live in Redis so all pods agree a given number is degraded. |
| Auth | **JWT (PyJWT) access+refresh**, **argon2** password hashing (`argon2-cffi`) | Standard, no framework lock-in; SSE auth reuses the same JWT via query param since `EventSource` can't set headers. |
| Secrets encryption | **`cryptography` (Fernet/AES-GCM)** envelope-encrypted with a KMS-held master key | See §10. |
| Structured logging | **structlog** | JSON logs with `tenant_id`/`request_id`/`trace_id` bound automatically to every log line via context vars. |
| Tracing | **OpenTelemetry** (FastAPI, SQLAlchemy, httpx, Celery instrumentors) → Tempo/Jaeger | A message's trace should span webhook ingress → Celery task → Graph API call. |
| Metrics | **prometheus-fastapi-instrumentator** + Celery Prometheus exporter → Grafana | Queue depth, task latency/failure rate, Meta API error rate per WABA, breaker state, all first-class dashboards. |
| Error tracking | **Sentry SDK** | Both API and worker processes. |
| Dependency mgmt | **uv** (or Poetry) + `pyproject.toml` | Fast, modern, single lockfile. |

**Why Postgres as the single primary store:** LFG's own documented tech debt — two parallel conversation models kept in sync by hand, a vector-embedding schema field that was never populated because retrieval never got past keyword `$text` search — are both symptoms of a document store's schema flexibility being used as a substitute for actually modeling the domain. Conversation/Message/Contact/Flow are genuinely relational (foreign keys, uniqueness constraints, joins for the inbox list view); JSONB columns absorb the *legitimately* variable-shape parts (flow graphs, custom fields, AI settings) without needing a second database. pgvector removes the last reason (embeddings) anyone would reach for a second store in v1.

**Deployment topology:** one codebase, modular monolith (`app/messaging`, `app/templates`, `app/flows`, `app/broadcasts`, `app/ai`, `app/integrations`, `app/auth`), but **three independently scaled process groups**: (1) dashboard API, (2) webhook ingress (separate so a Meta traffic burst can't starve dashboard latency), (3) Celery workers split into per-queue pools (`inbound`, `broadcast`, `ai`, `flows`, `default`) so a broadcast flood can't starve inbound-message processing. Microservices are explicitly rejected for v1: the bottlenecks at this scale are the data layer and the queue, not process boundaries, and a monolith with clean module seams can have any one module (most plausibly `app/ai`) peeled into its own service later without a rewrite.

## 4. Data Model

Conventions applied to every table: `id UUID PK default gen_random_uuid()`, `tenant_id UUID NOT NULL` (except `tenants` itself), `created_at`/`updated_at TIMESTAMPTZ NOT NULL default now()`. Every tenant-scoped table's indexes lead with `tenant_id` even when a more selective column exists, since nearly every query is "this tenant's X."

### 4.1 `tenants` (Business)
```
id UUID PK
name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL
plan TEXT NOT NULL DEFAULT 'trial'          -- trial/starter/pro/enterprise
status TEXT NOT NULL DEFAULT 'active'       -- active/suspended/deleted
settings JSONB NOT NULL DEFAULT '{}'        -- business_hours{}, ai{tone,personality,languages,
                                             --   confidenceThreshold,handoffKeywords,
                                             --   workingHoursOnly,whatsappAutoReply,...}
created_at, updated_at
```
No separate "AI settings" table — kept as JSONB on tenant (mirrors LFG's `Business.settings.ai`), read as a whole blob on every inbound message and rarely queried by field.

### 4.2 `users` + `tenant_memberships`
```
users: id UUID PK, email TEXT UNIQUE NOT NULL, password_hash TEXT, name TEXT,
       is_platform_admin BOOL DEFAULT false, created_at, updated_at
tenant_memberships: id UUID PK, tenant_id FK, user_id FK, role TEXT NOT NULL  -- owner/admin/agent/viewer
  UNIQUE (tenant_id, user_id)
```
Users are global (one login can belong to multiple tenants — matches agencies running several client WABAs); role is per-membership.

### 4.3 `whatsapp_accounts` (the connected WABA/number — first-class, since almost every table below FKs to it)
```
id UUID PK, tenant_id FK NOT NULL
phone_number_id TEXT NOT NULL          -- Meta's ID, webhook resolution key
waba_id TEXT NOT NULL                  -- WhatsApp Business Account ID
display_phone_number TEXT, verified_name TEXT
access_token_encrypted BYTEA NOT NULL  -- Fernet-encrypted (§10)
app_secret_encrypted BYTEA NOT NULL    -- per-account app secret for signature verify
verify_token_encrypted BYTEA NOT NULL
webhook_path_secret TEXT UNIQUE NOT NULL  -- part of the per-tenant webhook URL, see §5
quality_rating TEXT                    -- GREEN/YELLOW/RED, polled hourly, cached in Redis too
messaging_tier TEXT                    -- Meta's tier_1k/10k/100k/unlimited
status TEXT NOT NULL DEFAULT 'active'  -- active/needs_reauth/disabled
last_verified_at TIMESTAMPTZ
UNIQUE (phone_number_id)               -- webhook→tenant resolution index
```
**One webhook pattern, resolved by design:** per-tenant path `POST /webhooks/whatsapp/{webhook_path_secret}` (LFG had two overlapping routes; only the per-business-path variant is kept — simpler tenant resolution). `webhook_path_secret` is a random token, not the tenant's real ID, so the URL itself isn't a tenant-enumeration vector; `X-Hub-Signature-256` is still mandatory regardless.

### 4.4 `contacts` (unifies LFG's `Lead` + `Contact` split — deliberate simplification)
LFG kept `Lead` (automation/attribution) and `Contact` (CRM fields) as two collections with overlapping identity. One row per (tenant, WhatsApp identity) carries both here.
```
id UUID PK, tenant_id FK NOT NULL
whatsapp_id TEXT NOT NULL              -- Meta's wa_id (phone, no leading +)
name TEXT, email TEXT, tags TEXT[] DEFAULT '{}', custom_fields JSONB NOT NULL DEFAULT '{}'
source TEXT NOT NULL DEFAULT 'whatsapp'  -- whatsapp/webhook/ad/meta_ads/instagram_ad/referral/manual/bot
ad_attribution JSONB DEFAULT '{}'      -- {ad_id, campaign_name, ad_set_name, ad_name,
                                        --  headline, source_type, referral_data, form_id}
meta_lead_id TEXT                      -- from leadgen webhook, for dedup
opted_out BOOL NOT NULL DEFAULT false, opted_out_at TIMESTAMPTZ, opted_out_reason TEXT
ai_memory JSONB NOT NULL DEFAULT '{}'  -- structured CRM facts extracted by the AI layer (§8),
                                        -- replaces LFG's regex-heuristic AiMemory model
assigned_to_user_id FK NULL
UNIQUE (tenant_id, whatsapp_id)
CREATE UNIQUE INDEX ... ON contacts (tenant_id, meta_lead_id) WHERE meta_lead_id IS NOT NULL
  -- partial unique index, reusing LFG's dedup pattern (better than app-level check-then-insert,
  -- which races under concurrent webhook delivery)
INDEX (tenant_id, opted_out) WHERE opted_out = false   -- audience-builder hot path
```
**Lead-attribution normalization:** leadgen-form leads and click-to-WhatsApp-ad leads arrive via two different webhook shapes but must write the *same* `ad_attribution` fields. Both paths call one shared `apply_lead_attribution(contact, attribution: LeadAttribution)` function — a single write path, avoiding per-source field-setting duplication.

### 4.5 `conversations`
One model only (LFG's dual-model tech debt explicitly not repeated).
```
id UUID PK, tenant_id FK NOT NULL, whatsapp_account_id FK NOT NULL, contact_id FK NOT NULL
status TEXT NOT NULL DEFAULT 'open'         -- open/closed/spam/archived
inbox_status TEXT NOT NULL DEFAULT 'unread' -- unread/read/intervened
unread_count INT NOT NULL DEFAULT 0
last_message_at TIMESTAMPTZ, last_message_preview TEXT
last_message_direction TEXT, last_message_origin TEXT  -- user/automation/flow/broadcast/ai/system
labels TEXT[] DEFAULT '{}', is_pinned BOOL DEFAULT false, assigned_to_user_id FK NULL
UNIQUE (tenant_id, whatsapp_account_id, contact_id)
INDEX (tenant_id, inbox_status, last_message_at DESC)   -- inbox list query
```
`inbox_status = 'intervened'` is the human-takeover flag that suppresses AI (§5, §8) — kept verbatim from LFG because it's genuinely good design, with the same **explicit guard: an inbound message must never downgrade `intervened` back to `unread`.** Implemented as a conditional `UPDATE ... SET inbox_status = 'unread' WHERE inbox_status <> 'intervened'` so it's enforced at the SQL layer, not just application logic a future change could bypass.

### 4.6 `messages` — **time-partitioned**
```
id UUID, tenant_id FK NOT NULL, conversation_id FK NOT NULL, contact_id FK NOT NULL
whatsapp_account_id FK NOT NULL
wamid TEXT                                  -- Meta's message id, NULL for pre-send draft rows
direction TEXT NOT NULL                     -- incoming/outgoing
type TEXT NOT NULL                          -- text/image/video/audio/document/sticker/
                                             -- location/contacts/button/interactive/template
content JSONB NOT NULL                      -- {body, caption, file_name, mime_type, media_id,
                                             --  media_url, attachments[]}
status TEXT NOT NULL DEFAULT 'received'     -- sent/delivered/read/failed/received/draft/scheduled
error_code TEXT, error_detail JSONB
origin TEXT NOT NULL DEFAULT 'user'         -- user/automation/flow/sequence/broadcast/ai/system
is_internal BOOL NOT NULL DEFAULT false     -- internal notes: excluded from unread count/triggers
occurred_at TIMESTAMPTZ NOT NULL            -- partition key
PRIMARY KEY (id, occurred_at)
```
```sql
CREATE TABLE messages (...) PARTITION BY RANGE (occurred_at);
-- monthly partitions, created ahead of time by a Celery Beat job; old partitions (>N months,
-- per retention policy) detached/archived to cold storage rather than DELETEd row-by-row.
CREATE UNIQUE INDEX ON messages (whatsapp_account_id, wamid) WHERE wamid IS NOT NULL;
  -- idempotency guard used by the dispatcher (§5) AND the status webhook (find-message-to-update)
CREATE INDEX ON messages (tenant_id, conversation_id, occurred_at DESC);  -- thread view
CREATE INDEX ON messages (tenant_id, occurred_at DESC);                   -- tenant-wide feed
```
**Partitioning call:** RANGE by `occurred_at` (monthly), not hash-by-tenant — the dominant access pattern is "recent messages for this conversation/tenant" and "purge/archive old data," both served directly by time-partitioning; most tenants are too small for tenant-hash partitioning to pay for its own join/planning overhead. If one tenant's volume becomes disproportionate, add tenant-level **sub-partitioning** (LIST by `tenant_id` within a month partition) for that tenant only — a documented lever, not built until a real tenant needs it.

### 4.7 `whatsapp_templates`
```
id UUID PK, tenant_id FK, whatsapp_account_id FK
name TEXT NOT NULL, language TEXT NOT NULL
category TEXT NOT NULL                      -- MARKETING/UTILITY/AUTHENTICATION
status TEXT NOT NULL DEFAULT 'draft'        -- draft/pending/approved/rejected/disabled/paused
components JSONB NOT NULL                   -- HEADER/BODY/FOOTER/BUTTONS incl. example values
meta_template_id TEXT, meta_status TEXT, meta_rejection_reason TEXT, meta_category_changed_to TEXT
meta_submitted_at TIMESTAMPTZ
source TEXT NOT NULL DEFAULT 'native'       -- native/imported
is_deleted BOOL NOT NULL DEFAULT false
UNIQUE (tenant_id, name, language) WHERE is_deleted = false
```
Lifecycle and error-decoding kept verbatim from LFG (proven good): `to_meta_payload()` builder, `validate_template()` (placeholder-count vs. examples, char limits), push sync via the `message_template_status_update` webhook branch + pull sync via a Celery Beat fallback every 30 min, and a hand-maintained `META_ERROR_CATALOG: dict[str, DecodedError]` translating codes (131047 window closed, 131048 rate limit, 131049 quality drop, 132012 param mismatch, 190 token expired, 10 permission denied) into support-friendly messages.

### 4.8 `automation_flows`, `automation_flow_versions`, `automation_executions`, `automation_execution_events`
Unified engine — see §7 for the "why unify sequences and flows" call. One graph model, one execution model, `trigger_type` distinguishes what used to be two products.
```
automation_flows:
  id UUID PK, tenant_id FK, name TEXT NOT NULL
  trigger_type TEXT NOT NULL       -- incoming_message/keyword/contact_created/lead_created/
                                    -- tag_added/manual/webhook/schedule
  trigger_config JSONB NOT NULL DEFAULT '{}'
  status TEXT NOT NULL DEFAULT 'draft'   -- draft/published/archived
  graph JSONB NOT NULL             -- {nodes:[...], edges:[...]} — DRAFT, freely editable
  published_snapshot JSONB         -- {nodes, edges, trigger_type, trigger_config}, immutable
                                    -- once written; execution engine reads ONLY this column
  version INT NOT NULL DEFAULT 0, webhook_secret TEXT UNIQUE
  analytics JSONB NOT NULL DEFAULT '{}'   -- {total,completed,failed,active,dropped,conversions}

automation_flow_versions:            -- rollback history, one row per publish
  id UUID PK, flow_id FK, version INT, snapshot JSONB NOT NULL, published_by FK, published_at
  UNIQUE (flow_id, version)

automation_executions:
  id UUID PK, tenant_id FK, flow_id FK, flow_version INT NOT NULL, contact_id FK
  status TEXT NOT NULL DEFAULT 'active'  -- active/waiting/completed/failed/cancelled/test
  current_node_key TEXT
  wait JSONB                              -- {type: reply|delay|event, until, save_as,
                                           --  expected_buttons, event_type}
  variables JSONB NOT NULL DEFAULT '{}'
  context JSONB NOT NULL DEFAULT '{}'     -- loop_counts, parallel branch state
  celery_task_id TEXT                     -- id of the scheduled eta-task for this wait, so the
                                           -- sweeper (§7) can tell "already scheduled" from "lost"
  UNIQUE (flow_id, contact_id) WHERE status IN ('active','waiting')
    -- LFG's "don't start a new execution if one is already active/waiting" dedup, DB-enforced

automation_execution_events:            -- append-only trace, separate table (not a growing JSONB
                                          -- array) so it doesn't bloat the hot execution row
  id UUID PK, execution_id FK, tenant_id FK, node_key TEXT, event_type TEXT,
  detail JSONB, occurred_at TIMESTAMPTZ
  INDEX (execution_id, occurred_at)       -- debug endpoint (§6 pitfall #7) reads this directly
```
**Design call — JSONB graph, not normalized `FlowNode`/`FlowEdge` rows:** the builder UI always reads/writes the *whole* graph at once, so normalizing nodes/edges into rows buys nothing and adds join overhead and migration churn every time a node-type schema changes. All structural validation (§6) happens at the Pydantic-schema boundary before the JSONB is ever written — also where the "duplicate edges" and "empty condition value" LFG bugs get caught (a place they were *not* caught for LFG).

### 4.9 `broadcasts`, `broadcast_recipients`
```
broadcasts:
  id UUID PK, tenant_id FK, whatsapp_account_id FK
  name TEXT, status TEXT NOT NULL DEFAULT 'draft'  -- draft/scheduled/sending/paused/completed/failed
  audience JSONB NOT NULL       -- {type: manual|tags|filter, ...}
  content JSONB NOT NULL        -- {template_id, template_name, variable_mapping[]}
  scheduled_at TIMESTAMPTZ
  analytics JSONB NOT NULL DEFAULT '{}'  -- {total,sent,delivered,failed,quality_drops}
  circuit_breaker_state TEXT DEFAULT 'closed'  -- closed/open

broadcast_recipients:
  id UUID PK, broadcast_id FK, tenant_id FK, contact_id FK
  status TEXT NOT NULL DEFAULT 'pending'  -- pending/sending/sent/delivered/read/failed/skipped
  wamid TEXT, error_code TEXT, sent_at TIMESTAMPTZ
  INDEX (broadcast_id, status)            -- worker's "give me next pending batch" query
```
Recipients are bulk-inserted (`COPY`/multi-row insert) at broadcast-start time from the audience query, never generated on the fly during sending — see §7 for the queue-driven sender design replacing LFG's synchronous loop.

### 4.10 `knowledge_sources`, `knowledge_chunks`
```
knowledge_sources:
  id UUID PK, tenant_id FK
  name TEXT, type TEXT NOT NULL   -- website/pdf/docx/txt/faq/catalog/company/custom
  url TEXT, file_url TEXT, content TEXT, faqs JSONB, catalog JSONB, custom_instructions TEXT
  status TEXT NOT NULL DEFAULT 'pending'  -- pending/indexing/ready/error
  chunk_count INT DEFAULT 0, last_indexed_at TIMESTAMPTZ

knowledge_chunks:
  id UUID PK, tenant_id FK, source_id FK
  content TEXT NOT NULL, chunk_index INT NOT NULL, token_count INT NOT NULL
  embedding VECTOR(1536) NOT NULL     -- dimension fixed to the chosen embedding model (§8);
                                       -- REAL, populated at ingestion — the field LFG declared
                                       -- but never wrote to.
CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_chunks (tenant_id, source_id);
```

### 4.11 `integrations`, `integration_logs`
Generic, provider-agnostic — mirrors LFG's *newer* `Integration` model (proven better than its legacy embedded-credentials pattern), used for Meta Ads/Lead Ads and future integrations; `whatsapp_accounts` stays separate/first-class since it's the load-bearing entity almost everything else FKs to.
```
integrations:
  id UUID PK, tenant_id FK, provider TEXT NOT NULL  -- meta_ads, meta_leadgen, ...
  status TEXT NOT NULL DEFAULT 'active'             -- active/needs_reauth/disabled
  credentials_encrypted BYTEA NOT NULL
  account_info JSONB, webhook_config JSONB, last_health_check_at TIMESTAMPTZ

integration_logs:
  id UUID PK, tenant_id FK, integration_id FK
  action TEXT, status TEXT, message TEXT, metadata JSONB, duration_ms INT, occurred_at
  -- TTL 90 days via Beat job, same audit-everything philosophy as webhook_ingress
```
On any Graph API auth failure while processing a lead, `integrations.status` flips to `needs_reauth` (never silently retried forever) — reused directly from LFG's leadgen handler pattern.

### 4.12 `webhook_ingress`
```
id UUID PK, tenant_id FK NULL   -- NULL until resolved (resolution happens AFTER signature check)
headers JSONB, raw_body TEXT, payload JSONB
signature_received TEXT, signature_expected_matched BOOL NOT NULL, secret_source TEXT
processing_step TEXT, processing_result TEXT, processing_error TEXT
received_at TIMESTAMPTZ
-- monthly partitions, TTL 30 days via Beat purge job — every webhook call logged regardless
-- of outcome, reused directly from LFG's MetaWebhookIngress pattern.
```

### 4.13 `dead_letter_tasks`
```
id UUID PK, tenant_id FK, task_name TEXT, payload JSONB, attempts INT,
last_error TEXT, failed_at TIMESTAMPTZ, resolved BOOL DEFAULT false
```
Populated by Celery's `on_failure` handler once `max_retries` is exhausted, for anything business-critical (a message send, a flow step, a broadcast batch) — reused from LFG's `FailedJob` collection. Alertable via Prometheus (`dead_letter_tasks` insert-rate metric).

## 5. The Message Dispatch Pipeline

**What runs synchronously in the webhook handler (must be fast, must never fail open):**
1. Read raw request body (bytes, before any JSON parsing).
2. Verify `X-Hub-Signature-256` — HMAC-SHA256 over the raw body, `hmac.compare_digest`, against the tenant's `whatsapp_accounts.app_secret_encrypted` (decrypted) — **unconditionally, for every payload shape** (leadgen, statuses, template-status, messages). If the expected secret can't be resolved (missing config), this is a **hard failure, not a pass** — LFG's fail-open bug (`return true` when the env var was unset) is the #1 thing this design must never reproduce.
3. Write a `webhook_ingress` row with the verification result — always, before any further branching.
4. If signature invalid → return `403` and stop. (This is a security rejection, not an "internal failure" — Meta's "always ack 200" guidance is about *our* bugs, not about rejecting unauthenticated senders.)
5. Parse the payload's top-level shape into a typed Pydantic envelope (cheap, pure).
6. Enqueue exactly one Celery task keyed by shape (`process_leadgen_event`, `process_status_update`, `process_template_status`, `process_inbound_message`) onto the `inbound` queue.
7. Return `200` immediately. Any exception *after* step 4 is caught, logged to the same ingress row as an internal error, and still returns `200` — satisfying both halves of LFG's lesson: never fail open on security, never let an internal bug get the webhook disabled.

**What runs async in `process_inbound_message` (Celery, `inbound` queue), preserving LFG's exact precedence order from `leadManager.processIncomingMessage`:**

```python
def dispatch_inbound_message(event: InboundMessageEvent) -> None:
    # 0. Idempotency guard: unique constraint on (whatsapp_account_id, wamid) in `messages` —
    #    a second delivery of the same wamid is caught by the DB insert itself.
    if is_duplicate(event.wamid):
        return

    # 1. Noise / OTP filter — regex match on body; drop immediately, no persistence, no trace.
    if is_noise_or_otp(event.body):
        return

    # 2. Opt-out detection (STOP/unsubscribe/...) — mark contact.opted_out, persist a
    #    confirmation message, then stop. No further automation, per Meta policy.
    if is_opt_out(event.body):
        mark_opted_out(event.contact)
        return

    # 3. Contact resolution/upsert (fires "contact_created"/"lead_created" trigger_type flows).
    contact = upsert_contact(event)

    # 4. Persist message + conversation FIRST, unconditionally. A human sees every inbound
    #    message in the inbox regardless of what automation decides afterward. Publishes to
    #    Redis for SSE fan-out right here.
    message, conversation = record_inbound_message(event, contact)
    publish_realtime_event(conversation.tenant_id, "message.created", message)

    # 5. Resume any waiting automation execution for this contact (always attempted,
    #    independent of whether a flow later claims the message).
    resumed_wait = resume_waiting_execution(contact, event)

    # 6. Notify assigned owner (in-app + optional WhatsApp ping) — best-effort, never blocks.
    notify_assigned_owner(conversation, message)

    # 7. Generic workflow/event dispatch (tag-based / webhook-triggered automations).
    dispatch_generic_automation_event(contact, event)

    # 8. Flow engine: resume-first, then match-and-start. Flows take full priority over AI.
    flow_handled = resumed_wait or try_resume_or_start_flow(contact, event)

    # 9. AI auto-reply gate — runs ONLY if ALL of:
    if (
        not flow_handled
        and conversation.inbox_status != "intervened"
        and within_business_hours(conversation.tenant_id)
        and event.body.strip() != ""
        and tenant_ai_settings(conversation.tenant_id).enabled
        and tenant_ai_settings(conversation.tenant_id).whatsapp_auto_reply
    ):
        ai_result = run_ai_agent(conversation, contact, message)   # see §8
        if ai_result.reply and not ai_result.handoff:
            send_whatsapp_message.delay(conversation.id, ai_result.reply, origin="ai")
        # if handoff: nothing is sent — message sits in the inbox for a human. This is the
        # single most important safety rail in the whole system and is preserved exactly.
```

This function is deliberately written as a flat, ordered sequence of named steps (not a generic middleware chain) precisely because the *order itself* is the business logic LFG discovered the hard way — a generic "pipeline of independent handlers" abstraction would let future engineers reorder steps without realizing the ordering was load-bearing.

## 6. Flow / Automation Execution Engine

**Model:** per-contact state machine over a node/edge graph, `published_snapshot`-only execution (§4.8) — draft edits in the builder never affect a running execution, matching LFG's proven publish/snapshot pattern.

**Node catalog** (unified across what LFG split into "flows" vs. "sequences" — see §7):
- **Triggers:** `incoming_message`, `keyword`, `contact_created`, `lead_created`, `tag_added`, `manual`, `webhook`, `schedule`.
- **Actions:** `send_template`, `send_text`, `send_media` (image/video/document/audio), `send_buttons`, `send_list`, `delay`, `add_tag`/`remove_tag`, `update_contact`, `create_contact`, `http_request`, `ai_response`, `goto`, `end`.
- **Logic:** `if_else`, `switch`, `wait_reply`, `wait_event` (payment/meeting/deal_won-style external resolves), `save_variable`, `loop` (max-iteration bounded), `parallel_branch`/`merge`.

**Execution loop** (`continue_execution`, Celery task):
```python
def continue_execution(execution_id: UUID) -> None:
    execution = load_execution_for_update(execution_id)   # SELECT ... FOR UPDATE SKIP LOCKED
    steps = 0
    while steps < MAX_STEPS:  # hard cap, same guardrail as LFG (40)
        node = snapshot_node(execution.flow_version, execution.current_node_key)
        result = run_node(node, execution)                # renders {{variables}} via Jinja-lite
        if result.wait:
            execution.status, execution.wait = "waiting", result.wait
            if result.wait.type in ("delay", "reply", "event"):
                schedule_resume(execution, result.wait)    # see below
            break
        if result.end:
            execution.status = "completed"
            break
        execution.current_node_key = next_node(execution.flow_version, node, result.handle)
        steps += 1
    persist(execution)
```

**Delayed/waiting resumption — Celery-eta everywhere, no cron-polling:** the single biggest architectural upgrade over LFG, which had *two* graph engines with *two* different scheduling strategies (flows cron-polled, sequences used real delayed jobs) — this design unifies on the pattern LFG's own sequences engine proved was better:
- The moment a node enters `wait: {type: delay, until}` or a timed `wait_reply`, the engine immediately schedules `resume_execution.apply_async(args=[execution.id], eta=wait.until)` and stores the returned `celery_task_id` on the execution row.
- **Backup sweeper (belt-and-suspenders, per LFG's own documented lesson that a single scheduler dies on redeploys):** a Celery Beat task every 60s runs `SELECT ... FROM automation_executions WHERE status='waiting' AND wait->>'type' IN ('delay') AND (wait->>'until')::timestamptz < now() FOR UPDATE SKIP LOCKED`, and calls `resume_execution` for anything found — idempotent by construction, since `resume_execution` does a conditional `UPDATE ... WHERE status='waiting' RETURNING` before doing any work, so a race between the eta-task and the sweeper resolves to exactly one winner.
- `wait_reply` resumption is triggered from step 5 of §5's dispatcher, which also **must check `wait.until` and expire the wait if past timeout** before treating an inbound reply as a valid resume — LFG's own documented bug (un-timed-out reply waits) is closed by making `timeout_minutes` a **required** field on `wait_reply` node config, rejected at publish time if absent.

**Publish-time validation (built in from day one, closing LFG's own documented pitfalls):**
1. Dedupe `(source, target, source_handle)` edges — reject or silently collapse duplicates before save.
2. Every node with a required condition field must have a non-empty value — reject publish otherwise.
3. Every conditional node's handles (`true`/`false`, every `switch` case) must have a wired outgoing edge — reject publish otherwise (LFG's silent-halt bug).
4. Graph reachability check: every path from the trigger must reach an `end` node (BFS from trigger) — reject publish otherwise (LFG's "conversions never fire" bug).
5. `wait_reply`/timed waits require `timeout_minutes` — reject publish otherwise.
6. Button/list node option counts enforced against Meta's real limits (max 3 buttons/20 chars, max 10 sections × 10 rows) at save time, not discovered at send time as a Graph API error.

**Debuggability from day one:** `GET /tenants/{id}/automation-executions/{id}/events` reads `automation_execution_events` directly — shipped in Phase 1 of the roadmap (§13), not bolted on later.

**Button/list reply parsing:** a single, well-tested `parse_interactive_reply(payload) -> InteractiveReply` function (button_id/list_id/text) shared by both the flow engine's resume logic and the AI agent's message-ingestion — one parser, unit-tested against Meta's documented interactive-reply payload shapes, rather than ad hoc extraction at each call site.

## 7. Templates, Broadcasts, and the Sequences-into-Flow Unification

**Templates lifecycle:** `draft → validate_template() → create_meta_template() via httpx+tenacity → status=pending → synced both ways` (push via the template-status webhook branch, pull via a Celery Beat task every 30 minutes). Variable substitution at send time always uses the *stored* template as source of truth, with parameter sanitization. Free-form sends are gated by the 24-hour customer-care window check (§10).

**Broadcast engine — queue-driven, not a synchronous loop (the explicit architectural fix over LFG):**
1. `POST /broadcasts/{id}/start` runs the audience query (structurally excluding `opted_out` contacts) and bulk-inserts `broadcast_recipients` rows.
2. Enqueues **one Celery task per batch of ~500 recipients** (not one task per recipient) onto the `broadcast` queue.
3. Each batch task: check the Redis-backed **circuit breaker** for that `whatsapp_account_id`; apply a **Redis token-bucket rate limit** matched to the account's Meta messaging tier; send via `httpx` + `tenacity`; update `broadcast_recipients.status` and increment `broadcasts.analytics` counters.
4. **Quality-rating circuit breaker — kept from LFG, moved into the worker:** every N sends within a batch, check a Redis rolling counter of Meta quality-drop error codes (131049/131050/131026); if the rate exceeds 20%, flip `broadcasts.circuit_breaker_state = 'open'` and stop dequeuing further batches for that broadcast. This is the one piece of LFG's synchronous broadcast loop that was genuinely good and is preserved; only the "synchronous, one process, times out past ~100 recipients" part is replaced.

**Sequences unified into the flow engine — explicit call, with justification:** LFG ended up with two graph-execution engines (WhatsApp flows: cron-polled delays, its own node/edge shape; sequences: real BullMQ-delayed jobs, A/B variants, event-waits, loops/parallel branches) that are conceptually the same thing — a graph of nodes executed per-contact with pauses — built twice because they grew from different feature requests instead of one engine with pluggable triggers. This design merges them into `automation_flows`/`automation_executions` (§4.8) with `trigger_type` as the only real differentiator, all node types available regardless of trigger (loop, parallel_branch, wait_event, and A/B variant selection via a `split_test` node type folded into the same catalog), and the Celery-eta scheduling from §6 used everywhere — closing the "two engines, two scheduling strategies" wart at the source.

## 8. AI Auto-Reply / RAG Design

**Embedding pipeline (Celery task per `knowledge_source`), replacing LFG's fake `$text`-search retrieval with real vector search:**
- **Ingestion:** website → real headless-browser crawl (Playwright) + readability-style extraction (not innerText dumping); PDF/DOCX → real parsers (`pypdf`/`pdfplumber`, `python-docx`) instead of LFG's crude regex PDF extraction; FAQ/catalog → structured rows straight from JSONB, no text-splitting needed.
- **Chunking:** token-aware (`tiktoken` or the embedding model's tokenizer), targeting ~300–500 tokens per chunk with ~15% overlap, splitting on sentence/paragraph boundaries (not LFG's naive "nearest newline or period" character-count split).
- **Embedding model:** provider-abstracted (`app/ai/embeddings/{openai,voyage,local}.py`, mirroring LFG's own good LLM-provider abstraction pattern) — default to a hosted embedding API (e.g. `text-embedding-3-small`, 1536-dim) for v1, with the column sized to that dimension; swapping models later is a provider-config change if the dimension matches, else a migration.
- **Storage/index:** `knowledge_chunks.embedding VECTOR(1536)`, **HNSW** index with `vector_cosine_ops` (chosen over IVFFlat — better recall/latency at these write volumes/query patterns, no periodic `REINDEX` after bulk loads). **Caveat:** pgvector's HNSW isn't natively partition-aware for per-tenant filtering — at v1 scale (thousands of chunks/tenant) a `WHERE tenant_id = :t` pre-filter alongside the HNSW ORDER BY is fine; if a tenant's KB grows into the hundreds of thousands of chunks, revisit with a partial index per large tenant or a dedicated vector DB with real tenant namespacing (Qdrant).

**Confidence/handoff — explicit improvement over LFG's "chunk count as confidence" heuristic:**
1. **Stage 0 (unchanged, cheap, genuinely good):** deterministic keyword handoff gate runs *before* any retrieval or LLM call — refund/complaint/legal/human/agent/etc. → immediate canned handoff, no LLM spend.
2. **Retrieval:** vector search top-k (e.g. k=10) by cosine distance, tenant-scoped.
3. **Reranking (new):** a cross-encoder reranker (e.g. `bge-reranker` or a hosted rerank API) scores the top-k against the actual query and keeps the top-3; if the best rerank score is below a threshold, treat as "no relevant knowledge" and skip straight to handoff — catches high-cosine-similarity-but-not-actually-responsive content that raw cosine distance alone can't detect.
4. **Generation with self-reported confidence (new — replaces the chunk-count heuristic):** the LLM call uses structured/function-call output enforcing `{answer, confidence: float 0-1, requires_human: bool, reason}`, so confidence comes from the model's own assessment, not a proxy metric. Final `handoff = requires_human or confidence < tenant.settings.ai.confidence_threshold or rerank_score_too_low`.
5. On provider error: fall back to a templated reply using the top reranked chunk, or a generic handoff message if retrieval returned nothing.

**Human-intervention suppression:** identical to §4.5/§5 — the AI gate checks `conversation.inbox_status != 'intervened'` as a hard precondition, and the same DB-level guard prevents an inbound message from ever clearing `intervened` back to `unread`, so AI never "wakes back up" after a human has taken over.

**AI Reply Assist (manual mode):** the same retrieval+generation machinery, exposed as a "suggest, don't send" endpoint for the human inbox — one underlying `generate_answer()` function with a `suggest_only: bool` flag rather than duplicating the RAG call path.

## 9. Realtime Inbox

**SSE, not WebSockets** — simpler infra (no socket.io/stateful gateway), works over plain HTTP/1.1 through standard load balancers, trivial client reconnect (`EventSource` auto-retries).

- `GET /realtime/stream` (JWT-authenticated via query param, since `EventSource` can't set headers) returns a `StreamingResponse` with `Content-Type: text/event-stream`; a 20–25s heartbeat comment keeps intermediate proxies from closing the connection.
- **Horizontal scaling via Redis pub/sub fan-out:** each API pod, on a client connecting, subscribes (`redis.asyncio` pub/sub) to that tenant's channel `tenant:{id}:events` and forwards messages to the connected `EventSource`; any pod can serve any tenant's stream — no sticky sessions needed — because the Celery worker that produces an event (§5 step 4) publishes to the Redis channel, not to a specific pod.
- Typed event helpers (`emit_chat_message`, `emit_chat_read`, `emit_message_status`, `emit_typing`, `emit_notification`) mirror LFG's `publish.js` — one function per event type, not free-form dict payloads.
- **Capacity note:** SSE connections are cheap under asyncio (idle socket + pub/sub subscription, not a blocked thread); if connection count ever becomes the bottleneck rather than CPU, split the SSE endpoint into its own process group (same three-way topology split as §3).

## 10. Security & Compliance

- **Webhook signature verification:** exactly one implementation (`app/security/meta_signature.py::verify_meta_signature(raw_body, signature_header, secret) -> bool`), called unconditionally for every webhook branch before any DB write (§5) — LFG's dead-duplicate-module and "verified only for the messages branch" bugs are structurally impossible here because there's one function and one call site.
- **No fail-open, ever:** if the expected secret can't be resolved, `verify_meta_signature` raises rather than returning `True` — a missing secret is a `500`/alert, never a silent pass. Written as a unit test (`test_missing_secret_fails_closed`) that must exist before this function ships.
- **Secret encryption at rest:** `access_token`, `app_secret`, `verify_token`, and generic `integrations.credentials` are envelope-encrypted — Fernet/AES-GCM at the application layer, with the master key held in a KMS (AWS/GCP KMS or HashiCorp Vault) rather than a static `ENCRYPTION_KEY` env var (an explicit upgrade over LFG's env-var key, since a single leaked env var there decrypts every tenant's WhatsApp token). Key versioning supported (`key_version` column) so rotation doesn't require a big-bang re-encryption.
- **24-hour customer care window:** enforced client-side before any free-form send — query for an inbound message within the last 24h; if none, reject with a decoded, actionable error rather than letting Meta's raw `131047` surface.
- **Opt-out compliance:** `contacts.opted_out` is checked at three layers — (1) the dispatcher's step-2 opt-out detection sets it, (2) the broadcast audience query structurally excludes opted-out contacts, (3) any outbound free-text send path checks it as a hard precondition regardless of caller — compliance enforced once at the send-primitive level, not per code path.
- **Tenant isolation:** shared database, shared schema, `tenant_id` on every row (chosen over schema/database-per-tenant, which don't scale operationally past a few hundred tenants). Every repository-layer query goes through a helper that mandates a `tenant_id` filter, and **Postgres Row-Level Security policies are enabled as defense-in-depth** (`SET app.current_tenant = :id` per request/connection, policies checking `tenant_id = current_setting('app.current_tenant')::uuid`) — a second, DB-enforced barrier in case an application-layer filter is ever missed.
- **No test/debug webhook endpoints in production surface** — LFG's documented mistake (test/inject endpoints reachable under the public `/api/webhooks/` prefix) is avoided by never routing debug endpoints under the same path prefix at all; internal testing tools live under an auth-gated `/internal/` prefix, environment-flagged off in production.

## 11. Scalability & Reliability Tactics (summary)

| Requirement | Mechanism |
|---|---|
| Stateless, horizontally scalable API tier | FastAPI pods behind a load balancer, no in-process session state; SSE fan-out via Redis (§9). |
| Webhook ingestion decoupled from processing | Verify + audit + enqueue + 200 in the handler; all business logic in Celery (§5). |
| DB connection pooling | SQLAlchemy pool per pod + PgBouncer transaction pooling in front of Postgres (§3). |
| Message table growth | Monthly RANGE partitioning + covering indexes; tenant-level sub-partitioning as a later lever (§4.6). |
| Read scaling | 1–2 streaming read replicas; reporting/analytics and inbox-list reads routed to replicas, writes always to primary. |
| Per-tenant & global rate limiting | Redis token buckets: per-WABA (matched to Meta's messaging tier) for outbound, per-tenant/global for inbound API traffic. |
| Circuit breakers for Graph API | Redis-backed breaker per `phone_number_id` (§3), tripped by sustained 5xx/429 or quality-drop error codes. |
| Retry/backoff for outbound Meta calls | `tenacity` with exponential backoff, honoring `Retry-After` on 429s. |
| Idempotency for webhook processing | Unique `(whatsapp_account_id, wamid)` constraint on `messages` (§4.6) + ingress audit dedup. |
| Dead-letter queue | `dead_letter_tasks` table populated on Celery `max_retries` exhaustion (§4.13), alerted via Prometheus. |
| Caching | Redis caches WABA config, template payloads, tenant AI settings, Meta quality-rating/tier — cache-aside, short TTL as a safety net against missed invalidation. |
| Observability | structlog (JSON, tenant/request/trace-scoped), OpenTelemetry tracing, Prometheus metrics, Sentry errors (§3). |
| Graceful degradation | Unlike LFG's "falls back to synchronous execution if Redis is down," **this design requires Redis/Celery in production** — a broker outage should surface as a loud alert, since silent degradation at "million-user" scale is how you lose customer messages without noticing. |

## 12. Explicit "Pitfalls Avoided" — LFG bug → design decision here

| LFG documented issue | Design decision that prevents it |
|---|---|
| Test/debug webhook endpoints reachable under public `/api/webhooks/` prefix | Debug tooling lives under an auth-gated, environment-flagged `/internal/` prefix, never the webhook path (§10). |
| Instagram/leadgen webhook branches processed with zero or conditional signature verification | One `verify_meta_signature()` call site, mandatory before any branch/DB write (§5, §10). |
| Secret-check helper "fails open" (`true`) when its env var is unset | Missing-secret path raises/alerts, never passes (§10), enforced by a required unit test. |
| Two near-duplicate signature-verification modules (one dead) | Exactly one implementation, imported everywhere (§10). |
| Two overlapping webhook routes (shared vs. per-business) | One route: per-tenant path with a random secret token (§4.3). |
| Two parallel conversation models kept in sync by hand | One `conversations`/`messages` schema, no legacy shadow model (§4.5, §4.6). |
| `KnowledgeChunk.embedding` field declared but never populated; retrieval is keyword `$text` search | Real embedding pipeline, pgvector HNSW, actual vector search (§8). |
| Confidence = raw retrieved-chunk count | LLM self-reported structured confidence + reranker score (§8). |
| Synchronous in-process broadcast loop, acknowledged to only work under ~100 recipients | Queue-driven batched Celery sending with per-account rate limiting (§7). |
| Duplicate edges confuse node lookup | Deduped/validated at the Pydantic schema boundary before save (§6). |
| Empty condition values always match | Required-field validation at publish time (§6). |
| Missing/unwired false branches silently halt a flow | Publish-time check that every handle is wired (§6). |
| No guaranteed terminal node reachable from every path | Publish-time reachability (BFS) check (§6). |
| Delay-resume relies on a single scheduler that dies on redeploy | Celery `eta` task at wait-entry + Celery Beat sweeper backup, both idempotent via conditional UPDATE (§6). |
| Reply-waits have no timeout, wait forever | `timeout_minutes` required on `wait_reply`, expired before being honored (§6). |
| No execution-log/debug visibility | `automation_execution_events` + a debug endpoint shipped in Phase 1 (§6, §13). |
| Two graph-execution engines (flows vs. sequences) with different scheduling strategies | Unified `automation_flows`/`automation_executions` engine, Celery-eta scheduling everywhere (§7). |
| Static `ENCRYPTION_KEY` env var for all tenant secrets | KMS-held master key, envelope encryption, key versioning (§10). |
| Graceful "works without Redis" degradation that silently loses delayed-job durability | Redis/Celery treated as required infrastructure; broker outage pages instead of silently degrading (§11). |

## 13. Phased Build Roadmap

**Phase 0 — Foundation (infra, no product features yet).** Repo scaffold (`pyproject.toml`, module layout), Postgres+pgvector and Redis provisioning, Alembic baseline, `tenants`/`users`/`tenant_memberships` + JWT auth, encryption module + KMS wiring, structlog/OpenTelemetry/Prometheus/Sentry skeleton, PgBouncer in front of dev Postgres. Every later phase depends on this.

**Phase 1 — Core messaging (foundational).** `whatsapp_accounts` connect flow (manual credential entry + verify call), the single webhook ingress route (§5 steps 1–7), `contacts`/`conversations`/`messages` (with partitioning from day one), the dispatcher skeleton through step 4 (steps 5–9 stubbed initially), outbound send primitive with the 24h-window check, SSE realtime inbox (§9), the `webhook_ingress` audit log, status-webhook processing.

**Phase 2 — Templates + AI RAG (additive, depends on Phase 1's send primitive and inbox).** `whatsapp_templates` CRUD + Meta submission/sync, `knowledge_sources`/`knowledge_chunks` ingestion with real embeddings, AI agent (§8) wired into dispatcher step 9, AI Reply Assist manual endpoint.

**Phase 3 — Unified automation/flow engine (additive, depends on Phase 1's dispatcher and Phase 2's send primitive for `ai_response` nodes).** `automation_flows`/`automation_executions` schema, graph CRUD + publish-time validation (§6), execution engine + Celery-eta scheduling + Beat sweeper, dispatcher step 8 wired in ahead of the AI gate, execution-events debug endpoint.

**Phase 4 — Broadcasts + sequence-shaped triggers (additive, depends on Phase 3's execution engine).** `broadcasts`/`broadcast_recipients`, queue-driven batched sender with the quality-rating circuit breaker, audience builder query, `tag_added`/`schedule` trigger types added to the same automation engine (no new engine).

**Phase 5 — Lead attribution & integrations (mostly independent of Phases 3–4, could run in parallel).** Generic `integrations` model, Meta Lead Ads (`leadgen`) webhook branch + Graph API lead-details fetch, click-to-WhatsApp `referral` parsing, the unified `apply_lead_attribution()` write path, `needs_reauth` handling.

**Phase 6 — Scale hardening (ongoing/final pass, instrumented from Phase 0 onward).** Read replica cutover for reporting queries, tenant-level sub-partitioning tooling (ready but unused until needed), load testing the webhook ingress tier and broadcast sender at target throughput, chaos-testing broker/DB failover, alert-threshold tuning on every metric named in §11, security review pass against §10/§12 before the first real customer WABA goes live.

**Foundational vs. additive, at a glance:** Phases 0–1 are load-bearing for everything else and cannot be skipped or reordered. Phase 2 (AI) and Phase 3 (flow engine) are each independently valuable and could ship in either order depending on business priority — additive to Phase 1, not to each other. Phase 4 strictly depends on Phase 3's engine (by design — there is no separate sequences engine to build). Phase 5 is the most independent and could be pulled earlier if lead-gen-ad customers are the initial go-to-market wedge. Phase 6 isn't "the end" — its metrics and partitioning strategy are designed in from Phase 0/1, only *exercised* under real load in Phase 6.

### Critical Files for Implementation (once building starts)
- `backend/app/core/security.py` — Fernet/KMS secret encryption + the single `verify_meta_signature()` implementation; §10's "no fail-open" guarantee lives or dies here.
- `backend/app/messaging/dispatcher.py` — the §5 `dispatch_inbound_message` precedence pipeline; the single most business-critical file in the system.
- `backend/app/db/models/messaging.py` — `Contact`/`Conversation`/`Message` SQLAlchemy models including the partitioned `messages` table and its `(whatsapp_account_id, wamid)` unique constraint.
- `backend/app/flows/engine.py` — the unified automation execution engine (§6/§7): state machine loop, publish-time validators, Celery-eta scheduling.
- `backend/app/ai/agent.py` — RAG retrieval + reranking + structured-confidence generation + handoff decision (§8).
- `backend/app/webhooks/whatsapp.py` — the ingress route implementing §5 steps 1–7.
