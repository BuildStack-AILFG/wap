"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, BellRing, Bot, FileText, MessageSquare, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Spinner, Stat, Tabs, Textarea, Toggle, cx, fmtDateTime, statusTone, timeAgo, useUi } from "@/components/ui/kit";
import LeadScoreBadge from "@/components/dashboard/LeadScoreBadge";
import {
  errorMessage, followups as api, templates as templatesApi,
  type FollowupEnrollment, type FollowupInput, type FollowupSequence, type FollowupStatus, type FollowupStep, type SilentLead, type Template,
} from "@/lib/api";

const SOURCES: [string, string][] = [["", "Any lead source"], ["indiamart", "IndiaMART"], ["google-sheets", "Google Sheets"], ["meta-leads", "Meta Lead Ads"],
  ["shopify", "Shopify"], ["woocommerce", "WooCommerce"], ["generic", "Webhook / API"]];
const UNITS: [number, string][] = [[1, "minutes"], [60, "hours"], [60 * 24, "days"]];
const KIND: Record<FollowupStep["kind"], { label: string; Icon: typeof FileText; hint: string }> = {
  template: { label: "Approved template", Icon: FileText, hint: "Works any time, even days later." },
  text: { label: "Message", Icon: MessageSquare, hint: "Only inside WhatsApp's 24-hour window, so set a backup template for later steps." },
  ai: { label: "AI-written follow-up", Icon: Bot, hint: "A fresh, short nudge written from the conversation, never the same wording twice. Inside the 24-hour window only." },
};

function delayLabel(m: number): string {
  if (m === 0) return "right away";
  if (m % 1440 === 0) return `${m / 1440} day${m === 1440 ? "" : "s"}`;
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? "" : "s"}`;
  return `${m} min`;
}

function triggerLabel(s: FollowupSequence): string {
  if (s.trigger === "tag") return `When tag “${s.trigger_value}” is added`;
  if (s.trigger === "new_lead") return `New leads from ${SOURCES.find(([v]) => v === (s.trigger_value ?? ""))?.[1] ?? s.trigger_value}`;
  return "Contacts you add";
}

export default function FollowupsPage() {
  const { toast, confirm } = useUi();
  const [tab, setTab] = useState<"sequences" | "silent">("sequences");
  const [list, setList] = useState<FollowupSequence[] | null>(null);
  const [silent, setSilent] = useState<SilentLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FollowupSequence | "new" | null>(null);
  const [viewing, setViewing] = useState<FollowupSequence | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.list(), api.silent()]);
      setList(l);
      setSilent(s);
    } catch (e) { setError(errorMessage(e, "Couldn't load follow-ups.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const t = { active: 0, replied: 0, finished: 0 };
    for (const s of list ?? []) { t.active += s.counts.active; t.replied += s.counts.replied; t.finished += s.counts.replied + s.counts.completed; }
    return t;
  }, [list]);

  return (
    <Page>
      <PageHeader icon={<BellRing size={20} />} title="Follow-ups"
        subtitle="Nudge leads who went quiet, over hours or days, until they reply. The moment they write back, the sequence stops and your team or AI agent takes over."
        actions={<Button onClick={() => setEditing("new")}><Plus size={15} /> New sequence</Button>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      {list && list.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Leads being followed up" value={totals.active.toLocaleString()} />
          <Stat label="Replied after a follow-up" value={totals.replied.toLocaleString()} sub={totals.finished ? `${Math.round((totals.replied / totals.finished) * 100)}% of finished sequences` : undefined} tone="green" />
          <Stat label="Silent leads to recover" value={(silent?.length ?? 0).toLocaleString()} sub="Finished every step without replying" />
        </div>
      )}

      <Tabs tabs={[{ id: "sequences", label: "Sequences", count: list?.length }, { id: "silent", label: "Silent leads", count: silent?.length }]} value={tab} onChange={setTab} />

      {tab === "sequences" && (!list ? <Spinner /> : list.length === 0 ? (
        <EmptyState icon={<BellRing size={22} />} title="No follow-up sequences yet"
          body="Most sales happen after the 3rd or 4th touch. Example: an AI nudge after 4 hours, a template after 2 days, a last offer after 5 days."
          action={<Button onClick={() => setEditing("new")}><Plus size={15} /> Create your first sequence</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{list.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-white">{s.name}</h3>
                <div className="mt-0.5 text-[12.5px] text-white/50">{triggerLabel(s)}{s.business_hours_only ? " · business hours only" : ""}</div>
              </div>
              <Toggle checked={s.active} label="Sequence on" onChange={async (v) => {
                try { await api.update(s.id, { ...s, active: v }); toast(v ? "Sequence on" : "Sequence paused"); await load(); } catch (e) { toast(errorMessage(e), "error"); }
              }} />
            </div>
            <ol className="mt-4 space-y-1.5">{s.steps.map((st, i) => {
              const K = KIND[st.kind];
              return (
                <li key={i} className="flex items-center gap-2 text-[13px] text-white/75">
                  <span className="w-20 shrink-0 text-[11.5px] text-white/40">{i === 0 ? "" : "then "}{delayLabel(st.delay_minutes)}</span>
                  <K.Icon size={13} className="shrink-0 text-white/50" />
                  <span className="truncate">{st.kind === "template" ? "Template" : st.kind === "ai" ? `AI follow-up${st.instructions ? `: ${st.instructions}` : ""}` : st.text}</span>
                </li>);
            })}</ol>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge tone="blue">{s.counts.active} active</Badge>
              <Badge tone="green">{s.counts.replied} replied</Badge>
              <Badge>{s.counts.completed} no reply</Badge>
              {s.reply_rate !== null && <span className="text-[12px] text-white/45">· {Math.round(s.reply_rate * 100)}% reply rate</span>}
            </div>
            <div className="mt-4 flex gap-1.5 border-t border-white/10 pt-3">
              <Button size="sm" variant="ghost" onClick={() => setViewing(s)}><Users size={13} /> Contacts</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button>
              <Button size="sm" variant="danger" className="ml-auto" aria-label="Delete" onClick={async () => {
                if (await confirm({ title: `Delete “${s.name}”?`, body: "Contacts still in it stop receiving its follow-ups.", confirmLabel: "Delete", danger: true })) {
                  try { await api.remove(s.id); toast("Sequence deleted"); await load(); } catch (e) { toast(errorMessage(e), "error"); }
                }
              }}><Trash2 size={13} /></Button>
            </div>
          </Card>))}</div>
      ))}

      {tab === "silent" && <SilentLeads leads={silent} sequences={list ?? []} onChanged={load} />}

      {editing && <Editor seq={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast("Sequence saved"); void load(); }} />}
      {viewing && <Enrollments seq={viewing} onClose={() => { setViewing(null); void load(); }} />}
    </Page>
  );
}

function SilentLeads({ leads, sequences, onChanged }: { leads: SilentLead[] | null; sequences: FollowupSequence[]; onChanged: () => void }) {
  const { toast } = useUi();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const active = sequences.filter((s) => s.active);
  if (!leads) return <Spinner />;
  if (leads.length === 0) return <EmptyState icon={<RotateCcw size={22} />} title="No silent leads" body="Leads who finish a sequence without replying show up here, so you can try a different message or call them." />;
  const all = picked.size === leads.length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        <span className="text-[13px] text-white/60">{picked.size ? `${picked.size} selected` : "Select leads to restart them in a sequence"}</span>
        <Select className="ml-auto !w-56" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Sequence">
          <option value="">Choose a sequence…</option>{active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Button size="sm" disabled={!picked.size || !target} onClick={async () => {
          try { const r = await api.enroll(target, [...picked]); toast(`${r.enrolled} lead${r.enrolled === 1 ? "" : "s"} restarted`); setPicked(new Set()); onChanged(); } catch (e) { toast(errorMessage(e), "error"); }
        }}><RotateCcw size={13} /> Restart</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11.5px] uppercase tracking-wide text-white/40"><tr>
            <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setPicked(all ? new Set() : new Set(leads.map((l) => l.contact_id)))} /></th>
            <th className="p-3">Lead</th><th className="p-3">Score</th><th className="p-3">Last sequence</th><th className="p-3">Follow-ups sent</th><th className="p-3">Went quiet</th>
          </tr></thead>
          <tbody>{leads.map((l) => (
            <tr key={l.contact_id} className="border-t border-white/[0.06]">
              <td className="p-3"><input type="checkbox" aria-label={`Select ${l.name}`} checked={picked.has(l.contact_id)} onChange={() => { const n = new Set(picked); if (n.has(l.contact_id)) n.delete(l.contact_id); else n.add(l.contact_id); setPicked(n); }} /></td>
              <td className="p-3"><Link href={`/dashboard/contacts?q=${encodeURIComponent(l.phone)}`} className="font-medium text-white hover:underline">{l.name}</Link><div className="text-[12px] text-white/45">+{l.phone}</div></td>
              <td className="p-3"><LeadScoreBadge score={l.lead_score} /></td>
              <td className="p-3 text-white/70">{l.sequence}</td>
              <td className="p-3 text-white/70">{l.followups_sent}</td>
              <td className="p-3 text-white/50">{l.finished_at ? timeAgo(l.finished_at) : ""}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Enrollments({ seq, onClose }: { seq: FollowupSequence; onClose: () => void }) {
  const { toast } = useUi();
  const [status, setStatus] = useState<FollowupStatus | "all">("active");
  const [rows, setRows] = useState<FollowupEnrollment[] | null>(null);
  const load = useCallback(async () => { setRows(null); try { setRows(await api.enrollments(seq.id, status === "all" ? undefined : status)); } catch (e) { toast(errorMessage(e), "error"); setRows([]); } }, [seq.id, status, toast]);
  useEffect(() => { void load(); }, [load]);
  return (
    <Modal open onClose={onClose} title={`Contacts in “${seq.name}”`} width={760}>
      <Tabs tabs={[{ id: "active" as const, label: "In progress", count: seq.counts.active }, { id: "replied" as const, label: "Replied", count: seq.counts.replied },
        { id: "completed" as const, label: "No reply", count: seq.counts.completed }, { id: "all" as const, label: "All", count: seq.enrolled }]} value={status} onChange={setStatus} />
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="py-8 text-center text-[13px] text-white/45">Nobody here yet. Add contacts from the Contacts page with “Add to follow-up”.</p> : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto">{rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-3">
            <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium text-white">{r.name} <LeadScoreBadge score={r.lead_score} className="ml-1" /></div>
              <div className="text-[12px] text-white/45">+{r.phone} · {r.sent} sent · step {Math.min(r.step + 1, seq.steps.length)} of {seq.steps.length}
                {r.next_run_at && r.status === "active" ? ` · next ${fmtDateTime(r.next_run_at)}` : ""}</div>
              {r.log.length > 0 && <div className="mt-1 truncate text-[11.5px] text-white/35">Last: {r.log[r.log.length - 1].event}{r.log[r.log.length - 1].detail ? `: ${r.log[r.log.length - 1].detail}` : ""}</div>}
            </div>
            <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            {r.status === "active" && <Button size="sm" variant="ghost" onClick={async () => { try { await api.stop(r.id); toast("Stopped for this contact"); await load(); } catch (e) { toast(errorMessage(e), "error"); } }}>Stop</Button>}
          </div>))}</div>
      )}
    </Modal>
  );
}

function blankStep(kind: FollowupStep["kind"], delay: number): FollowupStep {
  return { kind, delay_minutes: delay, template_id: null, variables: { body: [] }, text: "", instructions: "", fallback_template_id: null };
}

function Editor({ seq, onClose, onSaved }: { seq: FollowupSequence | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FollowupInput>(() => seq ? { name: seq.name, active: seq.active, trigger: seq.trigger, trigger_value: seq.trigger_value, business_hours_only: seq.business_hours_only, steps: seq.steps }
    : { name: "", active: true, trigger: "manual", trigger_value: null, business_hours_only: false, steps: [blankStep("ai", 240), blankStep("template", 60 * 24 * 2)] });
  const [tpls, setTpls] = useState<Template[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { templatesApi.list({ status: "approved" }).then(setTpls).catch(() => {}); }, []);
  const setStep = (i: number, p: Partial<FollowupStep>) => setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const tplVars = (id?: string | null) => tpls.find((t) => t.id === id)?.requires.body.length ?? 0;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const steps = form.steps.map((s) => {
        const tid = s.kind === "template" ? s.template_id : s.fallback_template_id;
        const n = tplVars(tid);
        return { ...s, variables: { body: Array.from({ length: n }, (_, k) => s.variables?.body?.[k] || "{{first_name}}") } };
      });
      const body = { ...form, steps, trigger_value: form.trigger === "manual" ? null : form.trigger_value ?? "" };
      if (seq) await api.update(seq.id, body); else await api.create(body);
      onSaved();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={seq ? "Edit follow-up sequence" : "New follow-up sequence"} width={780}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!form.name.trim() || form.steps.length === 0} onClick={save}>Save sequence</Button></>}>
      {err && <Alert>{err}</Alert>}
      <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Leads who asked for price but went quiet" autoFocus /></Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Who gets it">
          <Select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value as FollowupInput["trigger"], trigger_value: e.target.value === "tag" ? "hot-lead" : "" })}>
            <option value="manual">Contacts I add (from Contacts or Silent leads)</option>
            <option value="tag">Contacts who get a tag</option>
            <option value="new_lead">Every new lead from an integration</option>
          </Select>
        </Field>
        {form.trigger === "tag" && <Field label="Tag" hint="Tip: the AI adds “hot-lead” to leads it scores hot."><Input value={form.trigger_value ?? ""} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })} placeholder="hot-lead" /></Field>}
        {form.trigger === "new_lead" && <Field label="Lead source"><Select value={form.trigger_value ?? ""} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>}
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-white/70"><Toggle checked={form.business_hours_only} onChange={(v) => setForm({ ...form, business_hours_only: v })} label="Business hours only" /> Only send during business hours (set in Settings)</label>

      <div className="mt-5 mb-2 text-[13px] font-semibold text-white">Steps <span className="font-normal text-white/45">· a reply at any point stops the rest</span></div>
      <div className="space-y-2">{form.steps.map((s, i) => {
        const unit = UNITS.slice().reverse().find(([u]) => s.delay_minutes % u === 0 && s.delay_minutes >= u)?.[0] ?? 1;
        const n = tplVars(s.kind === "template" ? s.template_id : s.fallback_template_id);
        return (
          <div key={i}>
            {i > 0 && <div className="flex justify-center py-1 text-white/30"><ArrowDown size={14} /></div>}
            <div className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-white/55">{i === 0 ? "Wait" : "Then wait"}</span>
                <Input type="number" min={0} className="!w-20" value={s.delay_minutes / unit} onChange={(e) => setStep(i, { delay_minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) * unit })} aria-label="Wait" />
                <Select className="!w-28" value={unit} onChange={(e) => setStep(i, { delay_minutes: (s.delay_minutes / unit) * Number(e.target.value) })} aria-label="Unit">{UNITS.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</Select>
                <span className="text-[12.5px] text-white/55">then send</span>
                <Select className="!w-52" value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as FollowupStep["kind"] })} aria-label="Step type">
                  {(Object.keys(KIND) as FollowupStep["kind"][]).map((k) => <option key={k} value={k}>{KIND[k].label}</option>)}</Select>
                <button className="ml-auto px-1 text-white/40 hover:text-red-300" aria-label="Remove step" onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
              <p className="mt-1.5 text-[11.5px] text-white/40">{KIND[s.kind].hint}</p>
              <div className="mt-2 space-y-2">
                {s.kind === "template" && <TemplatePick tpls={tpls} value={s.template_id} onChange={(v) => setStep(i, { template_id: v })} />}
                {s.kind === "text" && <Textarea value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} placeholder="Hi {{first_name}}, just checking you saw my last message. Any questions I can help with?" />}
                {s.kind === "ai" && <>
                  <Input value={s.instructions} onChange={(e) => setStep(i, { instructions: e.target.value })} placeholder="Optional guidance, e.g. “Offer a free site visit this weekend.”" />
                  <Input value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} placeholder="Backup message if AI isn't available (optional)" />
                </>}
                {s.kind !== "template" && <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-white/55">After 24 hours, send instead: <div className="min-w-[220px] flex-1"><TemplatePick tpls={tpls} value={s.fallback_template_id} onChange={(v) => setStep(i, { fallback_template_id: v })} optional /></div></div>}
                {n > 0 && <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/50">Template values:{Array.from({ length: n }, (_, k) => (
                  <Input key={k} className="!w-40" value={s.variables?.body?.[k] ?? "{{first_name}}"} aria-label={`Value ${k + 1}`}
                    onChange={(e) => { const body = Array.from({ length: n }, (_, j) => s.variables?.body?.[j] ?? "{{first_name}}"); body[k] = e.target.value; setStep(i, { variables: { body } }); }} />))}</div>}
              </div>
            </div>
          </div>);
      })}</div>
      {form.steps.length < 10 && <Button size="sm" variant="ghost" className="mt-3" onClick={() => setForm({ ...form, steps: [...form.steps, blankStep("template", 60 * 24)] })}><Plus size={13} /> Add step</Button>}
      {tpls.length === 0 && <p className="mt-3 text-[12px] text-amber-300/80">No approved templates yet. Create one under Marketing → Templates so steps can reach leads after 24 hours.</p>}
    </Modal>
  );
}

function TemplatePick({ tpls, value, onChange, optional }: { tpls: Template[]; value?: string | null; onChange: (v: string | null) => void; optional?: boolean }) {
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label="Template" className={cx(!value && !optional && "text-white/50")}>
      <option value="">{optional ? "No backup: skip this step" : "Choose an approved template…"}</option>
      {tpls.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
    </Select>
  );
}
