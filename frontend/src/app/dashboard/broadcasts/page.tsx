"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ban, Clock, Download, Megaphone, Plus, RefreshCw, Send, Trash2, Upload } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Field, fmtDateTime, Input, Modal, Page, PageHeader, Select, Spinner, statusTone, timeAgo, usePoll, useUi } from "@/components/ui/kit";
import { broadcasts as api, contacts as contactsApi, errorMessage, segments as segApi, templates as tplApi, type Audience, type Broadcast, type Recipient, type Segment, type Template } from "@/lib/api";

export default function BroadcastsPage() {
  return <Suspense fallback={<Spinner />}><Broadcasts /></Suspense>;
}

function Broadcasts() {
  const params = useSearchParams();
  const [list, setList] = useState<Broadcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => { try { setList(await api.list()); setError(null); } catch (e) { setError(errorMessage(e, "Couldn't load campaigns.")); } }, []);
  usePoll(load, 6000);
  const live = list?.some((b) => b.status === "sending");

  return (
    <Page wide>
      <PageHeader icon={<Megaphone size={20} />} title="Broadcasts" subtitle="Send an approved template to a group of contacts now or later, and watch delivery, reads and replies come in live."
        actions={<><Link href="/dashboard/campaign-reports"><Button variant="ghost">Reports</Button></Link><Button onClick={() => setCreating(true)}><Plus size={15} /> New campaign</Button></>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {live && <Alert tone="blue">A campaign is sending right now — numbers below update every few seconds.</Alert>}

      {!list ? <Spinner /> : list.length === 0 ? (
        <EmptyState icon={<Megaphone size={22} />} title="No campaigns yet" body="Create your first broadcast: pick an approved template, choose who gets it, and send or schedule." action={<Button onClick={() => setCreating(true)}><Plus size={15} /> New campaign</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-white/10 text-[11.5px] uppercase tracking-wide text-white/40"><tr><th className="px-5 py-3">Campaign</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Recipients</th><th className="hidden px-2 py-3 md:table-cell">Delivered</th><th className="hidden px-2 py-3 md:table-cell">Read</th><th className="hidden px-2 py-3 lg:table-cell">Replied</th><th className="px-2 py-3">Failed</th><th className="px-5 py-3 text-right">When</th></tr></thead>
            <tbody>{list.map((b) => (
              <tr key={b.id} onClick={() => setOpenId(b.id)} className="cursor-pointer border-b border-white/5 hover:bg-white/[0.04]">
                <td className="px-5 py-3"><div className="font-medium text-white">{b.name}</div><div className="text-[11.5px] text-white/40">{b.template_name}</div></td>
                <td className="px-2 py-3"><Badge tone={statusTone(b.status)}>{b.status === "scheduled" && <Clock size={10} />}{b.status}</Badge></td>
                <td className="px-2 py-3 text-white/80">{b.total_recipients.toLocaleString()}</td>
                <td className="hidden px-2 py-3 text-white/70 md:table-cell">{b.delivered_pct}%</td>
                <td className="hidden px-2 py-3 text-white/70 md:table-cell">{b.read_pct}%</td>
                <td className="hidden px-2 py-3 text-white/70 lg:table-cell">{b.replied_pct}%</td>
                <td className="px-2 py-3">{b.failed > 0 ? <span className="text-red-300">{b.failed}</span> : <span className="text-white/35">0</span>}</td>
                <td className="px-5 py-3 text-right text-white/45">{b.status === "scheduled" ? fmtDateTime(b.scheduled_at) : timeAgo(b.created_at)}</td>
              </tr>))}</tbody>
          </table>
        </Card>
      )}

      {creating && <Wizard onClose={() => setCreating(false)} onCreated={(b) => { setCreating(false); setOpenId(b.id); void load(); }} />}
      <Detail id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </Page>
  );
}

// ---- detail -----------------------------------------------------------------------------------------------------------------------------------------------

function Detail({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { toast, confirm } = useUi();
  const [b, setB] = useState<Broadcast | null>(null);
  const [recs, setRecs] = useState<{ total: number; items: Recipient[] } | null>(null);
  const [tab, setTab] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try { const [x, r] = await Promise.all([api.get(id), api.recipients(id, { status: tab || undefined, limit: 50 })]); setB(x); setRecs(r); } catch (e) { setErr(errorMessage(e)); }
  }, [id, tab]);
  useEffect(() => { setB(null); setRecs(null); setErr(null); setTab(""); }, [id]);
  usePoll(load, 4000, [id, tab]);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); await load(); onChanged(); } catch (e) { setErr(errorMessage(e)); } };

  const funnel = b ? [["Sent", b.sent, b.total_recipients], ["Delivered", b.delivered, b.total_recipients], ["Read", b.read, b.total_recipients], ["Replied", b.replied, b.total_recipients]] as const : [];
  return (
    <Modal open={!!id} onClose={onClose} title={b?.name ?? "Campaign"} width={780}
      footer={b ? <>
        {["draft", "scheduled"].includes(b.status) && <Button onClick={() => act(() => api.start(b.id), "Sending started")}><Send size={14} /> Send now</Button>}
        {["draft", "scheduled", "sending"].includes(b.status) && <Button variant="danger" onClick={async () => { if (await confirm({ title: "Cancel this campaign?", body: "Messages already sent can't be recalled; the rest won't be sent.", confirmLabel: "Cancel campaign", danger: true })) void act(() => api.cancel(b.id), "Campaign cancelled"); }}><Ban size={14} /> Cancel</Button>}
        {["completed", "failed"].includes(b.status) && b.failed > 0 && <Button variant="ghost" onClick={() => act(async () => { const r = await api.retry(b.id); toast(`Retrying ${r.retrying} recipients`); }, "Retry started")}><RefreshCw size={14} /> Retry {b.failed} failed</Button>}
        <Button variant="ghost" onClick={() => api.exportCsv(b.id).catch((e) => setErr(errorMessage(e)))}><Download size={14} /> Export</Button>
        {b.status !== "sending" && <Button variant="danger" onClick={async () => { if (await confirm({ title: "Delete this campaign?", body: "Its report is removed. Sent messages stay in conversations.", confirmLabel: "Delete", danger: true })) { try { await api.remove(b.id); onChanged(); onClose(); } catch (e) { setErr(errorMessage(e)); } } }}><Trash2 size={14} /></Button>}
      </> : undefined}>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {!b ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(b.status)}>{b.status}</Badge><span className="text-[12.5px] text-white/50">Template <b className="text-white/80">{b.template_name}</b> · {b.total_recipients.toLocaleString()} recipients</span>
            {b.status === "scheduled" && <span className="text-[12.5px] text-amber-300">Sends {fmtDateTime(b.scheduled_at)}</span>}</div>
          {b.error && <Alert tone={b.status === "failed" ? "red" : "yellow"}>{b.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-4">{funnel.map(([l, n, t]) => (
            <div key={l} className="rounded-xl bg-white/[0.04] p-3"><div className="text-[12px] text-white/45">{l}</div><div className="text-[22px] font-semibold text-white">{n.toLocaleString()}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${t ? (n / t) * 100 : 0}%`, background: "#00926B" }} /></div>
              <div className="mt-1 text-[11px] text-white/35">{t ? Math.round((n / t) * 100) : 0}%</div></div>))}</div>
          {b.failed > 0 && <div className="text-[13px] text-red-300">{b.failed} failed</div>}
          <div>
            <div className="mb-2 flex flex-wrap gap-1">{["", "sent", "delivered", "read", "failed", "skipped", "pending"].map((s) => <button key={s} onClick={() => setTab(s)} className={`rounded-full px-3 py-1 text-[12px] ${tab === s ? "bg-white/15 text-white" : "text-white/45 hover:text-white/75"}`}>{s || "All"}</button>)}</div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10">
              {!recs ? <Spinner /> : recs.items.length === 0 ? <div className="px-4 py-8 text-center text-[13px] text-white/40">No recipients in this view.</div> : recs.items.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2 text-[12.5px]"><span className="text-white/80">+{r.phone}</span>
                  <span className="min-w-0 flex-1 truncate text-red-300/80">{r.error}</span>{r.replied && <Badge tone="blue">replied</Badge>}<Badge tone={statusTone(r.status)}>{r.status}</Badge></div>))}
            </div>
            {recs && recs.total > recs.items.length && <div className="mt-1 text-[11.5px] text-white/35">Showing first {recs.items.length} of {recs.total.toLocaleString()} — export for the full list.</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---- wizard --------------------------------------------------------------------------------------------------------------------------------------------------

type Mapping = { body: Record<string, { source: string; value?: string }>; header_text?: { source: string; value?: string }; header_media?: string; buttons: Record<string, { source: string; value?: string }>; fallback: string };
const SOURCES: [string, string][] = [["first_name", "First name"], ["name", "Full name"], ["phone", "Phone"], ["email", "Email"], ["fixed", "Fixed text…"]];

function Wizard({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Broadcast) => void }) {
  const [step, setStep] = useState(0);
  const [tpls, setTpls] = useState<Template[] | null>(null);
  const [segs, setSegs] = useState<Segment[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [traits, setTraits] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [tplId, setTplId] = useState("");
  const [aud, setAud] = useState<Audience>({ type: "all_contacts" });
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvCols, setCsvCols] = useState<string[]>([]);
  const [count, setCount] = useState<{ count: number; skipped: number } | null>(null);
  const [map, setMap] = useState<Mapping>({ body: {}, buttons: {}, fallback: "there" });
  const [when, setWhen] = useState<"now" | "later" | "draft">("now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [minAt] = useState(() => new Date(Date.now() + 60000).toISOString().slice(0, 16));
  const fileRef = useRef<HTMLInputElement>(null);
  const tpl = tpls?.find((t) => t.id === tplId);

  useEffect(() => {
    tplApi.list({ status: "approved" }).then(setTpls).catch((e) => setErr(errorMessage(e)));
    segApi.list().then(setSegs).catch(() => {});
    contactsApi.tags().then(setTags).catch(() => {});
    contactsApi.traits().then(setTraits).catch(() => {});
  }, []);
  useEffect(() => {
    if (!tpl) return;
    setMap((m) => ({ ...m, body: Object.fromEntries(tpl.requires.body.map((n) => [String(n), m.body[String(n)] ?? { source: n === 1 ? "first_name" : "fixed", value: "" }])) }));
  }, [tpl]);
  const audKey = JSON.stringify(aud) + csvRows.length;
  useEffect(() => {
    setCount(null);
    if ((aud.type === "tag" && !aud.tag) || (aud.type === "segment" && !aud.segment_id) || (aud.type === "csv" && csvRows.length === 0)) return;
    const t = setTimeout(() => api.preview({ ...aud, rows: aud.type === "csv" ? csvRows : undefined }).then(setCount).catch((e) => setErr(errorMessage(e))), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audKey]);

  const onCsv = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    const sep = lines[0]?.includes(";") && !lines[0].includes(",") ? ";" : ",";
    const head = lines[0]?.split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")) ?? [];
    const pi = head.findIndex((h) => ["phone", "mobile", "phone_number", "whatsapp", "number"].includes(h));
    if (pi < 0) { setErr("The CSV needs a phone column (phone, mobile, whatsapp or number)."); return; }
    const rows = lines.slice(1).map((l) => { const c = l.split(sep); const r: Record<string, string> = {}; head.forEach((h, i) => (r[i === pi ? "phone" : h] = (c[i] ?? "").trim())); return r; });
    setCsvRows(rows.slice(0, 20000)); setCsvCols(head.filter((_, i) => i !== pi)); setErr(null);
  };

  const missingVars = useMemo(() => tpl ? tpl.requires.body.some((n) => { const m = map.body[String(n)]; return !m || (m.source === "fixed" && !m.value?.trim()); }) || (!!tpl.requires.header_media && !map.header_media) : true, [tpl, map]);
  const canNext = step === 0 ? !!name.trim() && !!tpl : step === 1 ? !!count && count.count > 0 : step === 2 ? !missingVars : when !== "later" || !!at;

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const vm: Record<string, unknown> = { body: map.body, buttons: map.buttons, fallback: map.fallback, ...(map.header_text ? { header_text: map.header_text } : {}), ...(map.header_media ? { header_media: map.header_media } : {}) };
      onCreated(await api.create({ name: name.trim(), template_id: tplId, audience: { ...aud, rows: aud.type === "csv" ? csvRows : undefined }, variable_mapping: vm, send_now: when === "now", schedule_at: when === "later" ? new Date(at).toISOString() : undefined }));
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  const srcOptions = [...SOURCES.slice(0, -1), ...traits.map((t) => [`trait:${t}`, `Detail: ${t}`] as [string, string]), ...(aud.type === "csv" ? csvCols.map((c) => [`csv:${c}`, `CSV: ${c}`] as [string, string]) : []), SOURCES.at(-1)!];
  const steps = ["Template", "Audience", "Variables", "Schedule"];

  return (
    <Modal open onClose={onClose} title="New campaign" width={720}
      footer={<>{step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 3 ? <Button disabled={!canNext} onClick={() => { setErr(null); setStep(step + 1); }}>Continue</Button> : <Button loading={busy} disabled={!canNext} onClick={create}><Send size={14} /> {when === "now" ? "Send campaign" : when === "later" ? "Schedule" : "Save draft"}</Button>}</>}>
      <div className="mb-5 flex items-center gap-2">{steps.map((s, i) => <div key={s} className="flex flex-1 items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: i <= step ? "#00926B" : "rgba(255,255,255,0.1)" }}>{i + 1}</span><span className={`text-[12px] ${i === step ? "text-white" : "text-white/40"}`}>{s}</span></div>)}</div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}

      {step === 0 && (!tpls ? <Spinner /> : tpls.length === 0 ? <Alert tone="yellow">You don&apos;t have any approved templates yet. <Link href="/dashboard/templates" className="underline">Create or sync templates</Link> — campaigns can only use templates Meta has approved.</Alert> : (
        <div className="space-y-4"><Field label="Campaign name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali offer – VIP customers" autoFocus /></Field>
          <Field label="Template"><Select value={tplId} onChange={(e) => setTplId(e.target.value)}><option value="">Choose an approved template…</option>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.category.toLowerCase()})</option>)}</Select></Field>
          {tpl && <div className="rounded-xl bg-[#005c4b]/30 p-3 text-[13px] whitespace-pre-wrap text-white/85">{tpl.body}</div>}
          {tpl?.category === "MARKETING" && <div className="text-[12px] text-amber-300/80">Marketing template: contacts who opted out are skipped automatically.</div>}</div>))}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Who should receive it?"><Select value={aud.type} onChange={(e) => setAud({ type: e.target.value as Audience["type"] })}><option value="all_contacts">All subscribed contacts</option><option value="tag">Contacts with a tag</option><option value="segment">A saved segment</option><option value="csv">Upload a CSV list</option></Select></Field>
          {aud.type === "tag" && <Field label="Tag"><Select value={aud.tag ?? ""} onChange={(e) => setAud({ ...aud, tag: e.target.value })}><option value="">Choose a tag…</option>{tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}</Select></Field>}
          {aud.type === "segment" && <Field label="Segment"><Select value={aud.segment_id ?? ""} onChange={(e) => setAud({ ...aud, segment_id: e.target.value })}><option value="">Choose a segment…</option>{segs.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.count})</option>)}</Select></Field>}
          {aud.type === "csv" && <div className="rounded-xl border border-dashed border-white/20 p-5 text-center"><input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => void onCsv(e.target.files?.[0])} /><Upload size={20} className="mx-auto text-white/40" />
            <div className="mt-2 text-[13px] text-white/80">{csvRows.length ? `${csvRows.length.toLocaleString()} rows loaded` : "Needs a phone column with country codes"}</div><Button size="sm" variant="ghost" className="mt-2" onClick={() => fileRef.current?.click()}>Choose CSV</Button>
            {csvCols.length > 0 && <div className="mt-2 text-[11.5px] text-white/40">Columns you can use as variables: {csvCols.join(", ")}</div>}</div>}
          <div className="rounded-xl bg-white/[0.04] p-4 text-[13px]">{count ? <><b className="text-[18px] text-white">{count.count.toLocaleString()}</b> <span className="text-white/60">people will receive this</span>{count.skipped > 0 && <div className="mt-1 text-[12px] text-amber-300">{count.skipped} skipped (opted out or invalid number)</div>}</> : <span className="text-white/40">{aud.type === "all_contacts" ? "Counting…" : "Choose an audience to see how many people it reaches"}</span>}</div>
        </div>
      )}

      {step === 2 && tpl && (
        <div className="space-y-4">
          {tpl.requires.body.length === 0 && !tpl.requires.header_media && <div className="text-[13px] text-white/60">This template has no variables — nothing to map.</div>}
          {tpl.requires.body.map((n) => { const m = map.body[String(n)] ?? { source: "fixed", value: "" }; return (
            <div key={n} className="grid gap-2 sm:grid-cols-[90px_1fr_1fr] sm:items-end"><div className="text-[13px] font-medium text-white/80">{`{{${n}}}`}</div>
              <Select value={m.source} onChange={(e) => setMap({ ...map, body: { ...map.body, [String(n)]: { source: e.target.value, value: "" } } })} aria-label={`Source for variable ${n}`}>{srcOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              {m.source === "fixed" && <Input value={m.value ?? ""} onChange={(e) => setMap({ ...map, body: { ...map.body, [String(n)]: { source: "fixed", value: e.target.value } } })} placeholder="Text to insert" />}</div>); })}
          {tpl.requires.header_media && <Field label={`Header ${tpl.requires.header_media} URL`} hint="Public https link"><Input value={map.header_media ?? ""} onChange={(e) => setMap({ ...map, header_media: e.target.value })} placeholder="https://…" /></Field>}
          <Field label="If a contact has no value for a field, use" hint="e.g. “there” → “Hi there”"><Input value={map.fallback} onChange={(e) => setMap({ ...map, fallback: e.target.value })} /></Field>
          <div className="rounded-xl bg-[#005c4b]/30 p-3 text-[13px] whitespace-pre-wrap text-white/85"><div className="mb-1 text-[11px] uppercase tracking-wide text-white/40">Preview</div>{tpl.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => { const m = map.body[n]; return m ? (m.source === "fixed" ? m.value || `{{${n}}}` : `‹${srcOptions.find((s) => s[0] === m.source)?.[1] ?? m.source}›`) : `{{${n}}}`; })}</div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">{([["now", "Send now", "Starts immediately"], ["later", "Schedule", "Pick a date & time"], ["draft", "Save as draft", "Send it later from here"]] as const).map(([k, t, s]) => (
            <button key={k} onClick={() => setWhen(k)} className={`rounded-xl border p-3 text-left ${when === k ? "border-[#00926B] bg-[#00926B]/10" : "border-white/10 hover:bg-white/[0.04]"}`}><div className="text-[13.5px] font-medium text-white">{t}</div><div className="text-[12px] text-white/45">{s}</div></button>))}</div>
          {when === "later" && <Field label="Send at (your local time)"><Input type="datetime-local" value={at} min={minAt} onChange={(e) => setAt(e.target.value)} /></Field>}
          <div className="rounded-xl bg-white/[0.04] p-4 text-[13px] text-white/70"><b className="text-white">{name}</b><br />Template: {tpl?.name} · Audience: {count?.count.toLocaleString() ?? "—"} people<br /><span className="text-[12px] text-white/40">Messages are paced automatically. If WhatsApp rate-limits the number, sending pauses and resumes on its own.</span></div>
        </div>
      )}
    </Modal>
  );
}
