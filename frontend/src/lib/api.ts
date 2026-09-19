const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export type PasswordFailure = { rule: string; message: string };

export class ApiError extends Error {
  status: number;
  code?: string;
  problems?: string[];
  passwordFailures?: PasswordFailure[];

  constructor(status: number, message: string, extra?: { code?: string; problems?: string[]; passwordFailures?: PasswordFailure[] }) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.problems = extra?.problems;
    this.passwordFailures = extra?.passwordFailures;
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof ApiError ? err.message : fallback;
}

// ---- session ------------------------------------------------------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = "wa_access_token";
const REFRESH_TOKEN_KEY = "wa_refresh_token";

export type Workspace = { id: string; name: string; slug: string; plan_id: string; trial_ends_at: string | null };
export type MeWorkspace = Workspace & { plan_name: string };
export type MeResponse = {
  user_id: string;
  email: string;
  full_name: string | null;
  must_rotate_password: boolean;
  role: string | null;
  workspace: MeWorkspace;
};
export type AuthResponse = {
  user_id: string;
  email: string;
  role: string;
  workspace: Workspace;
  access_token: string;
  refresh_token: string;
  expires_in_minutes: number;
  must_rotate_password: boolean;
};

export function storeSession(auth: { access_token: string; refresh_token: string }) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, auth.refresh_token);
}
export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
export function getAccessToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ---- transport -------------------------------------------------------------------------------------------------------------------------

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let extra: ConstructorParameters<typeof ApiError>[2];
    try {
      const body = await res.json();
      const detail = body.detail ?? body;
      if (Array.isArray(detail)) {
        // FastAPI validation errors: show the first one readably
        const first = detail[0];
        message = first?.msg ? `${(first.loc ?? []).slice(1).join(".") || "Input"}: ${first.msg}` : message;
      } else {
        message = detail?.error ?? message;
        extra = { code: detail?.code, problems: detail?.problems, passwordFailures: detail?.password_failures };
      }
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, message, extra);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? res.json() : res.text()) as Promise<T>;
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time; every request that hit a 401 waits on the same promise. */
async function refreshSession(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
      if (!res.ok) return false;
      storeSession(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opts = { method?: string; body?: unknown; form?: FormData; auth?: boolean; signal?: AbortSignal; headers?: Record<string, string> };

async function raw(path: string, o: Opts, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (!o.form) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { method: o.method ?? "GET", headers, signal: o.signal, body: o.form ?? (o.body === undefined ? undefined : JSON.stringify(o.body)) });
}

async function request<T>(path: string, o: Opts = {}): Promise<T> {
  const auth = o.auth !== false;
  let res = await raw(path, o, auth ? getAccessToken() : null);
  if (res.status === 401 && auth && (await refreshSession())) res = await raw(path, o, getAccessToken());
  if (res.status === 401 && auth && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    clearSession();
    window.location.replace("/login");
  }
  return parse<T>(res);
}

/** Fetch an authenticated file (media, CSV) and return a blob URL / trigger a download. */
export async function fetchBlob(path: string): Promise<{ blob: Blob; type: string }> {
  let res = await raw(path, {}, getAccessToken());
  if (res.status === 401 && (await refreshSession())) res = await raw(path, {}, getAccessToken());
  if (!res.ok) throw new ApiError(res.status, "Couldn't load the file.");
  const blob = await res.blob();
  return { blob, type: blob.type };
}
export async function downloadFile(path: string, filename: string) {
  const { blob } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const qs = (p?: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams();
  Object.entries(p ?? {}).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && u.set(k, String(v)));
  const s = u.toString();
  return s ? `?${s}` : "";
};

// ---- auth --------------------------------------------------------------------------------------------------------------------------------

export const getMe = () => request<MeResponse>("/auth/me");
export const register = (i: { companyName: string; fullName?: string; email: string; password: string }) =>
  request<AuthResponse>("/auth/register", { method: "POST", auth: false, body: { company_name: i.companyName, full_name: i.fullName || undefined, email: i.email, password: i.password } });
export const login = (i: { email: string; password: string }) => request<AuthResponse>("/auth/login", { method: "POST", auth: false, body: i });
export const logout = (refresh_token: string) => request<void>("/auth/logout", { method: "POST", auth: false, body: { refresh_token } });
export const forgotPassword = (email: string) => request<{ success: boolean; message: string }>("/auth/forgot-password", { method: "POST", auth: false, body: { email } });
export const resetPassword = (token: string, new_password: string) => request<void>("/auth/reset-password", { method: "POST", auth: false, body: { token, new_password } });
export const rotatePassword = (i: { currentPassword: string; newPassword: string }) =>
  request<void>("/auth/rotate-password", { method: "POST", body: { current_password: i.currentPassword, new_password: i.newPassword } });

// ---- WhatsApp accounts --------------------------------------------------------------------------------------------------------------------

export type WaAccount = {
  id: string; waba_id: string; phone_number_id: string; display_phone_number: string | null; verified_name: string | null; quality_rating: string | null;
  messaging_limit: string | null; name_status: string | null; connection_type: string; status: "connected" | "error" | "disconnected"; last_error: string | null;
  last_webhook_at: string | null; last_synced_at: string | null; has_app_secret: boolean; app_id: string | null; notices: { kind: string; at: string }[];
  webhook_url?: string; verify_token?: string; warnings?: string[];
};
export type WaConfig = {
  embedded_signup: { enabled: boolean; app_id: string | null; config_id: string | null; graph_version: string };
  platform_webhook_url: string; platform_verify_token: string | null; app_secret_required: boolean; graph_version: string;
};
export const whatsapp = {
  config: () => request<WaConfig>("/whatsapp/config"),
  list: () => request<WaAccount[]>("/whatsapp/accounts"),
  connect: (b: { waba_id: string; phone_number_id: string; access_token: string; app_secret?: string; app_id?: string }) => request<WaAccount>("/whatsapp/accounts", { method: "POST", body: b }),
  connectEmbedded: (b: { code: string; waba_id: string; phone_number_id: string }) => request<WaAccount>("/whatsapp/accounts/embedded", { method: "POST", body: b }),
  update: (id: string, b: { access_token?: string; app_secret?: string; app_id?: string }) => request<WaAccount>(`/whatsapp/accounts/${id}`, { method: "PATCH", body: b }),
  refresh: (id: string) => request<WaAccount>(`/whatsapp/accounts/${id}/refresh`, { method: "POST" }),
  syncTemplates: (id: string) => request<{ created: number; updated: number; total: number }>(`/whatsapp/accounts/${id}/sync-templates`, { method: "POST" }),
  test: (id: string, to: string) => request<{ ok: boolean; conversation_id: string }>(`/whatsapp/accounts/${id}/test`, { method: "POST", body: { to } }),
  disconnect: (id: string) => request<void>(`/whatsapp/accounts/${id}`, { method: "DELETE" }),
  reconnect: (id: string) => request<WaAccount>(`/whatsapp/accounts/${id}/reconnect`, { method: "POST" }),
};

// ---- contacts -------------------------------------------------------------------------------------------------------------------------------

export type Contact = {
  id: string; name: string; phone: string; email: string | null; tags: string[]; traits: Record<string, unknown>; source: string; opted_out: boolean;
  last_contacted_at: string | null; created_at: string;
};
export type ContactDetail = Contact & { events: { name: string; properties: Record<string, unknown>; source: string; at: string }[]; ad_attribution: Record<string, string> };
export type Page<T> = { total: number; items: T[] };
export const contacts = {
  list: (p: { q?: string; tag?: string; opted_out?: boolean; source?: string; segment_id?: string; sort?: string; limit?: number; offset?: number }) => request<Page<Contact>>(`/contacts${qs(p)}`),
  get: (id: string) => request<ContactDetail>(`/contacts/${id}`),
  create: (b: { name: string; phone: string; email?: string; tags?: string[]; traits?: Record<string, unknown> }) => request<Contact>("/contacts", { method: "POST", body: b }),
  update: (id: string, b: Partial<{ name: string; email: string | null; phone: string; tags: string[]; traits: Record<string, unknown>; opted_out: boolean }>) => request<Contact>(`/contacts/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/contacts/${id}`, { method: "DELETE" }),
  tags: () => request<{ tag: string; count: number }[]>("/contacts/tags"),
  traits: () => request<string[]>("/contacts/traits"),
  bulk: (b: { ids: string[]; action: "add_tag" | "remove_tag" | "opt_out" | "opt_in" | "delete"; tag?: string }) => request<{ affected: number }>("/contacts/bulk", { method: "POST", body: b }),
  addEvent: (id: string, name: string, properties: Record<string, unknown> = {}) => request<{ ok: boolean }>(`/contacts/${id}/events`, { method: "POST", body: { name, properties } }),
  importCsv: (file: File, o: { default_country_code?: string; update_existing?: boolean; add_tag?: string }) => {
    const f = new FormData();
    f.append("file", file);
    f.append("default_country_code", o.default_country_code ?? "");
    f.append("update_existing", String(o.update_existing ?? true));
    f.append("add_tag", o.add_tag ?? "");
    return request<{ created: number; updated: number; skipped: number; total_rows: number; errors: { row: number; error: string }[]; more_errors: number }>("/contacts/import", { method: "POST", form: f });
  },
  exportCsv: (p: { q?: string; tag?: string; opted_out?: boolean }) => downloadFile(`/contacts/export/csv${qs(p)}`, "contacts.csv"),
};

// ---- templates --------------------------------------------------------------------------------------------------------------------------------

export type TemplateButton = { type: "quick_reply" | "url" | "phone" | "copy_code" | "otp"; text: string; url?: string; phone?: string; example?: string };
export type Template = {
  id: string; name: string; language: string; category: "MARKETING" | "UTILITY" | "AUTHENTICATION"; body: string;
  status: "draft" | "pending" | "approved" | "rejected" | "paused" | "disabled"; header_type: "none" | "text" | "image" | "video" | "document"; header_text: string | null;
  header_example: string | null; footer: string | null; buttons: TemplateButton[]; body_examples: string[]; rejection_reason: string | null; quality_score: string | null;
  meta_template_id: string | null; requires: { header_text: boolean; header_media: string | null; body: number[]; buttons: number[] }; last_synced_at: string | null; created_at: string;
  submit_error?: string;
};
export type TemplateInput = {
  name: string; language: string; category: string; body: string; header_type: string; header_text?: string; header_example?: string; footer?: string;
  buttons: TemplateButton[]; body_examples: string[]; submit: boolean;
};
export type LibraryTemplate = { key: string; title: string; category: string; name: string; body: string; body_examples: string[]; footer: string | null; buttons: TemplateButton[] };
export const templates = {
  list: (p?: { status?: string; category?: string; q?: string }) => request<Template[]>(`/templates${qs(p)}`),
  library: () => request<LibraryTemplate[]>("/templates/library"),
  create: (b: TemplateInput) => request<Template>("/templates", { method: "POST", body: b }),
  update: (id: string, b: TemplateInput) => request<Template>(`/templates/${id}`, { method: "PUT", body: b }),
  submit: (id: string) => request<Template>(`/templates/${id}/submit`, { method: "POST" }),
  duplicate: (id: string) => request<Template>(`/templates/${id}/duplicate`, { method: "POST" }),
  remove: (id: string) => request<void>(`/templates/${id}`, { method: "DELETE" }),
  aiDraft: (b: { description: string; category: string; language?: string }) => request<{ name: string; body: string; footer: string; body_examples: string[] }>("/templates/ai-draft", { method: "POST", body: b }),
};

// ---- inbox --------------------------------------------------------------------------------------------------------------------------------------

export type ConversationSummary = {
  id: string; status: "open" | "resolved"; inbox_status: "bot" | "intervened"; labels: string[]; unread_count: number; last_message_at: string | null;
  last_message_preview: string | null; window_open: boolean; window_expires_at: string | null; account_id: string;
  assigned_user: { id: string; name: string } | null; contact: { id: string; name: string; phone: string; opted_out: boolean };
};
export type ConversationDetail = ConversationSummary & {
  contact: ConversationSummary["contact"] & { email: string | null; tags: string[]; traits: Record<string, unknown>; source: string; ad_attribution: Record<string, string>; created_at: string };
  events: { name: string; properties: Record<string, unknown>; at: string }[];
};
export type ChatMessage = {
  id: string; direction: "in" | "out"; type: string; body: string | null; status: string; error: string | null; sender_type: string; sender_user_id: string | null;
  is_internal: boolean; has_media: boolean; media_mime: string | null; media_filename: string | null; payload: Record<string, unknown>;
  created_at: string; sent_at: string | null; delivered_at: string | null; read_at: string | null;
};
export type SendBody = { type: "text" | "image" | "video" | "audio" | "document" | "template" | "note"; text?: string; media_id?: string; media_filename?: string; media_mime?: string; template_id?: string; variables?: Record<string, unknown>; keep_bot?: boolean };
export const inbox = {
  list: (p: { status?: string; assigned?: string; unread?: boolean; q?: string; label?: string; mode?: string; limit?: number; offset?: number }) => request<Page<ConversationSummary>>(`/inbox/conversations${qs(p)}`),
  summary: () => request<{ open: number; unread_conversations: number; unassigned: number; mine: number; resolved: number; unread_messages: number; labels: string[] }>("/inbox/summary"),
  get: (id: string) => request<ConversationDetail>(`/inbox/conversations/${id}`),
  messages: (id: string, p?: { limit?: number; before?: string }) => request<{ items: ChatMessage[]; has_more: boolean; window_open: boolean; window_expires_at: string | null }>(`/inbox/conversations/${id}/messages${qs(p)}`),
  send: (id: string, b: SendBody) => request<ChatMessage>(`/inbox/conversations/${id}/messages`, { method: "POST", body: b }),
  upload: (id: string, file: File) => {
    const f = new FormData();
    f.append("file", file);
    return request<{ media_id: string; type: "image" | "video" | "audio" | "document"; mime: string; filename: string }>(`/inbox/conversations/${id}/media`, { method: "POST", form: f });
  },
  read: (id: string) => request<{ ok: boolean }>(`/inbox/conversations/${id}/read`, { method: "POST" }),
  patch: (id: string, b: { status?: string; assigned_user_id?: string | null; labels?: string[]; inbox_status?: string }) =>
    request<ConversationSummary>(`/inbox/conversations/${id}`, { method: "PATCH", body: { ...b, assigned_user_id: b.assigned_user_id === null ? "none" : b.assigned_user_id } }),
  start: (contact_id: string) => request<ConversationSummary>("/inbox/conversations", { method: "POST", body: { contact_id } }),
  mediaUrl: async (messageId: string) => URL.createObjectURL((await fetchBlob(`/inbox/messages/${messageId}/media`)).blob),
};

// ---- broadcasts & segments ------------------------------------------------------------------------------------------------------------------------

export type Audience = { type: "all_contacts" | "tag" | "segment" | "csv" | "numbers"; tag?: string; segment_id?: string; rows?: Record<string, string>[] };
export type Broadcast = {
  id: string; name: string; status: "draft" | "scheduled" | "sending" | "completed" | "cancelled" | "failed"; template_id: string | null; template_name: string | null;
  audience: Record<string, unknown>; scheduled_at: string | null; started_at: string | null; completed_at: string | null; error: string | null; total_recipients: number;
  sent: number; delivered: number; read: number; replied: number; failed: number; delivered_pct: number; read_pct: number; replied_pct: number; failed_pct: number;
  created_at: string; variable_mapping: Record<string, unknown>; skipped?: number; requires?: Template["requires"] | null;
};
export type Recipient = { id: string; phone: string; status: string; error: string | null; sent_at: string | null; delivered_at: string | null; read_at: string | null; replied: boolean };
export const broadcasts = {
  list: () => request<Broadcast[]>("/broadcasts"),
  get: (id: string) => request<Broadcast>(`/broadcasts/${id}`),
  recipients: (id: string, p?: { status?: string; limit?: number; offset?: number }) => request<Page<Recipient>>(`/broadcasts/${id}/recipients${qs(p)}`),
  preview: (audience: Audience) => request<{ count: number; skipped: number; sample: { name: string; phone: string }[] }>("/broadcasts/preview-audience", { method: "POST", body: audience }),
  create: (b: { name: string; template_id: string; audience: Audience; variable_mapping: Record<string, unknown>; schedule_at?: string; send_now?: boolean }) => request<Broadcast>("/broadcasts", { method: "POST", body: b }),
  start: (id: string) => request<Broadcast>(`/broadcasts/${id}/start`, { method: "POST" }),
  cancel: (id: string) => request<Broadcast>(`/broadcasts/${id}/cancel`, { method: "POST" }),
  retry: (id: string) => request<{ retrying: number }>(`/broadcasts/${id}/retry-failed`, { method: "POST" }),
  remove: (id: string) => request<void>(`/broadcasts/${id}`, { method: "DELETE" }),
  exportCsv: (id: string) => downloadFile(`/broadcasts/${id}/export.csv`, `campaign-${id.slice(0, 8)}.csv`),
};
export type SegmentRule = { field: string; op: string; value?: string | number | boolean | null };
export type Segment = { id: string; name: string; filters: { match: "all" | "any"; rules: SegmentRule[] }; count: number; created_at: string };
export const segments = {
  list: () => request<Segment[]>("/segments"),
  create: (b: { name: string; filters: Segment["filters"] }) => request<Segment>("/segments", { method: "POST", body: b }),
  update: (id: string, b: { name: string; filters: Segment["filters"] }) => request<Segment>(`/segments/${id}`, { method: "PUT", body: b }),
  preview: (filters: Segment["filters"]) => request<{ count: number }>("/segments/preview", { method: "POST", body: filters }),
  remove: (id: string) => request<void>(`/segments/${id}`, { method: "DELETE" }),
};

// ---- flows ------------------------------------------------------------------------------------------------------------------------------------------------

export type FlowNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowSummary = { id: string; name: string; trigger_type: string; status: "draft" | "published" | "archived"; version: number; conversations_sent: number; updated_at: string; node_count: number; has_unpublished_changes: boolean };
export type FlowFull = FlowSummary & { graph: FlowGraph; errors?: string[] };
export type FlowExecution = { id: string; status: string; current_node: string | null; contact: { id: string; name: string; phone: string }; error: string | null; wait_until: string | null; created_at: string };
export const flows = {
  list: () => request<FlowSummary[]>("/flows"),
  create: (b: { name: string; trigger_type: string; graph?: FlowGraph }) => request<FlowFull>("/flows", { method: "POST", body: b }),
  get: (id: string) => request<FlowFull>(`/flows/${id}`),
  save: (id: string, b: { name?: string; trigger_type?: string; graph?: FlowGraph }) => request<FlowFull>(`/flows/${id}`, { method: "PUT", body: b }),
  publish: (id: string) => request<FlowFull>(`/flows/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => request<FlowFull>(`/flows/${id}/unpublish`, { method: "POST" }),
  duplicate: (id: string) => request<FlowFull>(`/flows/${id}/duplicate`, { method: "POST" }),
  remove: (id: string) => request<void>(`/flows/${id}`, { method: "DELETE" }),
  run: (id: string, b: { contact_id?: string; phone?: string }) => request<{ execution_id: string; status: string }>(`/flows/${id}/run`, { method: "POST", body: b }),
  executions: (id: string) => request<FlowExecution[]>(`/flows/${id}/executions`),
  execution: (id: string, eid: string) => request<{ id: string; status: string; context: Record<string, unknown>; events: { at: string; node: string; type: string; detail: string }[]; error: string | null }>(`/flows/${id}/executions/${eid}`),
};

// ---- replies & settings ---------------------------------------------------------------------------------------------------------------------------------------

export type CustomReply = { id: string; trigger: string; match_type: "exact" | "contains" | "any"; reply_text: string; flow_id: string | null; priority: number; enabled: boolean; conversations_sent: number };
export const customReplies = {
  list: () => request<CustomReply[]>("/custom-replies"),
  create: (b: { trigger: string; match_type: string; reply_text: string; flow_id?: string | null; priority?: number }) => request<CustomReply>("/custom-replies", { method: "POST", body: b }),
  update: (id: string, b: Partial<{ trigger: string; match_type: string; reply_text: string; flow_id: string | null; priority: number; enabled: boolean }>) => request<CustomReply>(`/custom-replies/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => request<void>(`/custom-replies/${id}`, { method: "DELETE" }),
};
export const getSettings = () => request<{ settings: Record<string, unknown> }>("/settings");
export const patchSettings = (settings: Record<string, unknown>) => request<{ settings: Record<string, unknown> }>("/settings", { method: "PATCH", body: { settings } });

// ---- AI ------------------------------------------------------------------------------------------------------------------------------------------------------------

export type AiConfig = {
  enabled: boolean; agent_type: "support" | "leads" | "sales"; business_name: string; persona_name: string; tone: string; language: string; instructions: string;
  handoff_keywords: string[]; handoff_message: string; fallback_message: string; qualification_fields: string[]; min_confidence: number; model: string;
  has_own_key: boolean; api_key_hint: string; platform_key_available: boolean; usage_this_month: number; included_replies?: number | null;
};
export type KnowledgeSource = { id: string; kind: "text" | "faq" | "url"; title: string; source_url: string | null; status: string; error: string | null; chunk_count: number; created_at: string };
export const ai = {
  config: () => request<AiConfig>("/ai/config"),
  saveConfig: (b: Partial<AiConfig> & { api_key?: string | null }) => request<AiConfig>("/ai/config", { method: "PUT", body: b }),
  sources: () => request<KnowledgeSource[]>("/ai/knowledge"),
  addText: (title: string, content: string) => request<KnowledgeSource>("/ai/knowledge/text", { method: "POST", body: { title, content } }),
  addFaq: (items: { question: string; answer: string }[]) => request<KnowledgeSource>("/ai/knowledge/faq", { method: "POST", body: { items } }),
  addUrl: (url: string, crawl: boolean) => request<KnowledgeSource>("/ai/knowledge/url", { method: "POST", body: { url, crawl } }),
  chunks: (id: string) => request<string[]>(`/ai/knowledge/${id}/chunks`),
  removeSource: (id: string) => request<void>(`/ai/knowledge/${id}`, { method: "DELETE" }),
  test: (question: string) => request<{ reply: string; handoff: boolean; confidence: number; collected: Record<string, string>; sources: string[] }>("/ai/test", { method: "POST", body: { question } }),
};

// ---- widget ------------------------------------------------------------------------------------------------------------------------------------------------------------

export type WidgetInput = {
  name: string; enabled: boolean; phone_number: string; title: string; subtitle: string; welcome_message: string; prefill_message: string; cta_text: string;
  brand_color: string; position: "left" | "right"; bottom_offset: number; delay_seconds: number; collect_lead: boolean; allowed_domains: string[];
};
export type Widget = WidgetInput & { id: string; public_key: string; opens: number; clicks: number; leads: number; script_url: string; embed_snippet: string };
export const widgets = {
  list: () => request<Widget[]>("/widgets"),
  create: (b: Partial<WidgetInput>) => request<Widget>("/widgets", { method: "POST", body: b }),
  update: (id: string, b: WidgetInput) => request<Widget>(`/widgets/${id}`, { method: "PUT", body: b }),
  remove: (id: string) => request<void>(`/widgets/${id}`, { method: "DELETE" }),
  qrUrl: (text: string, dark = "#000000") => `${API_URL}/public/qr${qs({ text, dark, scale: 8 })}`,
};

// ---- developer & integrations ------------------------------------------------------------------------------------------------------------------------------------------

export type ApiKeyRow = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked: boolean; key?: string };
export type WebhookRow = { id: string; url: string; events: string[]; enabled: boolean; failure_count: number; last_status: string | null; last_delivery_at: string | null; secret?: string };
export const developer = {
  keys: () => request<ApiKeyRow[]>("/developer/keys"),
  createKey: (name: string) => request<ApiKeyRow>("/developer/keys", { method: "POST", body: { name } }),
  revokeKey: (id: string) => request<void>(`/developer/keys/${id}`, { method: "DELETE" }),
  events: () => request<string[]>("/developer/webhook-events"),
  webhooks: () => request<WebhookRow[]>("/developer/webhooks"),
  createWebhook: (b: { url: string; events: string[] }) => request<WebhookRow>("/developer/webhooks", { method: "POST", body: b }),
  updateWebhook: (id: string, b: { url: string; events: string[]; enabled: boolean }) => request<WebhookRow>(`/developer/webhooks/${id}`, { method: "PUT", body: b }),
  secret: (id: string) => request<{ secret: string }>(`/developer/webhooks/${id}/secret`),
  testWebhook: (id: string) => request<{ ok: boolean; detail: string }>(`/developer/webhooks/${id}/test`, { method: "POST" }),
  removeWebhook: (id: string) => request<void>(`/developer/webhooks/${id}`, { method: "DELETE" }),
};
export type AdapterMeta = { mode: "events" | "notify" | "generic"; secret_label: string; events: string[]; steps: string[] };
export type IntegrationRow = { provider: string; kind: string; status: string; config: { actions?: Record<string, unknown>; events?: string[] }; has_secret: boolean; last_event_at: string | null; last_error: string | null; hook_url?: string };
export const integrations = {
  adapters: () => request<Record<string, AdapterMeta>>("/integrations/adapters"),
  list: () => request<IntegrationRow[]>("/integrations"),
  save: (provider: string, b: { secret?: string; actions?: Record<string, unknown>; events?: string[] }) => request<IntegrationRow>(`/integrations/${provider}`, { method: "PUT", body: b }),
  rotate: (provider: string) => request<IntegrationRow>(`/integrations/${provider}/rotate-url`, { method: "POST" }),
  slackTest: () => request<{ ok: boolean }>("/integrations/slack/test", { method: "POST" }),
  remove: (provider: string) => request<void>(`/integrations/${provider}`, { method: "DELETE" }),
};

// ---- team, workspace, analytics ---------------------------------------------------------------------------------------------------------------------------------------------

export type Member = { user_id: string; email: string; full_name: string | null; role: string; is_you: boolean; active: boolean; last_login_at: string | null };
export type Invite = { id: string; email: string; role: string; expires_at: string; expired: boolean; email_sent?: boolean; invite_link?: string | null };
export const team = {
  members: () => request<Member[]>("/team/members"),
  setRole: (id: string, role: string) => request<{ role: string }>(`/team/members/${id}`, { method: "PATCH", body: { role } }),
  remove: (id: string) => request<void>(`/team/members/${id}`, { method: "DELETE" }),
  invites: () => request<Invite[]>("/team/invites"),
  invite: (email: string, role: string) => request<Invite>("/team/invites", { method: "POST", body: { email, role } }),
  revoke: (id: string) => request<void>(`/team/invites/${id}`, { method: "DELETE" }),
  inviteInfo: (token: string) => request<{ email: string; role: string; workspace: string; account_exists: boolean }>(`/team/invite/${encodeURIComponent(token)}`, { auth: false }),
  accept: (token: string, b: { full_name: string; password: string }) => request<AuthResponse>(`/team/invite/${encodeURIComponent(token)}/accept`, { method: "POST", auth: false, body: b }),
};
export type ApiPlan = { id: string; name: string; price_monthly: number | null; price_quarterly: number | null; price_yearly: number | null; is_default_trial: boolean; quotas: Record<string, number> };
export type ApiWorkspaceDetail = {
  id: string; name: string; slug: string; plan: ApiPlan; quotas: Record<string, number>; usage: { contacts: number; automation_flows: number; team_members: number };
  trial_ends_at: string | null; members: { user_id: string; email: string; full_name: string | null; role: string }[]; my_role: string | null;
};
export const getWorkspaceDetail = () => request<ApiWorkspaceDetail>("/workspace");
export const updateWorkspaceName = (name: string) => request<ApiWorkspaceDetail>("/workspace", { method: "PATCH", body: { name } });
export const listPlans = () => request<ApiPlan[]>("/plans");

export type Analytics = {
  days: number; messages: { date: string; inbound: number; outbound: number }[]; conversations_started: { date: string; count: number }[]; new_contacts: { date: string; count: number }[];
  delivery: { sent: number; delivered: number; read: number; failed: number; delivered_pct: number; read_pct: number; failed_pct: number };
  first_response: { avg_seconds: number | null; conversations: number }; conversations: { open: number; resolved: number; human_handled: number; unassigned: number };
  agents: { user_id: string; name: string; messages: number; conversations: number }[];
  campaigns: { count: number; recipients: number; sent: number; delivered: number; read: number; replied: number; failed: number }; contacts: { total: number; opted_out: number };
};
export type NotificationItem = { id: string; type: "error" | "warning" | "success"; title: string; detail: string; href: string; at: string };
export const analytics = {
  overview: (days: number) => request<Analytics>(`/analytics/overview${qs({ days })}`),
  notifications: () => request<{ unread_messages: number; unread_conversations: number; items: NotificationItem[] }>("/notifications"),
};
