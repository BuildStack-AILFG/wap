"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, Users, ShieldCheck, Lock, Check } from "lucide-react";
import {
  getWorkspaceDetail,
  updateWorkspaceName,
  listPlans,
  rotatePassword,
  ApiError,
  type ApiPlan,
  type ApiWorkspaceDetail,
} from "@/lib/api";
import { getSignupPasswordError, getConfirmPasswordError } from "@/lib/validation";
import FormField from "@/components/auth/FormField";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

const ACCENT = "#00926B";

const QUOTA_LABELS: Record<string, [string, string]> = {
  max_whatsapp_numbers: ["WhatsApp number", "WhatsApp numbers"],
  max_team_members: ["Team member", "Team members"],
  max_automation_flows: ["Automation flow", "Automation flows"],
  max_contacts: ["Contact", "Contacts"],
  max_broadcast_recipients_per_month: ["Broadcast recipient / month", "Broadcast recipients / month"],
  ai_replies_included_per_month: ["AI reply / month", "AI replies / month"],
  max_knowledge_sources: ["Knowledge source", "Knowledge sources"],
};

/** Seeded plans use 999,999 as "no limit" (Enterprise). */
const UNLIMITED_THRESHOLD = 999_999;

function formatQuota(key: string, value: number) {
  const [singular, plural] = QUOTA_LABELS[key] ?? [key, key];
  if (value >= UNLIMITED_THRESHOLD) return `Unlimited ${plural.toLowerCase()}`;
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

const USAGE_ROWS: { usageKey: keyof ApiWorkspaceDetail["usage"]; quotaKey: string; label: string }[] = [
  { usageKey: "contacts", quotaKey: "max_contacts", label: "Contacts" },
  { usageKey: "automation_flows", quotaKey: "max_automation_flows", label: "Automation flows" },
  { usageKey: "team_members", quotaKey: "max_team_members", label: "Team members" },
];

function formatPrice(cents: number | null) {
  return cents === null ? "Custom" : `$${cents / 100}`;
}

function Section({ icon: Icon, title, description, children }: { icon: typeof Building2; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}26` }}>
          <Icon className="h-4 w-4" style={{ color: ACCENT }} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-white">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-white/50">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { refresh } = useWorkspace();
  const [detail, setDetail] = useState<ApiWorkspaceDetail | null>(null);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    Promise.all([getWorkspaceDetail(), listPlans()])
      .then(([d, p]) => {
        setDetail(d);
        setName(d.name);
        setPlans(p);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load settings."));
  }, []);

  const canManage = detail?.my_role === "owner" || detail?.my_role === "admin";
  const paidPlans = useMemo(() => plans.filter((p) => !p.is_default_trial && p.id !== "free"), [plans]);

  const trialDaysLeft = useMemo(() => {
    if (!detail?.trial_ends_at || detail.plan.id !== "trial") return null;
    return Math.ceil((new Date(detail.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  }, [detail]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const handleRename = async () => {
    if (!name.trim() || name.trim() === detail?.name) return;
    setSavingName(true);
    setError(null);
    try {
      const updated = await updateWorkspaceName(name.trim());
      setDetail(updated);
      setName(updated.name);
      await refresh();
      flash("Workspace name updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename the workspace.");
    } finally {
      setSavingName(false);
    }
  };

  const passwordErrors = {
    current: currentPassword ? undefined : "Enter your current password",
    next: getSignupPasswordError(newPassword),
    confirm: getConfirmPasswordError(newPassword, confirm),
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    if (Object.values(passwordErrors).some(Boolean)) return;
    setChangingPassword(true);
    setError(null);
    try {
      await rotatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setTouched({});
      flash("Password updated.");
    } catch (err) {
      setError(err instanceof ApiError ? (err.passwordFailures?.[0]?.message ?? err.message) : "Couldn't update your password.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>
        ) : (
          <p className="text-[13.5px] text-white/50">Loading settings…</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-[20px] font-bold text-white">Settings</h1>
      <p className="mt-1 text-[13.5px] text-white/50">Manage your workspace, plan, team, and account security.</p>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}
      {notice && (
        <p className="mt-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-5">
        <Section icon={Building2} title="Workspace" description="The name your team sees across the dashboard.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="workspace-name" className="text-[12px] font-semibold uppercase tracking-wide text-white/50">
                Workspace name
              </label>
              <input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#00926B] disabled:opacity-60"
              />
              <p className="mt-1.5 text-[11.5px] text-white/40">
                Workspace ID: <span className="font-mono">{detail.slug}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleRename}
              disabled={!canManage || savingName || !name.trim() || name.trim() === detail.name}
              className="rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
          {!canManage && <p className="mt-3 text-[12px] text-white/40">Only an owner or admin can rename the workspace.</p>}
        </Section>

        <Section icon={CreditCard} title="Plan & usage" description="What you're on today and how much of it you've used.">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-white" style={{ backgroundColor: ACCENT }}>
              {detail.plan.name} plan
            </span>
            {trialDaysLeft !== null && (
              <span className="text-[12.5px] text-white/50">
                {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your trial` : "Your trial has ended"}
              </span>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {USAGE_ROWS.map(({ usageKey, quotaKey, label }) => {
              const used = detail.usage[usageKey];
              const limit = detail.quotas[quotaKey];
              const pct = limit && limit < UNLIMITED_THRESHOLD ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <div key={usageKey}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium text-white/80">{label}</span>
                    <span className="text-white/50">
                      {used.toLocaleString()} / {limit && limit < UNLIMITED_THRESHOLD ? limit.toLocaleString() : "∞"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? "#EF4444" : ACCENT }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paidPlans.map((plan) => {
              const current = plan.id === detail.plan.id;
              return (
                <div
                  key={plan.id}
                  className="flex flex-col rounded-xl border bg-white/[0.03] p-4"
                  style={{ borderColor: current ? ACCENT : "rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-white">{plan.name}</h3>
                    {current && <span className="text-[10.5px] font-semibold uppercase" style={{ color: ACCENT }}>Current</span>}
                  </div>
                  <p className="mt-1 text-[22px] font-bold text-white">
                    {formatPrice(plan.price_monthly)}
                    {plan.price_monthly !== null && <span className="text-[12px] font-medium text-white/40"> /mo</span>}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {Object.entries(plan.quotas)
                      .filter(([, v]) => v > 0)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <li key={k} className="flex items-center gap-1.5 text-[12px] text-white/60">
                          <Check className="h-3 w-3 shrink-0" style={{ color: ACCENT }} />
                          {formatQuota(k, v)}
                        </li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    disabled={current}
                    onClick={() => flash("Online billing isn't connected yet — contact us to switch plans.")}
                    className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-white/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {current ? "Your plan" : "Choose plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>

        <Section icon={Users} title="Team" description="People with access to this workspace.">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                </tr>
              </thead>
              <tbody>
                {detail.members.map((m) => (
                  <tr key={m.user_id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-white">{m.full_name || "—"}</td>
                    <td className="px-4 py-2.5 text-white/60">{m.email}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11.5px] font-semibold capitalize text-white/70">{m.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-white/40">
            {detail.usage.team_members} of {detail.quotas.max_team_members ?? "∞"} seats used on the {detail.plan.name} plan.
          </p>
        </Section>

        <Section icon={ShieldCheck} title="Security" description="Change the password you use to sign in.">
          <form onSubmit={handlePasswordChange} noValidate className="max-w-md space-y-4">
            <FormField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              onBlur={() => setTouched((t) => ({ ...t, current: true }))}
              error={passwordErrors.current}
              touched={touched.current}
              autoComplete="current-password"
              icon={<Lock className="h-4 w-4" />}
              showPasswordToggle
            />
            <FormField
              id="new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              onBlur={() => setTouched((t) => ({ ...t, next: true }))}
              error={passwordErrors.next}
              touched={touched.next}
              autoComplete="new-password"
              icon={<Lock className="h-4 w-4" />}
              showPasswordToggle
            />
            <FormField
              id="confirm-password"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              error={passwordErrors.confirm}
              touched={touched.confirm}
              autoComplete="new-password"
              icon={<Lock className="h-4 w-4" />}
              showPasswordToggle
            />
            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {changingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
