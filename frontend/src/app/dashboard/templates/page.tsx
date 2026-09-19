"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, FileText, Phone, Plus, RefreshCw, Send, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Alert, Badge, Button, Card, cx, EmptyState, Field, Input, Modal, Page, PageHeader, Select, Spinner, statusTone, Tabs, Textarea, useDebounced, useUi } from "@/components/ui/kit";
import { errorMessage, templates as api, whatsapp, type LibraryTemplate, type Template, type TemplateButton, type TemplateInput, type WaAccount } from "@/lib/api";

const LANGS: [string, string][] = [["en", "English"], ["en_US", "English (US)"], ["en_GB", "English (UK)"], ["hi", "Hindi"], ["mr", "Marathi"], ["ta", "Tamil"], ["te", "Telugu"], ["bn", "Bengali"], ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"], ["pa", "Punjabi"], ["es", "Spanish"], ["pt_BR", "Portuguese (BR)"], ["fr", "French"], ["de", "German"], ["ar", "Arabic"], ["id", "Indonesian"]];
const EMPTY: TemplateInput = { name: "", language: "en", category: "UTILITY", body: "", header_type: "none", header_text: "", header_example: "", footer: "", buttons: [], body_examples: [], submit: true };
const CAT_TONE = { MARKETING: "yellow", UTILITY: "blue", AUTHENTICATION: "gray" } as const;

export default function TemplatesPage() {
  const { toast, confirm } = useUi();
  const [list, setList] = useState<Template[] | null>(null);
  const [account, setAccount] = useState<WaAccount | null | undefined>(undefined);
  const [tab, setTab] = useState<"all" | "approved" | "pending" | "rejected" | "draft">("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; value: TemplateInput } | null>(null);
  const [showLib, setShowLib] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api.list({ q: dq || undefined })); setError(null); } catch (e) { setError(errorMessage(e, "Couldn't load templates.")); }
  }, [dq]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { whatsapp.list().then((a) => setAccount(a.find((x) => x.status === "connected") ?? null)).catch(() => setAccount(null)); }, []);

  const counts = useMemo(() => { const c = { all: 0, approved: 0, pending: 0, rejected: 0, draft: 0 }; list?.forEach((t) => { c.all++; if (t.status in c) c[t.status as keyof typeof c]++; }); return c; }, [list]);
  const shown = list?.filter((t) => tab === "all" || t.status === tab);

  const sync = async () => {
    if (!account) return;
    setSyncing(true);
    try { const r = await whatsapp.syncTemplates(account.id); toast(`Synced ${r.total} templates from WhatsApp (${r.created} new, ${r.updated} updated)`); await load(); } catch (e) { toast(errorMessage(e), "error"); } finally { setSyncing(false); }
  };
  const edit = (t: Template) => setEditing({ id: t.id, value: { name: t.name, language: t.language, category: t.category, body: t.body, header_type: t.header_type, header_text: t.header_text ?? "", header_example: t.header_example ?? "", footer: t.footer ?? "", buttons: t.buttons, body_examples: t.body_examples, submit: true } });

  return (
    <Page wide>
      <PageHeader icon={<FileText size={20} />} title="Templates" subtitle="Message templates are required to start conversations or message people outside the 24-hour window. Meta reviews each one — usually within minutes."
        actions={<>
          {account && <Button variant="ghost" onClick={sync} loading={syncing}><RefreshCw size={14} /> Sync from WhatsApp</Button>}
          <Button variant="ghost" onClick={() => setShowLib(true)}><Sparkles size={14} /> Template library</Button>
          <Button onClick={() => setEditing({ value: EMPTY })}><Plus size={15} /> New template</Button>
        </>} />
      {account === null && <Alert tone="yellow">No WhatsApp number connected yet — you can build templates and save drafts, but submitting to Meta needs a connected number. <Link href="/dashboard/whatsapp" className="underline">Connect now</Link></Alert>}
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={[{ id: "all", label: "All", count: counts.all }, { id: "approved", label: "Approved", count: counts.approved }, { id: "pending", label: "Pending", count: counts.pending }, { id: "rejected", label: "Rejected", count: counts.rejected }, { id: "draft", label: "Drafts", count: counts.draft }]} value={tab} onChange={setTab} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="!w-56" aria-label="Search templates" />
      </div>

      {!shown ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title={list?.length ? "Nothing in this view" : "No templates yet"} body={list?.length ? undefined : "Start from the library, write your own, or sync the ones already in your WhatsApp Business Account."}
          action={!list?.length ? <Button onClick={() => setShowLib(true)}><Sparkles size={14} /> Browse library</Button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[14.5px] font-semibold text-white">{t.name}</div><div className="text-[12px] text-white/40">{t.language}</div></div>
                <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={statusTone(t.status)}>{t.status}</Badge><Badge tone={CAT_TONE[t.category]}>{t.category.toLowerCase()}</Badge></div>
              </div>
              <div className="mt-3 flex-1 rounded-xl bg-[#005c4b]/30 p-3 text-[12.5px] leading-relaxed text-white/85">
                {t.header_type === "text" && t.header_text && <div className="mb-1 font-semibold">{t.header_text}</div>}
                {["image", "video", "document"].includes(t.header_type) && <div className="mb-1 text-[11.5px] text-white/45">[{t.header_type} header]</div>}
                <div className="line-clamp-5 whitespace-pre-wrap">{t.body}</div>
                {t.footer && <div className="mt-1.5 text-[11px] text-white/45">{t.footer}</div>}
                {t.buttons.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{t.buttons.map((b, i) => <span key={i} className="rounded-md bg-white/10 px-2 py-0.5 text-[11px]">{b.text}</span>)}</div>}
              </div>
              {t.rejection_reason && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-200">Rejected: {t.rejection_reason.replace(/_/g, " ").toLowerCase()}</div>}
              {t.status === "pending" && <div className="mt-2 text-[11.5px] text-white/40">Waiting for Meta review — this page updates automatically when it&apos;s decided.</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status === "draft" && <><Button size="sm" variant="ghost" onClick={() => edit(t)}>Edit</Button>
                  <Button size="sm" onClick={async () => { try { await api.submit(t.id); toast("Submitted to Meta for review"); await load(); } catch (e) { toast(errorMessage(e), "error"); } }}><Send size={12} /> Submit</Button></>}
                {t.status === "rejected" && <Button size="sm" variant="ghost" onClick={async () => { try { const d = await api.duplicate(t.id); toast("Copied as a new draft — fix it and resubmit"); await load(); edit(d); } catch (e) { toast(errorMessage(e), "error"); } }}><Copy size={12} /> Fix & resubmit</Button>}
                {t.status === "approved" && <Link href="/dashboard/broadcasts?new=1"><Button size="sm" variant="ghost">Use in campaign</Button></Link>}
                <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { try { await api.duplicate(t.id); toast("Duplicated as draft"); await load(); } catch (e) { toast(errorMessage(e), "error"); } }} aria-label="Duplicate"><Copy size={13} /></Button>
                <Button size="sm" variant="danger" aria-label="Delete" onClick={async () => { if (await confirm({ title: `Delete “${t.name}”?`, body: t.meta_template_id ? "It is also deleted from your WhatsApp Business Account. Meta blocks re-using the name for 30 days." : "This draft will be removed.", confirmLabel: "Delete", danger: true })) { try { await api.remove(t.id); toast("Template deleted"); await load(); } catch (e) { toast(errorMessage(e), "error"); } } }}><Trash2 size={13} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Library open={showLib} onClose={() => setShowLib(false)} onPick={(l) => { setShowLib(false); setEditing({ value: { ...EMPTY, name: l.name, category: l.category, body: l.body, footer: l.footer ?? "", buttons: l.buttons, body_examples: l.body_examples } }); }} />
      {editing && <Builder key={editing.id ?? "new"} initial={editing.value} id={editing.id} canSubmit={!!account} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); toast(t.submit_error ? t.submit_error : t.status === "draft" ? "Draft saved" : "Submitted to Meta for review", t.submit_error ? "info" : "success"); void load(); }} />}
    </Page>
  );
}

function Library({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (l: LibraryTemplate) => void }) {
  const [items, setItems] = useState<LibraryTemplate[] | null>(null);
  useEffect(() => { if (open && !items) api.library().then(setItems).catch(() => setItems([])); }, [open, items]);
  return (
    <Modal open={open} onClose={onClose} title="Template library" width={720}>
      {!items ? <Spinner /> : <div className="grid gap-3 sm:grid-cols-2">{items.map((l) => (
        <button key={l.key} onClick={() => onPick(l)} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.07]">
          <div className="flex items-center justify-between"><span className="text-[13.5px] font-medium text-white">{l.title}</span><Badge tone={CAT_TONE[l.category as keyof typeof CAT_TONE]}>{l.category.toLowerCase()}</Badge></div>
          <p className="mt-1.5 line-clamp-3 text-[12.5px] text-white/50">{l.body}</p>
        </button>))}</div>}
    </Modal>
  );
}

function vars(text: string): number[] { return [...new Set([...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b); }

function Builder({ initial, id, canSubmit, onClose, onSaved }: { initial: TemplateInput; id?: string; canSubmit: boolean; onClose: () => void; onSaved: (t: Template) => void }) {
  const { toast } = useUi();
  const [t, setT] = useState<TemplateInput>(initial);
  const [busy, setBusy] = useState<"save" | "draft" | "ai" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aiText, setAiText] = useState("");
  const [showAi, setShowAi] = useState(false);
  const auth = t.category === "AUTHENTICATION";
  const bodyVars = vars(t.body);
  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setT((p) => ({ ...p, [k]: v }));
  const setBtn = (i: number, patch: Partial<TemplateButton>) => set("buttons", t.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addVar = () => { const n = (bodyVars.at(-1) ?? 0) + 1; set("body", `${t.body}{{${n}}}`); };
  const preview = t.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => t.body_examples[Number(n) - 1] || `{{${n}}}`);

  const save = async (submit: boolean) => {
    setBusy(submit ? "save" : "draft"); setErr(null);
    try {
      const payload = { ...t, name: t.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"), body_examples: bodyVars.map((_, i) => t.body_examples[i] ?? ""), submit };
      onSaved(id ? await api.update(id, payload) : await api.create(payload));
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(null); }
  };
  const draft = async () => {
    setBusy("ai"); setErr(null);
    try { const d = await api.aiDraft({ description: aiText, category: t.category }); setT((p) => ({ ...p, name: p.name || d.name, body: d.body, footer: d.footer || p.footer, body_examples: d.body_examples })); setShowAi(false); toast("Draft written — review it before submitting"); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} title={id ? "Edit draft" : "New template"} width={980}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="soft" loading={busy === "draft"} onClick={() => save(false)} disabled={!t.name}>Save draft</Button>
        <Button loading={busy === "save"} onClick={() => save(true)} disabled={!t.name || !canSubmit} title={canSubmit ? undefined : "Connect a WhatsApp number to submit"}><Send size={14} /> Submit for approval</Button></>}>
      {err && <Alert>{err}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" hint="lowercase, numbers, underscores"><Input value={t.name} onChange={(e) => set("name", e.target.value)} placeholder="order_confirmation" /></Field>
            <Field label="Language"><Select value={t.language} onChange={(e) => set("language", e.target.value)}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
            <Field label="Category" hint={t.category === "MARKETING" ? "Promotions & offers" : t.category === "UTILITY" ? "Order/account updates" : "One-time passcodes"}><Select value={t.category} onChange={(e) => set("category", e.target.value)}><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option><option value="AUTHENTICATION">Authentication</option></Select></Field>
          </div>

          {auth ? <Alert tone="blue">Authentication templates use Meta&apos;s fixed layout: “{"{{1}}"} is your verification code…” with a copy-code button. Nothing else to configure.</Alert> : (
            <>
              <div className="flex items-center justify-between"><span className="text-[12.5px] font-medium text-white/70">Header (optional)</span>
                <Button size="sm" variant="ghost" onClick={() => setShowAi((s) => !s)}><Wand2 size={13} /> Write with AI</Button></div>
              {showAi && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><Textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Describe the message, e.g. “Tell customers their order shipped and give the tracking link”" className="!min-h-[64px]" /><Button size="sm" className="mt-2" loading={busy === "ai"} disabled={aiText.trim().length < 5} onClick={draft}><Sparkles size={13} /> Generate</Button></div>}
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <Select value={t.header_type} onChange={(e) => set("header_type", e.target.value)} aria-label="Header type"><option value="none">No header</option><option value="text">Text</option><option value="image">Image</option><option value="video">Video</option><option value="document">Document</option></Select>
                {t.header_type === "text" && <Input value={t.header_text} onChange={(e) => set("header_text", e.target.value)} maxLength={60} placeholder="Short headline (max 60)" />}
                {["image", "video", "document"].includes(t.header_type) && <Input value={t.header_example} onChange={(e) => set("header_example", e.target.value)} placeholder={`Public sample ${t.header_type} URL (Meta requires an example)`} />}
              </div>
              <Field label="Body">
                <Textarea value={t.body} onChange={(e) => set("body", e.target.value)} maxLength={1024} placeholder="Hi {{1}}, your order {{2}} is on its way!" className="!min-h-[130px]" />
                <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-white/40"><Button size="sm" variant="ghost" onClick={addVar}><Plus size={12} /> Add variable</Button><span>{t.body.length}/1024</span></div>
              </Field>
              {bodyVars.length > 0 && (
                <div className="rounded-xl border border-white/10 p-3"><div className="mb-2 text-[12px] text-white/50">Sample values — Meta reviewers see these, so use realistic examples</div>
                  <div className="grid gap-2 sm:grid-cols-2">{bodyVars.map((n, i) => <Field key={n} label={`{{${n}}}`}><Input value={t.body_examples[i] ?? ""} onChange={(e) => { const b = [...t.body_examples]; b[i] = e.target.value; set("body_examples", b); }} placeholder="Example" /></Field>)}</div></div>
              )}
              <Field label="Footer (optional)"><Input value={t.footer} onChange={(e) => set("footer", e.target.value)} maxLength={60} placeholder={t.category === "MARKETING" ? "Reply STOP to opt out" : "Thanks for choosing us"} /></Field>
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-[12.5px] font-medium text-white/70">Buttons (optional)</span>
                  <div className="flex gap-1">{([["quick_reply", "Quick reply"], ["url", "Link"], ["phone", "Call"]] as const).map(([k, l]) => <Button key={k} size="sm" variant="ghost" disabled={t.buttons.length >= 10} onClick={() => set("buttons", [...t.buttons, { type: k, text: "" }])}><Plus size={12} /> {l}</Button>)}</div></div>
                {t.buttons.map((b, i) => (
                  <div key={i} className="mb-2 flex flex-wrap gap-2 rounded-xl border border-white/10 p-2.5">
                    <Badge tone="gray" className="self-center">{b.type === "quick_reply" ? "Reply" : b.type === "url" ? "Link" : "Call"}</Badge>
                    <Input className="!w-40" value={b.text} maxLength={25} onChange={(e) => setBtn(i, { text: e.target.value })} placeholder="Button text" />
                    {b.type === "url" && <><Input className="min-w-[180px] flex-1" value={b.url ?? ""} onChange={(e) => setBtn(i, { url: e.target.value })} placeholder="https://example.com/track/{{1}}" />
                      {(b.url ?? "").includes("{{1}}") && <Input className="min-w-[180px] flex-1" value={b.example ?? ""} onChange={(e) => setBtn(i, { example: e.target.value })} placeholder="Example full URL" />}</>}
                    {b.type === "phone" && <Input className="!w-44" value={b.phone ?? ""} onChange={(e) => setBtn(i, { phone: e.target.value })} placeholder="+919876543210" />}
                    <button onClick={() => set("buttons", t.buttons.filter((_, j) => j !== i))} className="ml-auto px-1 text-white/40 hover:text-red-300" aria-label="Remove button"><X size={15} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="sticky top-0"><div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-white/40">Live preview</div>
            <div className="rounded-2xl bg-[#0b141a] p-4"><div className="max-w-[270px] rounded-xl rounded-tl-none bg-[#202c33] p-2.5 text-[13px] text-white shadow">
              {auth ? <div><span className="font-medium">123456</span> is your verification code. For your security, do not share this code.<div className="mt-2 rounded-md bg-white/10 py-1.5 text-center text-sky-300">Copy code</div></div> : <>
                {t.header_type === "text" && t.header_text && <div className="mb-1 font-semibold">{t.header_text}</div>}
                {["image", "video", "document"].includes(t.header_type) && <div className="mb-1.5 flex h-28 items-center justify-center rounded-lg bg-white/10 text-[11px] text-white/45">{t.header_type} preview</div>}
                <div className="whitespace-pre-wrap break-words">{preview || <span className="text-white/30">Your message appears here…</span>}</div>
                {t.footer && <div className="mt-1.5 text-[11.5px] text-white/45">{t.footer}</div>}
                {t.buttons.length > 0 && <div className="mt-2 space-y-1">{t.buttons.map((b, i) => <div key={i} className="flex items-center justify-center gap-1.5 rounded-md bg-white/10 py-1.5 text-[12.5px] text-sky-300">{b.type === "url" && <ExternalLink size={12} />}{b.type === "phone" && <Phone size={12} />}{b.text || "Button"}</div>)}</div>}
              </>}
            </div></div>
            <p className={cx("mt-3 text-[11.5px]", t.category === "MARKETING" ? "text-amber-300/80" : "text-white/35")}>{t.category === "MARKETING" ? "Marketing templates are charged per message and can only be sent to people who opted in." : "Approval is usually fast when the copy is clear and the samples are realistic."}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
