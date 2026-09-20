"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Code2, ExternalLink, LayoutGrid, MessageCircle, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CopyField, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Spinner, Tabs, Textarea, Toggle, useUi } from "@/components/ui/kit";
import { errorMessage, widgets as api, type Widget, type WidgetInput } from "@/lib/api";

const COLORS = ["#00926B", "#25D366", "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#D97706", "#111827"];

const toInput = (w: Widget): WidgetInput => ({ name: w.name, enabled: w.enabled, phone_number: w.phone_number, title: w.title, subtitle: w.subtitle, welcome_message: w.welcome_message, prefill_message: w.prefill_message, cta_text: w.cta_text, brand_color: w.brand_color, position: w.position, bottom_offset: w.bottom_offset, delay_seconds: w.delay_seconds, collect_lead: w.collect_lead, allowed_domains: w.allowed_domains });

export default function WidgetPage() {
  const { toast, confirm } = useUi();
  const [list, setList] = useState<Widget[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const l = await api.list(); setList(l); setActiveId((c) => c ?? l[0]?.id ?? null); } catch (e) { setError(errorMessage(e, "Couldn't load widgets.")); } }, []);
  useEffect(() => { void load(); }, [load]);

  const [creating, setCreating] = useState(false);
  const create = () => setCreating(true);
  const onCreated = async (w: Widget) => { setCreating(false); toast("Widget created"); await load(); setActiveId(w.id); };
  const active = list?.find((w) => w.id === activeId);

  return (
    <Page wide>
      <PageHeader icon={<LayoutGrid size={20} />} title="Website widget" subtitle="Add a WhatsApp chat button to your website. Visitors tap it to start a conversation with your number — optionally leaving their details first."
        actions={<Button onClick={create}><Plus size={15} /> New widget</Button>} />
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <CreateWidgetDialog open={creating} onClose={() => setCreating(false)} onCreated={onCreated} />
      {!list ? <Spinner /> : list.length === 0 ? <EmptyState icon={<MessageCircle size={22} />} title="No widget yet" body="Create one, style it, and paste one line of code into your site." action={<Button onClick={create}><Plus size={15} /> Create widget</Button>} /> : (
        <>
          {list.length > 1 && <div className="mb-4 flex flex-wrap gap-2">{list.map((w) => <button key={w.id} onClick={() => setActiveId(w.id)} className={`rounded-full px-4 py-1.5 text-[13px] ${w.id === activeId ? "bg-white/15 text-white" : "bg-white/[0.05] text-white/55 hover:text-white"}`}>{w.name}</button>)}</div>}
          {active && <EditorPanel key={active.id} widget={active} onSaved={(w) => setList((l) => l!.map((x) => (x.id === w.id ? w : x)))}
            onDelete={async () => { if (await confirm({ title: "Delete this widget?", body: "The embed code on your website stops working immediately.", confirmLabel: "Delete", danger: true })) { try { await api.remove(active.id); setActiveId(null); await load(); toast("Widget deleted"); } catch (e) { setError(errorMessage(e)); } } }} />}
        </>
      )}
    </Page>
  );
}

/** Asks for the number up front. Blank is allowed — the API then falls back to the connected WhatsApp number, or says so if there isn't one. */
function CreateWidgetDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (w: Widget) => void }) {
  const [name, setName] = useState("Website widget");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, "");
  const phoneError = digits.length > 0 && (digits.length < 8 || digits.length > 15) ? "Enter the full number with country code, e.g. +91 98765 43210." : null;

  const submit = async () => {
    if (phoneError) return;
    setBusy(true); setErr(null);
    try { onCreated(await api.create({ name: name.trim() || "Website widget", phone_number: digits })); setPhone(""); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New website widget" width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!!phoneError} onClick={submit}>Create widget</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4">
        {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
        <Field label="Widget name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
        <Field label="WhatsApp number to open" error={phoneError} hint="With country code. Leave blank to use your connected WhatsApp number.">
          <Input type="tel" inputMode="tel" autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

function EditorPanel({ widget, onSaved, onDelete }: { widget: Widget; onSaved: (w: Widget) => void; onDelete: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState<WidgetInput>(toInput(widget));
  const [domains, setDomains] = useState(widget.allowed_domains.join(", "));
  const [tab, setTab] = useState<"style" | "install" | "link">("style");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(toInput(widget)) || domains !== widget.allowed_domains.join(", ");
  const set = <K extends keyof WidgetInput>(k: K, v: WidgetInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true); setErr(null);
    try { const w = await api.update(widget.id, { ...f, allowed_domains: domains.split(",").map((d) => d.trim()).filter(Boolean) }); onSaved(w); toast("Widget saved — changes go live within 2 minutes (browser cache)"); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  const digits = f.phone_number.replace(/\D/g, "");
  const link = `https://wa.me/${digits}${f.prefill_message ? `?text=${encodeURIComponent(f.prefill_message)}` : ""}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
        <Tabs tabs={[{ id: "style", label: "Design & behaviour" }, { id: "install", label: "Install" }, { id: "link", label: "Link & QR" }]} value={tab} onChange={setTab} />
        {tab === "style" && (
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between"><Field label="Widget name" className="max-w-xs flex-1"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <label className="flex items-center gap-2 text-[13px] text-white/60">Enabled <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Widget enabled" /></label></div>
            <Field label="WhatsApp number to open" hint="With country code. Defaults to your connected number."><Input value={f.phone_number} onChange={(e) => set("phone_number", e.target.value)} placeholder="+91 98765 43210" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Title"><Input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} /></Field><Field label="Subtitle"><Input value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={200} /></Field></div>
            <Field label="Welcome message (shown in the chat bubble)"><Textarea value={f.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} maxLength={600} className="!min-h-[70px]" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Pre-filled message" hint="What appears in their WhatsApp box"><Input value={f.prefill_message} onChange={(e) => set("prefill_message", e.target.value)} maxLength={500} /></Field><Field label="Button text"><Input value={f.cta_text} onChange={(e) => set("cta_text", e.target.value)} maxLength={60} /></Field></div>
            <div><span className="mb-1.5 block text-[12.5px] font-medium text-white/70">Brand colour</span><div className="flex flex-wrap items-center gap-2">{COLORS.map((c) => <button key={c} onClick={() => set("brand_color", c)} aria-label={c} className="h-8 w-8 rounded-full border-2" style={{ background: c, borderColor: f.brand_color === c ? "#fff" : "transparent" }} />)}<Input value={f.brand_color} onChange={(e) => set("brand_color", e.target.value)} className="!w-28 font-mono" aria-label="Custom colour hex" /></div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Position"><Select value={f.position} onChange={(e) => set("position", e.target.value as "left" | "right")}><option value="right">Bottom right</option><option value="left">Bottom left</option></Select></Field>
              <Field label="Distance from bottom (px)"><Input type="number" min={0} max={400} value={f.bottom_offset} onChange={(e) => set("bottom_offset", Number(e.target.value))} /></Field>
              <Field label="Show after (seconds)"><Input type="number" min={0} max={120} value={f.delay_seconds} onChange={(e) => set("delay_seconds", Number(e.target.value))} /></Field></div>
            <div className="flex items-center justify-between rounded-xl bg-white/[0.04] p-4"><div><div className="text-[13.5px] font-medium text-white">Ask for name & number first</div><div className="text-[12px] text-white/45">Visitors are saved as contacts (source: widget) before chat opens — great for lead capture.</div></div><Toggle checked={f.collect_lead} onChange={(v) => set("collect_lead", v)} label="Collect lead details" /></div>
            <Field label="Only show on these domains (optional)" hint="Comma separated, e.g. mysite.com, *.mysite.com. Empty = anywhere."><Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="mysite.com" /></Field>
            <div className="flex items-center justify-between"><Button variant="danger" size="sm" onClick={onDelete}><Trash2 size={13} /> Delete widget</Button><Button loading={busy} disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</Button></div>
          </Card>
        )}
        {tab === "install" && (
          <Card className="space-y-5 p-5">
            {dirty && <Alert tone="yellow">You have unsaved changes — save first so the live widget matches this preview.</Alert>}
            <div><h3 className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold text-white"><Code2 size={16} /> Paste on your website</h3><p className="mb-3 text-[12.5px] text-white/50">Add this line just before <code>&lt;/body&gt;</code> on every page where the button should appear (works with any site builder, Shopify, WordPress, Webflow…).</p><CopyField value={widget.embed_snippet} /></div>
            <div className="grid grid-cols-3 gap-3 text-center">{([["Opens", widget.opens], ["Chat clicks", widget.clicks], ["Leads captured", widget.leads]] as const).map(([l, n]) => <div key={l} className="rounded-xl bg-white/[0.04] p-3"><div className="text-[22px] font-semibold text-white">{n.toLocaleString()}</div><div className="text-[12px] text-white/45">{l}</div></div>)}</div>
            <div className="rounded-xl bg-white/[0.04] p-4 text-[12.5px] text-white/55"><b className="text-white/80">Shopify:</b> Online Store → Themes → Edit code → <code>theme.liquid</code>. <b className="text-white/80">WordPress:</b> use a “header/footer scripts” plugin. <b className="text-white/80">Google Tag Manager:</b> new Custom HTML tag. Changes you save here reach visitors within about 2 minutes.</div>
          </Card>
        )}
        {tab === "link" && (
          <Card className="space-y-5 p-5">
            <p className="text-[12.5px] text-white/50">No website? Share this click-to-chat link or QR code on social media, posters, packaging or email signatures.</p>
            <CopyField label="Click-to-chat link" value={link} />
            <div className="flex flex-wrap items-center gap-6"><div className="theme-fixed rounded-xl bg-white p-3">{digits.length >= 8 ? <img src={api.qrUrl(link)} alt="QR code that opens WhatsApp chat" width={180} height={180} /> : <div className="flex h-[180px] w-[180px] items-center justify-center text-[12px] text-black/50">Enter a number first</div>}</div>
              <div className="space-y-2 text-[12.5px] text-white/50"><p>Scan with a phone camera to open a chat.</p>{digits.length >= 8 && <a href={api.qrUrl(link)} download="whatsapp-qr.svg" className="inline-flex items-center gap-1 text-sky-300 hover:underline">Download QR (SVG) <ExternalLink size={12} /></a>}</div></div>
          </Card>
        )}
      </div>

      <div><div className="sticky top-4"><div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-medium uppercase tracking-wide text-white/40">Live preview</span>{!f.enabled && <Badge tone="yellow">disabled</Badge>}</div><Preview f={f} /></div></div>
    </div>
  );
}

function Preview({ f }: { f: WidgetInput }) {
  const [open, setOpen] = useState(true);
  const side = f.position === "left" ? "left-4" : "right-4";
  const bubble = useMemo(() => f.welcome_message || "…", [f.welcome_message]);
  return (
    <div className="theme-fixed relative h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900">
      <div className="p-5"><div className="mb-3 h-3 w-32 rounded bg-white/10" /><div className="mb-2 h-2 w-full rounded bg-white/[0.06]" /><div className="mb-2 h-2 w-4/5 rounded bg-white/[0.06]" /><div className="h-2 w-3/5 rounded bg-white/[0.06]" /></div>
      {open && (
        <div className={`absolute bottom-20 ${side} w-[300px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl bg-white text-black shadow-2xl`} style={{ bottom: f.bottom_offset + 62 }}>
          <div className="relative px-4 py-3.5 text-white" style={{ background: f.brand_color }}><div className="text-[15px] font-semibold">{f.title}</div><div className="text-[12px] opacity-90">{f.subtitle}</div><button onClick={() => setOpen(false)} className="absolute right-3 top-2.5 text-xl leading-none" aria-label="Close preview">×</button></div>
          <div className="bg-[#ece5dd] p-4"><div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] shadow-sm">{bubble}</div></div>
          <div className="space-y-2 bg-white p-3.5">{f.collect_lead && <><div className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] text-zinc-400">Your name</div><div className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] text-zinc-400">WhatsApp number (with country code)</div></>}
            <div className="rounded-[10px] py-2.5 text-center text-[14px] font-semibold text-white" style={{ background: f.brand_color }}>{f.cta_text}</div></div>
        </div>)}
      <button onClick={() => setOpen((o) => !o)} aria-label="Toggle preview" className={`absolute ${side} flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-xl`} style={{ background: f.brand_color, bottom: f.bottom_offset }}>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="#fff"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.6 1.9 6.5L4 29l7.7-1.9A12 12 0 0 0 16 27c6.6 0 12-5.4 12-12S22.6 3 16 3zm5.4 17.5c-.3.9-1.8 1.7-2.5 1.7-.7.1-1.3.3-4.4-.9-3.7-1.5-6-5.3-6.2-5.5-.2-.2-1.5-2-1.5-3.8s.9-2.7 1.3-3.1c.3-.4.7-.4 1-.4h.7c.2 0 .5-.1.8.6l1.1 2.7c.1.2.1.4 0 .6l-.4.7-.6.6c-.2.2-.4.4-.2.8.2.4.9 1.5 2 2.4 1.4 1.2 2.5 1.6 2.9 1.8.4.2.6.1.8-.1l1.1-1.3c.3-.3.5-.2.8-.1l2.5 1.2c.3.1.5.2.6.3.1.2.1.9-.2 1.7z" /></svg></button>
    </div>
  );
}

