"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ListTodo, Pencil, Plus, Search, Smartphone, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Spinner, Tabs, Textarea, cx, useDebounced, useUi } from "@/components/ui/kit";
import LeadScoreBadge from "@/components/dashboard/LeadScoreBadge";
import { contacts as contactsApi, errorMessage, teamHub, type Contact, type HubMember, type SalesTask, type TaskInput, type TaskKind } from "@/lib/api";

type Scope = "today" | "overdue" | "upcoming" | "open" | "done";
const KINDS: [TaskKind, string][] = [["call", "Call"], ["follow_up", "Follow up"], ["meeting", "Meeting"], ["other", "Other"]];
const kindLabel = (k: TaskKind) => KINDS.find(([v]) => v === k)?.[1] ?? "Task";

function dueText(iso: string | null): { text: string; late: boolean } {
  if (!iso) return { text: "No time", late: false };
  const d = new Date(iso), now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86400000);
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : d.toLocaleDateString([], { day: "numeric", month: "short" });
  return { text: `${label}, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, late: d < now };
}

/** ISO -> value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TasksPage() {
  const { toast, confirm } = useUi();
  const [members, setMembers] = useState<HubMember[]>([]);
  const [user, setUser] = useState("");
  const [scope, setScope] = useState<Scope>("today");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [items, setItems] = useState<SalesTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SalesTask | "new" | null>(null);

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("user");
    if (u) setUser(u);
    teamHub.overview().then((o) => setMembers(o.members)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const status = scope === "done" ? "done" : "open";
      const s = scope === "open" || scope === "done" ? "all" : scope;
      setItems((await teamHub.tasks({ user_id: user || undefined, status, scope: s, q: dq || undefined })).items);
    } catch (e) { setError(errorMessage(e, "Couldn't load tasks.")); setItems([]); }
  }, [user, scope, dq]);
  useEffect(() => { setItems(null); void load(); }, [load]);

  const toggleDone = async (t: SalesTask) => {
    try { await teamHub.updateTask(t.id, { status: t.status === "done" ? "open" : "done" }); toast(t.status === "done" ? "Reopened" : "Marked done"); await load(); }
    catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <Page>
      <PageHeader icon={<ListTodo size={20} />} title="Tasks"
        subtitle="Calls, follow-ups and meetings for your sales team. Salespeople see the same list on WhatsApp and can tick tasks off from there."
        actions={<Button onClick={() => setEditing("new")}><Plus size={15} /> New task</Button>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="!w-52" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Team member">
          <option value="">Everyone</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.is_you ? " (you)" : ""}</option>)}
        </Select>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <Input className="!pl-9" placeholder="Search task or lead" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Tabs tabs={[{ id: "today" as const, label: "Today" }, { id: "overdue" as const, label: "Overdue" }, { id: "upcoming" as const, label: "Upcoming" },
        { id: "open" as const, label: "All open" }, { id: "done" as const, label: "Done" }]} value={scope} onChange={setScope} />

      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<CalendarClock size={22} />} title={scope === "done" ? "Nothing done yet" : scope === "overdue" ? "Nothing overdue" : "No tasks here"}
          body="Create tasks here, or salespeople can add them on WhatsApp by typing “task call Priya tomorrow”."
          action={<Button onClick={() => setEditing("new")}><Plus size={15} /> New task</Button>} />
      ) : (
        <Card className="divide-y divide-white/[0.06] overflow-hidden">{items.map((t) => {
          const due = dueText(t.due_at);
          return (
            <div key={t.id} className="flex flex-wrap items-start gap-3 p-4">
              <button type="button" aria-label={t.status === "done" ? "Reopen" : "Mark done"} onClick={() => toggleDone(t)}
                className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  t.status === "done" ? "border-brand bg-brand text-white" : "border-white/25 hover:border-brand")}>
                {t.status === "done" && <Check size={13} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cx("text-[14px] font-medium", t.status === "done" ? "text-white/45 line-through" : "text-white")}>{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/55">
                  <Badge>{kindLabel(t.kind)}</Badge>
                  {t.status === "done" ? <span>Done {t.done_at ? dueText(t.done_at).text : ""}</span> : <span className={due.late ? "font-medium text-red-400" : ""}>{due.text}</span>}
                  {t.contact && <Link href={`/dashboard/contacts?q=${encodeURIComponent(t.contact.phone)}`} className="hover:underline">{t.contact.name} · +{t.contact.phone}</Link>}
                  {t.contact?.lead_score && <LeadScoreBadge score={t.contact.lead_score} />}
                  {t.user_name && <span>👤 {t.user_name}</span>}
                  {t.source === "whatsapp" && <span className="inline-flex items-center gap-1"><Smartphone size={12} /> via WhatsApp</span>}
                </div>
                {t.notes && <p className="mt-1.5 whitespace-pre-line text-[12.5px] text-white/50">{t.notes}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(t)}><Pencil size={13} /></Button>
                <Button size="sm" variant="danger" aria-label="Delete" onClick={async () => {
                  if (await confirm({ title: "Delete this task?", body: t.title, confirmLabel: "Delete", danger: true })) {
                    try { await teamHub.removeTask(t.id); toast("Task deleted"); await load(); } catch (e) { toast(errorMessage(e), "error"); }
                  }
                }}><Trash2 size={13} /></Button>
              </div>
            </div>);
        })}</Card>
      )}

      {editing && <TaskEditor task={editing === "new" ? null : editing} members={members} defaultUser={user}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast("Task saved"); void load(); }} />}
    </Page>
  );
}

function TaskEditor({ task, members, defaultUser, onClose, onSaved }: { task: SalesTask | null; members: HubMember[]; defaultUser: string; onClose: () => void; onSaved: () => void }) {
  const me = members.find((m) => m.is_you)?.user_id ?? "";
  const [form, setForm] = useState<TaskInput>(() => task
    ? { title: task.title, kind: task.kind, user_id: task.user_id, contact_id: task.contact?.id ?? null, due_at: task.due_at, notes: task.notes }
    : { title: "", kind: "call", user_id: defaultUser || me || null, contact_id: null, due_at: new Date(Date.now() + 3600_000).toISOString(), notes: "" });
  const [lead, setLead] = useState<{ id: string; name: string; phone: string } | null>(task?.contact ?? null);
  const [search, setSearch] = useState("");
  const ds = useDebounced(search, 300);
  const [found, setFound] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ds.trim().length < 2) { setFound([]); return; }
    contactsApi.list({ q: ds.trim(), limit: 6 }).then((r) => setFound(r.items)).catch(() => setFound([]));
  }, [ds]);

  const save = async () => {
    if (!form.title.trim()) { setErr("Give the task a title."); return; }
    setSaving(true); setErr(null);
    try {
      const body = { ...form, user_id: form.user_id || null, contact_id: lead?.id ?? null, notes: form.notes || null };
      if (task) await teamHub.updateTask(task.id, body); else await teamHub.createTask(body);
      onSaved();
    } catch (e) { setErr(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={task ? "Edit task" : "New task"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save task</Button></>}>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      <div className="space-y-4">
        <Field label="What to do"><Input autoFocus placeholder="Call about Growth plan pricing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TaskKind })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Assigned to"><Select value={form.user_id ?? ""} onChange={(e) => setForm({ ...form, user_id: e.target.value || null })}>
            <option value="">Nobody</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}{m.is_you ? " (you)" : ""}</option>)}</Select></Field>
        </div>
        <Field label="Due">
          <Input type="datetime-local" value={toLocalInput(form.due_at ?? null)} onChange={(e) => setForm({ ...form, due_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </Field>
        <Field label="Lead (optional)" hint="Their details, score, deal and last message show up on WhatsApp with the task.">
          {lead ? (
            <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-[13px] text-white">
              <span>{lead.name} · +{lead.phone}</span>
              <button type="button" className="text-[12px] text-white/50 hover:text-white" onClick={() => setLead(null)}>Change</button>
            </div>
          ) : (
            <div>
              <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              {found.length > 0 && <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-white/10">{found.map((c) => (
                <button key={c.id} type="button" onClick={() => { setLead({ id: c.id, name: c.name, phone: c.phone }); setSearch(""); setFound([]); if (!form.title.trim()) setForm({ ...form, title: `Call ${c.name}` }); }}
                  className="block w-full px-3 py-2 text-left text-[13px] text-white/80 hover:bg-white/[0.06]">{c.name} <span className="text-white/45">· +{c.phone}</span></button>))}</div>}
            </div>
          )}
        </Field>
        <Field label="Notes"><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
