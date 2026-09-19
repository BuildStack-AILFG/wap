"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Plug, RefreshCw, ShoppingCart, Webhook, Workflow } from "lucide-react";
import { Alert, Badge, Button, Card, CopyField, Field, Input, Modal, Page, PageHeader, Select, Spinner, Tabs, Toggle, timeAgo, useUi } from "@/components/ui/kit";
import { errorMessage, integrations as api, templates as tplApi, whatsapp, type AdapterMeta, type IntegrationRow, type Template } from "@/lib/api";
import { INTEGRATIONS } from "@/components/dashboard/integrationsConfig";

type Item = { id: string; name: string; description: string; category: string; Icon?: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>; color?: string; kind: string; how: string };
const BASE: Record<string, { kind: string; how: string }> = {
  shopify: { kind: "shopify", how: "Order events → WhatsApp templates" }, razorpay: { kind: "razorpay", how: "Payment events → WhatsApp templates" }, stripe: { kind: "stripe", how: "Payment events → WhatsApp templates" },
  slack: { kind: "slack", how: "Team notifications in Slack" }, zapier: { kind: "generic", how: "Signed webhook + API key" }, "google-sheets": { kind: "generic", how: "Via Zapier, Make or Apps Script" },
  calendly: { kind: "generic", how: "Booking events via webhook" }, "google-calendar": { kind: "generic", how: "Via Zapier or Make" },
};
const EXTRA: Item[] = [
  { id: "woocommerce", name: "WooCommerce", description: "Send order confirmations and status updates from your WordPress store.", category: "commerce", kind: "woocommerce", how: "Order events → WhatsApp templates" },
  { id: "make", name: "Make (Integromat)", description: "Trigger WhatsApp messages from 1,500+ apps, or push WhatsApp events into them.", category: "automation", kind: "generic", how: "Signed webhook + API key" },
  { id: "n8n", name: "n8n", description: "Self-hosted automation: call our API and receive signed events.", category: "automation", kind: "generic", how: "Signed webhook + API key" },
  { id: "pabbly", name: "Pabbly Connect", description: "Connect Pabbly workflows to WhatsApp.", category: "automation", kind: "generic", how: "Signed webhook + API key" },
  { id: "typeform", name: "Typeform / forms", description: "Send a WhatsApp message when someone submits a form.", category: "productivity", kind: "generic", how: "Webhook → contact + event" },
  { id: "webhook", name: "Custom webhook", description: "POST JSON from your own backend to create contacts and fire events.", category: "automation", kind: "generic", how: "Signed webhook + API key" },
];

export default function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[] | null>(null);
  const [adapters, setAdapters] = useState<Record<string, AdapterMeta>>({});
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => { try { setRows(await api.list()); } catch (e) { setError(errorMessage(e, "Couldn't load integrations.")); } }, []);
  useEffect(() => { void load(); api.adapters().then(setAdapters).catch(() => {}); whatsapp.list().then((a) => setWaConnected(a.some((x) => x.status === "connected"))).catch(() => setWaConnected(false)); }, [load]);

  const items: Item[] = useMemo(() => [
    ...INTEGRATIONS.filter((i) => BASE[i.id]).map((i) => ({ id: i.id, name: i.name, description: i.description, category: i.category, Icon: i.icon, color: i.iconColor, ...BASE[i.id] })),
    ...EXTRA,
  ], []);
  const shown = items.filter((i) => cat === "all" || i.category === cat);
  const byProvider = new Map((rows ?? []).map((r) => [r.provider, r]));
  const connectedCount = rows?.filter((r) => r.status === "connected").length ?? 0;

  return (
    <Page wide>
      <PageHeader icon={<Plug size={20} />} title="Integrations" subtitle="Connect your stores, payments, and automation tools. Events flow in as signed webhooks; WhatsApp messages go out from your templates and flows." />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.filter((i) => i.id === "whatsapp" || i.id === "meta").map((i) => (
          <Card key={i.id} className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06]"><i.icon size={26} style={{ color: i.iconColor }} /></div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[15px] font-semibold text-white">{i.name}{waConnected !== null && <Badge tone={waConnected ? "green" : "yellow"}>{waConnected ? "connected" : "not connected"}</Badge>}</div>
              <p className="mt-0.5 text-[12.5px] text-white/50">{i.id === "meta" ? "Click-to-WhatsApp ad leads are captured automatically — the ad and headline appear on the contact." : i.description}</p></div>
            <Link href="/dashboard/whatsapp"><Button variant="ghost" size="sm">{waConnected ? "Manage" : "Connect"} <ChevronRight size={14} /></Button></Link>
          </Card>))}
      </div>

      <div className="mb-2 flex items-center justify-between"><Tabs tabs={[{ id: "all", label: "All" }, { id: "commerce", label: "Commerce" }, { id: "payments", label: "Payments" }, { id: "productivity", label: "Productivity" }, { id: "automation", label: "Automation" }]} value={cat} onChange={setCat} />
        <span className="mb-5 text-[12.5px] text-white/40">{connectedCount} connected</span></div>

      {!rows ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((i) => {
          const r = byProvider.get(i.id);
          return (
            <Card key={i.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">{i.Icon ? <i.Icon size={24} style={{ color: i.color }} /> : i.kind === "woocommerce" ? <ShoppingCart size={22} className="text-purple-300" /> : i.id === "webhook" ? <Webhook size={22} className="text-white/70" /> : <Workflow size={22} className="text-white/70" />}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[14.5px] font-semibold text-white">{i.name}</span>{r && <Badge tone={r.status === "connected" ? "green" : "red"}>{r.status === "connected" ? <><CheckCircle2 size={10} /> connected</> : r.status}</Badge>}</div>
                  <div className="text-[11.5px] text-white/35">{i.how}</div></div></div>
              <p className="mt-3 flex-1 text-[12.5px] text-white/50">{i.description}</p>
              {r?.last_event_at && <div className="mt-2 text-[11.5px] text-emerald-300/80">Last event {timeAgo(r.last_event_at)}</div>}
              {r?.last_error && <div className="mt-2 text-[11.5px] text-red-300">{r.last_error}</div>}
              <Button className="mt-4" variant={r ? "ghost" : "primary"} onClick={() => setOpen(i)}>{r ? "Configure" : "Connect"}</Button>
            </Card>);
        })}</div>
      )}
      <p className="mt-6 text-[12.5px] text-white/40">Need something else? Use <Link href="/dashboard/settings?tab=developer" className="text-sky-300 underline">API keys and webhooks</Link> to integrate anything that can make an HTTP request.</p>
      {open && <Connect item={open} meta={adapters[open.kind] ?? adapters.generic} row={byProvider.get(open.id)} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

function Connect({ item, meta, row, onClose, onChanged }: { item: Item; meta?: AdapterMeta; row?: IntegrationRow; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const isSlack = item.kind === "slack";
  const isAdapter = meta?.mode === "events";
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(row?.config.events ?? meta?.events ?? []);
  const [actions, setActions] = useState<Record<string, { template_id: string; body: string }>>(() => Object.fromEntries(Object.entries((row?.config.actions ?? {}) as Record<string, { template_id: string; body?: string[] }>).map(([k, v]) => [k, { template_id: v.template_id, body: (v.body ?? []).join(" | ") }])));
  const [tpls, setTpls] = useState<Template[]>([]);
  const [current, setCurrent] = useState<IntegrationRow | undefined>(row);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (isAdapter) tplApi.list({ status: "approved" }).then(setTpls).catch(() => {}); }, [isAdapter]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body: Parameters<typeof api.save>[1] = {};
      if (secret) body.secret = secret;
      if (isSlack) body.events = events;
      else body.actions = Object.fromEntries(Object.entries(actions).filter(([, a]) => a.template_id).map(([k, a]) => [k, { type: "send_template", template_id: a.template_id, body: a.body.split("|").map((s) => s.trim()).filter(Boolean) }]));
      const saved = await api.save(item.id, body);
      setCurrent(saved); setSecret(""); onChanged(); toast(row ? "Integration updated" : "Integration connected");
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${item.name}`} width={680}
      footer={<>{current && <Button variant="danger" className="mr-auto" onClick={async () => { if (await confirm({ title: `Disconnect ${item.name}?`, body: "Its webhook URL stops working immediately.", confirmLabel: "Disconnect", danger: true })) { try { await api.remove(item.id); onChanged(); onClose(); toast("Disconnected"); } catch (e) { setErr(errorMessage(e)); } } }}>Disconnect</Button>}
        <Button variant="ghost" onClick={onClose}>Close</Button><Button loading={busy} onClick={save} disabled={isSlack ? !current && !secret : isAdapter && !current?.has_secret && !secret}>{current ? "Save changes" : "Connect"}</Button></>}>
      {err && <Alert>{err}</Alert>}
      {meta && <ol className="mb-4 list-decimal space-y-1 pl-5 text-[12.5px] text-white/55">{meta.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}

      {!isSlack && current?.hook_url && (
        <div className="mb-4 space-y-2"><CopyField label="Webhook URL (paste this in the other tool)" value={current.hook_url} />
          <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Generate a new URL?", body: "The old URL stops working — update it in the other tool.", confirmLabel: "Regenerate" })) { try { setCurrent(await api.rotate(item.id)); onChanged(); } catch (e) { setErr(errorMessage(e)); } } }}><RefreshCw size={12} /> Regenerate URL</Button></div>
      )}
      {!isSlack && !current && <Alert tone="blue">Connect first to get your unique webhook URL.</Alert>}

      <Field label={meta?.secret_label ?? "Secret"} hint={current?.has_secret ? "A secret is saved (encrypted). Enter a new one to replace it." : isAdapter ? "Required — requests without a valid signature are rejected." : undefined}>
        <Input type={isSlack ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={current?.has_secret ? "••••••••" : isSlack ? "https://hooks.slack.com/services/…" : ""} autoComplete="off" /></Field>

      {isSlack && meta && (
        <div className="mt-4"><div className="mb-2 text-[12.5px] font-medium text-white/70">Post to Slack when…</div>
          <div className="space-y-2">{meta.events.map((e) => <label key={e} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-white/80">{e.replace(/_/g, " ")}<Toggle checked={events.includes(e)} onChange={(v) => setEvents(v ? [...events, e] : events.filter((x) => x !== e))} label={e} /></label>)}</div>
          {current && <Button size="sm" variant="ghost" className="mt-3" onClick={async () => { try { await api.slackTest(); toast("Test message sent to Slack"); } catch (e) { setErr(errorMessage(e)); } }}>Send test message</Button>}</div>
      )}

      {isAdapter && meta && (
        <div className="mt-5"><div className="mb-1 text-[13.5px] font-semibold text-white">Send a WhatsApp template when…</div>
          <p className="mb-3 text-[12px] text-white/45">Pick a template per event. Variables use the customer and order data: <code>{"{{name}}"}</code> <code>{"{{var.order_number}}"}</code> <code>{"{{var.total}}"}</code> — separate multiple values with <b>|</b>.</p>
          <div className="space-y-3">{meta.events.map((e) => { const a = actions[e] ?? { template_id: "", body: "" }; const t = tpls.find((x) => x.id === a.template_id);
            return <div key={e} className="rounded-xl border border-white/10 p-3"><div className="mb-2 text-[13px] font-medium text-white">{e.replace(/_/g, " ")}</div>
              <Select value={a.template_id} onChange={(ev) => setActions({ ...actions, [e]: { ...a, template_id: ev.target.value } })} aria-label={`Template for ${e}`}><option value="">Don&apos;t send anything</option>{tpls.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
              {t && t.requires.body.length > 0 && <Input className="mt-2" value={a.body} onChange={(ev) => setActions({ ...actions, [e]: { ...a, body: ev.target.value } })} placeholder={`${t.requires.body.length} value(s): {{name}} | {{var.order_number}}`} />}</div>; })}</div>
          {tpls.length === 0 && <p className="mt-2 text-[12px] text-amber-300/80">No approved templates yet — create one in Templates to send messages from events. Events are still recorded and can start flows.</p>}
        </div>
      )}
    </Modal>
  );
}
