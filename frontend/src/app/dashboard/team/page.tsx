"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Flame, Handshake, ListTodo, MessageCircle, Phone, Smartphone, UsersRound } from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, Page, PageHeader, Select, Spinner, Stat, Toggle, useUi } from "@/components/ui/kit";
import { errorMessage, teamHub, type HubMember, type HubOverview } from "@/lib/api";

const COMMANDS: [string, string][] = [
  ["hi / menu", "Your day at a glance with tap buttons"],
  ["Which leads do I call today?", "Today's tasks, overdue first. Tap one to see the lead"],
  ["hot leads", "Your hot leads, scored by the AI"],
  ["my deals", "Your open deals and their stage"],
  ["find Rahul  /  find 98765", "Look up any lead's details"],
  ["task call Priya tomorrow", "Adds a task (tomorrow 10 AM)"],
  ["Called Rahul, interested, call back Friday 4pm", "Saves the note, closes the task, books the next follow-up*"],
];

function hourLabel(h: number) {
  const s = h % 12 === 0 ? 12 : h % 12;
  return `${s}:00 ${h < 12 ? "AM" : "PM"}`;
}

export default function TeamHubPage() {
  const [data, setData] = useState<HubOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await teamHub.overview()); } catch (e) { setError(errorMessage(e, "Couldn't load your team.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const t = { today: 0, overdue: 0, done_today: 0, hot_leads: 0, connected: 0 };
    for (const m of data?.members ?? []) {
      t.today += m.stats.today; t.overdue += m.stats.overdue; t.done_today += m.stats.done_today; t.hot_leads += m.stats.hot_leads;
      if (m.whatsapp_phone && m.assistant_enabled) t.connected += 1;
    }
    return t;
  }, [data]);

  const business = data?.business_numbers[0];

  return (
    <Page>
      <PageHeader icon={<UsersRound size={20} />} title="Sales Team"
        subtitle="Your salespeople get their calls, leads, deals and tasks on WhatsApp. They message your business number from their own phone, and the assistant answers just for them."
        actions={<Link href="/dashboard/team/tasks"><Button><ListTodo size={15} /> Open tasks</Button></Link>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {!data ? <Spinner /> : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tasks due today" value={totals.today} sub={totals.overdue ? `${totals.overdue} overdue` : "Nothing overdue"} tone={totals.overdue ? "red" : undefined} />
            <Stat label="Done today" value={totals.done_today} tone="green" />
            <Stat label="Hot leads with owners" value={totals.hot_leads} />
            <Stat label="On WhatsApp" value={`${totals.connected}/${data.members.length}`} sub="Team members using the assistant" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              <h2 className="text-[14px] font-semibold text-white">Team members</h2>
              {data.members.map((m) => <MemberCard key={m.user_id} m={m} canEdit={data.can_manage || m.is_you} onSaved={load} />)}
              <p className="text-[12.5px] text-white/45">Add people from <Link href="/dashboard/settings?tab=team" className="underline">Settings → Team</Link>. Assign leads to them by making them the owner of a deal or assigning chats in the inbox.</p>
            </div>

            <div className="space-y-5">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-white"><MessageCircle size={16} className="text-brand" /> How it works</div>
                <ol className="mt-3 space-y-2.5 text-[13px] text-white/70">
                  <li><span className="font-semibold text-white">1.</span> Save each salesperson&apos;s own WhatsApp number on the left.</li>
                  <li><span className="font-semibold text-white">2.</span> They save your business number{business ? <> <span className="font-semibold text-white">+{business.phone.replace(/\D/g, "")}</span></> : ""} in their phone and send <span className="font-semibold text-white">hi</span>.</li>
                  <li><span className="font-semibold text-white">3.</span> They get their tasks, leads and deals with tap buttons, and can mark calls done or add notes right from the chat.</li>
                </ol>
                <p className="mt-3 rounded-lg bg-white/[0.04] p-3 text-[12px] text-white/55">No templates needed and no message cost: the salesperson writes first, so every reply is a free message. Customers never see this; it only answers your team&apos;s numbers.</p>
              </Card>

              <Card className="p-5">
                <div className="text-[14px] font-semibold text-white">What they can type</div>
                <ul className="mt-3 space-y-2.5">{COMMANDS.map(([cmd, what]) => (
                  <li key={cmd} className="text-[13px]"><div className="font-medium text-white">“{cmd}”</div><div className="text-white/50">{what}</div></li>))}</ul>
                <p className="mt-3 text-[11.5px] text-white/40">* Free-form sentences use your AI agent{data.ai_enabled ? " (connected)." : ". Turn it on in Automation → AI Agent; buttons and simple words work without it."}</p>
              </Card>

              <SummaryCard data={data} onSaved={load} />
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

function MemberCard({ m, canEdit, onSaved }: { m: HubMember; canEdit: boolean; onSaved: () => void }) {
  const { toast } = useUi();
  const [phone, setPhone] = useState(m.whatsapp_phone ? `+${m.whatsapp_phone}` : "");
  const [saving, setSaving] = useState(false);
  const dirty = phone.replace(/\D/g, "") !== (m.whatsapp_phone ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const r = await teamHub.setMember(m.user_id, { whatsapp_phone: phone.trim() || null });
      setPhone(r.whatsapp_phone ? `+${r.whatsapp_phone}` : "");
      toast(r.whatsapp_phone ? "WhatsApp number saved" : "Number removed");
      onSaved();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setSaving(false); }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[14px] font-semibold text-brand">{m.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-white">{m.name}</span>
            {m.is_you && <Badge tone="blue">You</Badge>}
            <Badge>{m.role}</Badge>
            {m.whatsapp_phone && m.assistant_enabled ? <Badge tone="green">On WhatsApp</Badge> : <Badge tone="yellow">Not set up</Badge>}
          </div>
          <div className="text-[12.5px] text-white/45">{m.email}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-white/65">
            <span className="inline-flex items-center gap-1"><Phone size={12} /> {m.stats.today} today</span>
            {m.stats.overdue > 0 && <span className="inline-flex items-center gap-1 text-red-400"><AlertTriangle size={12} /> {m.stats.overdue} overdue</span>}
            <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {m.stats.done_today} done</span>
            <span className="inline-flex items-center gap-1"><Flame size={12} /> {m.stats.hot_leads} hot</span>
            <span className="inline-flex items-center gap-1"><Handshake size={12} /> {m.stats.open_deals} deals</span>
          </div>
        </div>
        <Link href={`/dashboard/team/tasks?user=${m.user_id}`} className="text-[12.5px] font-medium text-brand hover:underline">View tasks</Link>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
        <Field label="Their WhatsApp number" className="min-w-[220px] flex-1">
          <div className="relative">
            <Smartphone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <Input className="!pl-9" placeholder="+91 98765 43210" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </Field>
        {canEdit && <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>Save</Button>}
        {canEdit && m.whatsapp_phone && (
          <div className="flex items-center gap-2 pb-1.5 text-[12.5px] text-white/60">
            <Toggle checked={m.assistant_enabled} label="Assistant on" onChange={async (v) => {
              try { await teamHub.setMember(m.user_id, { assistant_enabled: v }); toast(v ? "Assistant on" : "Assistant paused"); onSaved(); } catch (e) { toast(errorMessage(e), "error"); }
            }} /> Assistant
          </div>
        )}
      </div>
    </Card>
  );
}

function SummaryCard({ data, onSaved }: { data: HubOverview; onSaved: () => void }) {
  const { toast } = useUi();
  const [on, setOn] = useState(data.settings.daily_summary);
  const [hour, setHour] = useState(data.settings.summary_hour);
  const save = async (next: { daily_summary: boolean; summary_hour: number }) => {
    try { await teamHub.setSettings(next); toast("Saved"); onSaved(); } catch (e) { toast(errorMessage(e), "error"); }
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[14px] font-semibold text-white">Morning task list</div>
        <Toggle checked={on} disabled={!data.can_manage} label="Morning task list" onChange={(v) => { setOn(v); void save({ daily_summary: v, summary_hour: hour }); }} />
      </div>
      <p className="mt-1.5 text-[12.5px] text-white/55">Each salesperson gets their day&apos;s tasks on WhatsApp. To keep it free (no template), it goes to people who messaged the assistant in the last 24 hours, so ask the team to say hi at the end of each day.</p>
      <Field label="Send at" className="mt-3">
        <Select value={hour} disabled={!data.can_manage || !on} onChange={(e) => { const h = Number(e.target.value); setHour(h); void save({ daily_summary: on, summary_hour: h }); }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </Select>
      </Field>
      <p className="mt-2 text-[11.5px] text-white/40">Time zone: {data.timezone}</p>
    </Card>
  );
}
