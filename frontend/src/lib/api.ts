const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type PasswordFailure = { rule: string; message: string };

export class ApiError extends Error {
  status: number;
  passwordFailures?: PasswordFailure[];

  constructor(status: number, message: string, passwordFailures?: PasswordFailure[]) {
    super(message);
    this.status = status;
    this.passwordFailures = passwordFailures;
  }
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let passwordFailures: PasswordFailure[] | undefined;
    try {
      const body = await res.json();
      const detail = body.detail ?? body;
      message = detail?.error ?? message;
      passwordFailures = detail?.password_failures;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message, passwordFailures);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  return handleApiResponse<T>(res);
}

/** Same as apiFetch, but attaches the stored access token — for every tenant-scoped resource route. */
async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return handleApiResponse<T>(res);
}

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  trial_ends_at: string | null;
};

export type MeWorkspace = Workspace & { plan_name: string };

export type MeResponse = {
  user_id: string;
  email: string;
  full_name: string | null;
  must_rotate_password: boolean;
  role: string | null;
  workspace: MeWorkspace;
};

export function getMe() {
  return authedFetch<MeResponse>("/auth/me");
}

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

const ACCESS_TOKEN_KEY = "wa_access_token";
const REFRESH_TOKEN_KEY = "wa_refresh_token";

export function storeSession(auth: AuthResponse) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, auth.refresh_token);
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function register(input: { companyName: string; fullName?: string; email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      company_name: input.companyName,
      full_name: input.fullName || undefined,
      email: input.email,
      password: input.password,
    }),
  });
}

export function login(input: { email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
}

export function logout(refreshToken: string) {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function forgotPassword(email: string) {
  return apiFetch<{ success: boolean; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function rotatePassword(input: { currentPassword: string; newPassword: string }) {
  const token = getAccessToken();
  return apiFetch<void>("/auth/rotate-password", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ current_password: input.currentPassword, new_password: input.newPassword }),
  });
}

// ---- Contacts ----

export type ApiContact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  source: string;
  opted_out: boolean;
  last_contacted_at: string | null;
  created_at: string;
};

export function listContacts() {
  return authedFetch<ApiContact[]>("/contacts");
}

export function createContact(input: { name: string; phone: string; email?: string; tags?: string[] }) {
  return authedFetch<ApiContact>("/contacts", { method: "POST", body: JSON.stringify(input) });
}

export function updateContact(id: string, input: { name?: string; tags?: string[]; opted_out?: boolean }) {
  return authedFetch<ApiContact>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteContact(id: string) {
  return authedFetch<void>(`/contacts/${id}`, { method: "DELETE" });
}

// ---- Templates ----

export type ApiTemplate = {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  body: string;
  status: "draft" | "pending" | "approved" | "rejected";
  updated_at: string;
};

export function listTemplates() {
  return authedFetch<ApiTemplate[]>("/templates");
}

export function createTemplate(input: { name: string; language: string; category: string; body: string }) {
  return authedFetch<ApiTemplate>("/templates", { method: "POST", body: JSON.stringify(input) });
}

export function deleteTemplate(id: string) {
  return authedFetch<void>(`/templates/${id}`, { method: "DELETE" });
}

// ---- Broadcasts ----

export type ApiBroadcast = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "completed";
  audience: { type: "all_contacts" | "tag"; tag?: string | null };
  total_recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  created_at: string;
};

export function listBroadcasts() {
  return authedFetch<ApiBroadcast[]>("/broadcasts");
}

export function createBroadcast(input: { name: string; template_id: string; audience_type: "all_contacts" | "tag"; audience_tag?: string }) {
  return authedFetch<ApiBroadcast>("/broadcasts", { method: "POST", body: JSON.stringify(input) });
}

// ---- Automation flows ----

export type ApiFlow = {
  id: string;
  name: string;
  trigger_type: string;
  status: "draft" | "published" | "archived";
  conversations_sent: number;
  updated_at: string;
};

export function listFlows() {
  return authedFetch<ApiFlow[]>("/flows");
}

export function createFlow(input: { name: string; trigger_type: string }) {
  return authedFetch<ApiFlow>("/flows", { method: "POST", body: JSON.stringify(input) });
}

// ---- Custom replies ----

export type ApiCustomReply = {
  id: string;
  trigger: string;
  reply_text: string;
  enabled: boolean;
  conversations_sent: number;
  updated_at: string;
};

export function listCustomReplies() {
  return authedFetch<ApiCustomReply[]>("/custom-replies");
}

export function createCustomReply(input: { trigger: string; reply_text: string }) {
  return authedFetch<ApiCustomReply>("/custom-replies", { method: "POST", body: JSON.stringify(input) });
}

export function updateCustomReply(id: string, input: { trigger?: string; reply_text?: string; enabled?: boolean }) {
  return authedFetch<ApiCustomReply>(`/custom-replies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCustomReply(id: string) {
  return authedFetch<void>(`/custom-replies/${id}`, { method: "DELETE" });
}

// ---- Generic tenant settings blob (auto-replies, AI agents, intent matching) ----

export function getSettings() {
  return authedFetch<{ settings: Record<string, unknown> }>("/settings");
}

export function patchSettings(settings: Record<string, unknown>) {
  return authedFetch<{ settings: Record<string, unknown> }>("/settings", {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  });
}

// ---- Workspace, plans & usage ----

export type ApiPlan = {
  id: string;
  name: string;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_yearly: number | null;
  is_default_trial: boolean;
  quotas: Record<string, number>;
};

export type ApiMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
};

export type ApiWorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  plan: ApiPlan;
  quotas: Record<string, number>;
  usage: { contacts: number; automation_flows: number; team_members: number };
  trial_ends_at: string | null;
  members: ApiMember[];
  my_role: string | null;
};

export function getWorkspaceDetail() {
  return authedFetch<ApiWorkspaceDetail>("/workspace");
}

export function updateWorkspaceName(name: string) {
  return authedFetch<ApiWorkspaceDetail>("/workspace", { method: "PATCH", body: JSON.stringify({ name }) });
}

export function listPlans() {
  return authedFetch<ApiPlan[]>("/plans");
}
