import type { Block } from "./seo";

export type Doc = {
  slug: string;
  title: string;
  description: string;
  group: "Get started" | "Build" | "Developers" | "Administer";
  body: Block[];
};

/** Public API origin shown in examples. Override with NEXT_PUBLIC_API_URL at build time. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://wap-production-ce44.up.railway.app/api").replace(/\/$/, "");

export const DOCS: Doc[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Create a workspace, connect your WhatsApp Business number and send your first automated reply in about fifteen minutes.",
    group: "Get started",
    body: [
      { type: "p", text: "LeadForGrow gives your team a shared inbox, automation and campaigns on top of the official WhatsApp Business Platform. This page walks you from sign-up to your first automated conversation." },
      { type: "h2", text: "1. Create your workspace" },
      { type: "p", text: "[Sign up](/signup) with your work email and company name. You start on a free trial with limits suited to trying every feature. Everything you create — contacts, templates, flows — belongs to your workspace." },
      { type: "h2", text: "2. Connect a WhatsApp Business number" },
      { type: "p", text: "Open **WhatsApp number** in the dashboard and follow the steps in [Connect WhatsApp](/docs/connect-whatsapp). You'll need a Meta developer app and a phone number that isn't already registered on a personal WhatsApp account." },
      { type: "h2", text: "3. Add your team" },
      { type: "p", text: "In **Settings → Team**, invite teammates as Admin, Agent or Viewer. Then, under **Settings → Assignment**, choose how new chats are routed." },
      { type: "h2", text: "4. Turn on your first automation" },
      { type: "ul", items: ["**Auto-replies → Welcome message** greets people the first time they write in", "**Auto-replies → Away message** covers times outside your business hours", "**Custom replies** answer keywords such as 'price' or 'menu'"] },
      { type: "h2", text: "5. Send a test message" },
      { type: "p", text: "From another phone, message your business number. The conversation appears in **Inbox** and your automation replies. You're live." },
      { type: "callout", tone: "tip", text: "The dashboard's setup checklist tracks these steps for you and links to each one." },
    ],
  },
  {
    slug: "connect-whatsapp",
    title: "Connect your WhatsApp number",
    description: "Link a WhatsApp Business number through Meta's Cloud API and point Meta's webhook at LeadForGrow.",
    group: "Get started",
    body: [
      { type: "p", text: "LeadForGrow uses Meta's **WhatsApp Cloud API**. You keep ownership of your Meta business assets; we send and receive messages on your behalf using credentials you provide." },
      { type: "h2", text: "What you need" },
      { type: "ul", items: ["A Meta Business account and a WhatsApp Business Account (WABA)", "A phone number added to that WABA", "A **permanent access token** for a system user with WhatsApp permissions", "Your Meta app's **App secret** (used to verify incoming webhooks)"] },
      { type: "h2", text: "Steps" },
      { type: "ol", items: ["In the dashboard, open **WhatsApp number** and choose **Connect a number**.", "Enter your **WABA ID**, **Phone number ID**, **Access token** and **App secret**. We validate them with Meta before saving.", "Copy the **Callback URL** and **Verify token** we show you.", "In your Meta app, open **WhatsApp → Configuration**, paste the Callback URL and Verify token, and subscribe to the **messages** field.", "Send a message to your number from another phone to confirm it arrives in the Inbox."] },
      { type: "callout", tone: "info", title: "How we store credentials", text: "Access tokens and app secrets are encrypted at rest and never shown again after saving. Incoming webhooks are accepted only if the signature matches your app secret." },
      { type: "h2", text: "Troubleshooting" },
      { type: "table", head: ["Symptom", "Likely cause"], rows: [["'Invalid token' when connecting", "The token has expired, or the system user lacks whatsapp_business_messaging permission."], ["Messages send but nothing arrives in the Inbox", "The webhook isn't subscribed to the **messages** field, or the App secret is wrong."], ["Template list is empty", "Sync templates from the Templates page; only templates on the connected WABA appear."]] },
    ],
  },
  {
    slug: "templates-and-broadcasts",
    title: "Templates and broadcasts",
    description: "Create message templates, get them approved and send a campaign to a tag, segment or uploaded list.",
    group: "Build",
    body: [
      { type: "h2", text: "Message templates" },
      { type: "p", text: "Open **Templates** to create a template. Choose a category (Utility, Marketing or Authentication), write the body with `{{1}}`-style variables, add example values and any buttons, then submit. Status is updated from Meta's notifications and a periodic sync." },
      { type: "ul", items: ["Variables need sample values so Meta can review them", "Use the **Library** for ready-made starting points", "Only **approved** templates can be used in campaigns, flows and the API"] },
      { type: "h2", text: "Broadcasts" },
      { type: "ol", items: ["Open **Broadcasts → New campaign** and choose an approved template.", "Map the template's variables to contact fields such as name or any custom detail.", "Choose the audience: all contacts, a tag, a segment, a CSV upload or pasted numbers. The preview shows how many will receive it and how many were skipped and why.", "Send now or schedule for later. You can pause or cancel a running campaign."] },
      { type: "callout", tone: "info", text: "Contacts who opted out are always excluded. Delivery, read, reply and failure states appear per recipient in **Campaign Reports**." },
    ],
  },
  {
    slug: "flows",
    title: "Chat flows reference",
    description: "Every step type in the flow builder, what it does and how triggers work.",
    group: "Build",
    body: [
      { type: "p", text: "A flow is a graph of steps that starts from a **trigger**. Draft as long as you like; only the published version runs. Publishing validates the flow and lists anything that needs fixing." },
      { type: "h2", text: "Triggers" },
      { type: "table", head: ["Trigger", "Starts when"], rows: [["Keyword", "An incoming message contains or equals one of your keywords"], ["Incoming message", "Any message arrives (with a per-contact cooldown)"], ["New contact", "A contact is created"], ["Campaign reply", "A contact replies to a broadcast"], ["Event", "An event with a given name arrives from the API or an integration"], ["Manual", "You run it from the dashboard or the API"]] },
      { type: "h2", text: "Steps" },
      { type: "table", head: ["Step", "What it does"], rows: [["Send message / media", "Sends text, an image, video, audio or document"], ["Buttons / List menu", "Up to 3 quick-reply buttons or up to 10 list rows; each option is a branch"], ["Send template", "Sends an approved template (works outside 24 hours)"], ["Ask a question", "Waits for a reply, validates it (text, email, number, date, choice) and saves it"], ["Condition", "Branches Yes/No on tags, saved details, answers or keywords"], ["Wait", "Pauses for minutes, hours or days"], ["Add / remove tag, Set detail", "Updates the contact"], ["Assign agent", "Assigns the chat to a person or by your assignment rules"], ["Call webhook", "Sends the contact and variables to your URL and reads the JSON response"], ["AI reply", "Answers from your knowledge base"], ["Hand over to human", "Stops automation and notifies your team"], ["Create deal / Move deal", "Adds the contact to your sales pipeline or moves their open deal"], ["Payment link", "Creates a Razorpay payment link and sends it in the chat"], ["End", "Finishes the flow"]] },
      { type: "h2", text: "Merge fields" },
      { type: "p", text: "Use `{{first_name}}`, `{{name}}`, `{{phone}}`, `{{trait.city}}` for saved details and `{{var.answer}}` for answers collected earlier in the flow." },
      { type: "callout", tone: "warn", title: "Loops must wait", text: "A loop that never waits for the contact would run forever, so publishing rejects it. Add a question or a wait inside the loop." },
    ],
  },
  {
    slug: "pipeline-and-payments",
    title: "Sales pipeline and payments",
    description: "Set up stages, create deals, and collect payments from customers with Razorpay payment links.",
    group: "Build",
    body: [
      { type: "h2", text: "Pipeline" },
      { type: "p", text: "Open **Sales → Pipeline**. New workspaces start with *New lead, Contacted, Qualified, Proposal sent, Won* and *Lost*. Use **Stages** to rename, recolour and reorder them, set each open stage's win probability and choose whether new WhatsApp contacts become deals automatically." },
      { type: "ul", items: ["Drag a card to another stage; dropping into a **Won** or **Lost** stage closes the deal", "Open a deal for notes, an owner, expected close date and its activity trail", "**Sales Reports** show revenue won, win rate, average deal size, cycle time and lost reasons"] },
      { type: "h2", text: "Collect payments from customers" },
      { type: "ol", items: ["In Razorpay, generate API keys (use test mode first).", "In **Settings → Payments**, paste the Key ID and Secret and connect.", "Use **Request payment** in a chat or a deal. Enter an amount and description; the link is created on your Razorpay account."] },
      { type: "p", text: "Links update to **paid** automatically. For instant updates, add a Razorpay webhook for `payment_link.paid` pointing to your Razorpay integration's hook URL (see [Integrations](/docs/integrations)); otherwise we check open links in the background." },
      { type: "h2", text: "Your LeadForGrow plan" },
      { type: "p", text: "Plans are prepaid for 1, 3 or 12 months in **Settings → Plan & billing**. GST is added at checkout and each payment produces a GST invoice you can print or save as PDF. Changing plan mid-period credits the unused time." },
    ],
  },
  {
    slug: "api-reference",
    title: "REST API reference (v1)",
    description: "Send messages, upsert contacts, track events and list templates with an API key.",
    group: "Developers",
    body: [
      { type: "p", text: `The API base URL is \`${API_BASE}/v1\`. Create keys in **Settings → Developer**; a key is shown once. Send it as \`Authorization: Bearer lfg_live_…\` (or the \`X-API-Key\` header). Each key allows 300 requests per minute.` },
      { type: "callout", tone: "info", text: "Phone numbers can include a country code (`919876543210`) or be local if your workspace has a default country code set in Settings." },
      { type: "h2", text: "Send a message" },
      { type: "code", lang: "bash", text: `curl -X POST ${API_BASE}/v1/messages \\\n  -H "Authorization: Bearer lfg_live_XXXX" -H "Content-Type: application/json" \\\n  -d '{\n    "to": "919876543210",\n    "type": "template",\n    "template": { "name": "order_update", "language": "en", "body": ["Asha", "#1042"] },\n    "callback_data": "order-1042"\n  }'` },
      { type: "p", text: "`type` is `template` (default) or `text`. Text messages are only delivered inside the 24-hour customer service window; otherwise the API returns `409`. A successful call returns `201` with `{ \"result\": true, \"id\": \"…\", \"wamid\": \"…\", \"status\": \"…\" }`." },
      { type: "h2", text: "Upsert a contact" },
      { type: "code", lang: "bash", text: `curl -X POST ${API_BASE}/v1/contacts \\\n  -H "Authorization: Bearer lfg_live_XXXX" -H "Content-Type: application/json" \\\n  -d '{ "phone": "919876543210", "name": "Asha Rao", "email": "asha@example.com", "tags": ["vip"], "traits": { "city": "Pune" } }'` },
      { type: "p", text: "Tags are added, never removed; traits are merged. Returns `{ \"result\": true, \"id\": \"…\", \"created\": true }`." },
      { type: "h2", text: "Track an event" },
      { type: "code", lang: "bash", text: `curl -X POST ${API_BASE}/v1/events \\\n  -H "Authorization: Bearer lfg_live_XXXX" -H "Content-Type: application/json" \\\n  -d '{ "phone": "919876543210", "event": "order_placed", "properties": { "order_id": "1042", "total": "1499" } }'` },
      { type: "p", text: "Starts any published flow whose trigger listens for that event name and returns `202`." },
      { type: "h2", text: "List contacts and templates" },
      { type: "ul", items: ["`GET /v1/contacts?limit=50&offset=0` — paginated, with `has_next_page`", "`GET /v1/templates` — approved templates with their variable counts"] },
      { type: "h2", text: "Errors" },
      { type: "table", head: ["Status", "Meaning"], rows: [["401", "Missing, invalid or revoked API key"], ["402", "A plan limit was reached (for example contacts)"], ["404", "No approved template with that name and language"], ["409", "No connected number, or the message can't be sent now (for example outside the 24-hour window)"], ["422", "Validation error — the message explains what to fix"], ["429", "Rate limit exceeded; retry after the `Retry-After` seconds"]] },
    ],
  },
  {
    slug: "webhooks",
    title: "Outbound webhooks",
    description: "Receive signed events at your URL when messages, contacts, campaigns, deals or payments change.",
    group: "Developers",
    body: [
      { type: "p", text: "Add an endpoint in **Settings → Developer → Outbound webhooks** and choose events (none selected means all). We POST JSON to your URL; your endpoint should reply `2xx` within 8 seconds." },
      { type: "h2", text: "Envelope" },
      { type: "code", lang: "json", text: '{\n  "version": "1.0",\n  "timestamp": "2026-09-20T09:30:00+00:00",\n  "type": "message_received",\n  "data": { "message_id": "…", "from": "919876543210", "type": "text", "text": "Hi" }\n}' },
      { type: "h2", text: "Events" },
      { type: "table", head: ["Group", "Events"], rows: [["Messages", "message_received, message_sent, message_delivered, message_read, message_failed"], ["Contacts", "contact_created, contact_opted_out, conversation_created, lead_captured"], ["Templates & campaigns", "template_status_update, broadcast_completed, flow_completed"], ["Sales", "deal_created, deal_stage_changed, deal_won, deal_lost, payment_received"]] },
      { type: "h2", text: "Verify the signature" },
      { type: "p", text: "Each request has `X-LFG-Event` and `X-LFG-Signature: sha256=<hex>`, the HMAC-SHA256 of the **raw request body** with your endpoint secret. Reject requests whose signature doesn't match." },
      { type: "code", lang: "js", text: 'import crypto from "node:crypto";\n\nexport function verify(rawBody, header, secret) {\n  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header || ""));\n}' },
      { type: "code", lang: "python", text: 'import hmac, hashlib\n\ndef verify(raw_body: bytes, header: str, secret: str) -> bool:\n    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, header or "")' },
      { type: "callout", tone: "warn", text: "Endpoints that fail five deliveries in a row are disabled automatically. Fix the problem and re-enable the endpoint in Settings." },
    ],
  },
  {
    slug: "integrations",
    title: "Integrations",
    description: "Connect Shopify, WooCommerce, Razorpay, Stripe, Slack or any tool that can send a webhook.",
    group: "Developers",
    body: [
      { type: "p", text: "Open **Integrations**, pick a provider and follow the steps shown. Each provider sends events to a secret hook URL that only your workspace knows. We verify the provider's signature, create or update the contact and run the action you mapped." },
      { type: "table", head: ["Provider", "Events", "Signature header"], rows: [["Shopify", "order placed, paid, shipped, cancelled, checkout abandoned", "X-Shopify-Hmac-Sha256"], ["WooCommerce", "order placed, processing, completed, cancelled", "X-WC-Webhook-Signature"], ["Razorpay", "payment captured, payment failed, order paid, payment link paid", "X-Razorpay-Signature"], ["Stripe", "payment succeeded, payment failed, checkout completed", "Stripe-Signature"], ["Generic webhook", "Any event name you send", "Optional X-LFG-Signature"], ["Slack (notifications)", "New conversations, leads, failures, campaign results, won deals, payments", "—"]] },
      { type: "h2", text: "Map an event to a message" },
      { type: "p", text: "For each event, choose an approved template and fill its variables using values from the event — for example the order number or amount. When the event arrives the contact receives that template." },
      { type: "h2", text: "Generic webhook body" },
      { type: "code", lang: "json", text: '{\n  "phone": "919876543210",\n  "name": "Priya",\n  "email": "priya@example.com",\n  "event": "order_placed",\n  "properties": { "order_id": "1042" },\n  "tags": ["vip"],\n  "traits": { "city": "Pune" }\n}' },
      { type: "callout", tone: "tip", text: "Rotate a hook URL any time from the integration's card if you think it has leaked." },
    ],
  },
  {
    slug: "roles-and-access",
    title: "Roles and access",
    description: "What owners, admins, agents and viewers can do in a workspace.",
    group: "Administer",
    body: [
      { type: "table", head: ["Role", "Can do"], rows: [["Owner", "Everything, including billing, ownership and admin roles"], ["Admin", "Manage settings, team members (except owners and admins), integrations, billing and developer tools"], ["Agent", "Work in the inbox, contacts, campaigns and flows, and move deals"], ["Viewer", "Read-only access"]] },
      { type: "p", text: "Roles are checked on every request, so a change or removal applies immediately — even to someone who is signed in." },
      { type: "h2", text: "Security tips" },
      { type: "ul", items: ["Give people the lowest role that lets them do their job", "Rotate API keys when someone leaves", "Use a unique, strong password and change it if you suspect a compromise"] },
    ],
  },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
export const DOC_GROUPS = ["Get started", "Build", "Developers", "Administer"] as const;
