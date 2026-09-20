"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, Bot, Check, CheckCheck, Clock, FileText, IndianRupee, Inbox as InboxIcon, Paperclip, Search, Send, StickyNote, UserRound, X, Zap } from "lucide-react";
import { ACCENT, accentTint, Alert, Badge, Button, cx, EmptyState, Field, fmtDateTime, Input, Modal, Select, Spinner, timeAgo, Toggle, useDebounced, usePoll, useUi } from "@/components/ui/kit";
import {
  contacts as contactsApi, errorMessage, getSettings, inbox, templates as templatesApi, whatsapp, team,
  type ChatMessage, type ConversationDetail, type ConversationSummary, type Member, type Template,
} from "@/lib/api";
import PaymentLinkModal from "@/components/sales/PaymentLinkModal";
import ContactDeals from "@/components/sales/ContactDeals";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

type Filter = "open" | "mine" | "unassigned" | "resolved";

export default function InboxPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const { user_id } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof inbox.summary>> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [members, setMembers] = useState<Member[]>([]);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const p = filter === "resolved" ? { status: "resolved" } : filter === "mine" ? { status: "open", assigned: "me" } : filter === "unassigned" ? { status: "open", assigned: "unassigned" } : { status: "open" };
      const [l, s] = await Promise.all([inbox.list({ ...p, q: dq || undefined, limit: 60 }), inbox.summary()]);
      setList(l.items);
      setTotal(l.total);
      setSummary(s);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Couldn't load conversations."));
    }
  }, [filter, dq]);

  usePoll(loadList, 8000, [filter, dq]);
  useEffect(() => {
    team.members().then(setMembers).catch(() => {});
    whatsapp.list().then((a) => setHasAccount(a.some((x) => x.status === "connected"))).catch(() => setHasAccount(true));
  }, []);

  const open = (id: string | null) => {
    setActiveId(id);
    router.replace(id ? `/dashboard/inbox?c=${id}` : "/dashboard/inbox", { scroll: false });
  };

  if (hasAccount === false) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <EmptyState icon={<InboxIcon size={22} />} title="Connect a WhatsApp number to start chatting" body="Your shared team inbox shows every conversation with your customers. Connect a number first."
          action={<Link href="/dashboard/whatsapp"><Button>Connect WhatsApp</Button></Link>} />
      </div>
    );
  }

  const tabs: { id: Filter; label: string; count?: number }[] = [
    { id: "open", label: "Open", count: summary?.open }, { id: "mine", label: "Mine", count: summary?.mine },
    { id: "unassigned", label: "Unassigned", count: summary?.unassigned }, { id: "resolved", label: "Resolved" },
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* conversation list */}
      <aside className={cx("flex w-full shrink-0 flex-col border-r border-white/10 md:w-[340px]", activeId && "hidden md:flex")}>
        <div className="border-b border-white/10 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" className="pl-9" aria-label="Search conversations" />
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setFilter(t.id)} className={cx("shrink-0 rounded-full px-3 py-1 text-[12.5px] transition", filter === t.id ? "text-white" : "text-white/50 hover:text-white/80")} style={filter === t.id ? { background: accentTint(20), color: "var(--foreground)" } : undefined}>
                {t.label}{t.count ? <span className="ml-1.5 text-white/40">{t.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <div className="p-3"><Alert>{error}</Alert></div>}
          {!list && !error && <Spinner />}
          {list && list.length === 0 && <div className="px-6 py-16 text-center text-[13px] text-white/40">{dq ? "No conversations match your search." : filter === "resolved" ? "No resolved conversations yet." : "No conversations here yet. Messages from customers appear instantly."}</div>}
          {list?.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} className={cx("flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.04]", activeId === c.id && "bg-white/[0.07]")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[14px] font-semibold text-white">{(c.contact.name.replace("+", "")[0] ?? "?").toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cx("truncate text-[13.5px]", c.unread_count ? "font-semibold text-white" : "text-white/85")}>{c.contact.name}</span>
                  <span className="shrink-0 text-[11px] text-white/35">{timeAgo(c.last_message_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] text-white/45">{c.last_message_preview ?? "No messages yet"}</span>
                  {c.unread_count > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white btn-accent" style={{ background: ACCENT }}>{c.unread_count}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.inbox_status === "intervened" && <Badge tone="blue"><UserRound size={10} /> Human</Badge>}
                  {c.assigned_user && <Badge>{c.assigned_user.id === user_id ? "You" : c.assigned_user.name.split(" ")[0]}</Badge>}
                  {!c.window_open && <Badge tone="yellow"><Clock size={10} /> Template only</Badge>}
                  {c.labels.slice(0, 2).map((l) => <Badge key={l}>{l}</Badge>)}
                </div>
              </div>
            </button>
          ))}
          {list && total > list.length && <div className="p-3 text-center text-[12px] text-white/35">Showing {list.length} of {total}. Use search to narrow down.</div>}
        </div>
      </aside>

      {activeId ? (
        <Thread key={activeId} id={activeId} members={members} userId={user_id} onBack={() => open(null)} onChanged={loadList} />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState icon={<InboxIcon size={22} />} title="Select a conversation" body="Pick a chat on the left to reply, add notes or assign it to a teammate." />
        </div>
      )}
    </div>
  );
}

// ---- thread -------------------------------------------------------------------------------------------------------------------------------------------

function Thread({ id, members, userId, onBack, onChanged }: { id: string; members: Member[]; userId: string; onBack: () => void; onChanged: () => void }) {
  const { toast } = useUi();
  const { role } = useWorkspace();
  const canWrite = role !== "viewer";
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [windowOpen, setWindowOpen] = useState(true);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showTpl, setShowTpl] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [quick, setQuick] = useState<{ id: string; shortcut: string; text: string }[]>([]);
  const [panel, setPanel] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConv = useCallback(async () => {
    try { setConv(await inbox.get(id)); } catch (e) { setErr(errorMessage(e)); }
  }, [id]);
  const loadMsgs = useCallback(async () => {
    try {
      const r = await inbox.messages(id, { limit: 100 });
      setMsgs(r.items);
      setWindowOpen(r.window_open);
    } catch { /* keep the last good list */ }
  }, [id]);

  useEffect(() => { void loadConv(); inbox.read(id).then(onChanged).catch(() => {}); getSettings().then((s) => setQuick((s.settings.quick_replies as typeof quick) ?? [])).catch(() => {}); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  usePoll(loadMsgs, 3000, [id]);
  usePoll(async () => { await loadConv(); }, 15000, [id]);

  useEffect(() => { if (stick.current) bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  // mark read whenever something new arrives while the thread is open
  const lastIn = msgs?.filter((m) => m.direction === "in").at(-1)?.id;
  useEffect(() => { if (lastIn) inbox.read(id).then(onChanged).catch(() => {}); }, [lastIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (body: Parameters<typeof inbox.send>[1]) => {
    setSending(true);
    setErr(null);
    try {
      await inbox.send(id, body);
      stick.current = true;
      await Promise.all([loadMsgs(), loadConv()]);
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
      throw e;
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    try { await send({ type: mode === "note" ? "note" : "text", text: t }); setText(""); } catch { /* shown in banner */ }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setSending(true);
    setErr(null);
    try {
      const up = await inbox.upload(id, file);
      await send({ type: up.type, media_id: up.media_id, media_filename: up.filename, media_mime: up.mime, text: text.trim() || undefined });
      setText("");
    } catch (e) { setErr(errorMessage(e)); } finally { setSending(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const patch = async (b: Parameters<typeof inbox.patch>[1], ok?: string) => {
    try { await inbox.patch(id, b); await loadConv(); onChanged(); if (ok) toast(ok); } catch (e) { toast(errorMessage(e), "error"); }
  };

  const shortcutMatches = useMemo(() => (text.startsWith("/") ? quick.filter((q) => q.shortcut.toLowerCase().startsWith(text.slice(1).toLowerCase())).slice(0, 5) : []), [text, quick]);

  if (!conv) return <div className="flex-1">{err ? <div className="p-6"><Alert>{err}</Alert></div> : <Spinner />}</div>;
  const c = conv.contact;
  const blocked = mode === "reply" && !windowOpen;

  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <button onClick={onBack} className="rounded-md p-1 text-white/60 hover:bg-white/10 md:hidden" aria-label="Back to conversations"><X size={18} /></button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 font-semibold">{(c.name.replace("+", "")[0] ?? "?").toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold text-white">{c.name}</div>
            <div className="truncate text-[12px] text-white/45">+{c.phone}{c.opted_out && <span className="ml-2 text-red-300">opted out</span>}</div>
          </div>
          {canWrite && (
            <>
              <Select value={conv.assigned_user?.id ?? "none"} onChange={(e) => patch({ assigned_user_id: e.target.value === "none" ? null : e.target.value }, "Assignment updated")} className="!w-40 !py-1.5 text-[12.5px]" aria-label="Assign to">
                <option value="none">Unassigned</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === userId ? "Me" : m.full_name || m.email}</option>)}
              </Select>
              <label className="flex items-center gap-2 text-[12px] text-white/55" title="When on, your automations, flows and AI agent can reply in this chat">
                <Bot size={14} /> Bot <Toggle checked={conv.inbox_status === "bot"} onChange={(v) => patch({ inbox_status: v ? "bot" : "intervened" })} label="Automation for this conversation" />
              </label>
              <Button size="sm" variant={conv.status === "open" ? "soft" : "ghost"} onClick={() => patch({ status: conv.status === "open" ? "resolved" : "open" }, conv.status === "open" ? "Marked resolved" : "Reopened")}>
                {conv.status === "open" ? <><Check size={14} /> Resolve</> : "Reopen"}
              </Button>
            </>
          )}
          <button onClick={() => setPanel((p) => !p)} className="hidden rounded-md p-1.5 text-white/50 hover:bg-white/10 lg:block" aria-label="Toggle contact panel"><UserRound size={16} /></button>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(0,146,107,0.05),transparent_60%)] px-4 py-4"
          onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}>
          {!msgs && <Spinner />}
          {msgs?.length === 0 && <div className="py-16 text-center text-[13px] text-white/40">No messages yet. Say hello 👋</div>}
          {msgs?.map((m, i) => <Bubble key={m.id} m={m} prev={msgs[i - 1]} members={members} />)}
          <div ref={bottomRef} />
        </div>

        {err && <div className="px-4 pt-3"><Alert onClose={() => setErr(null)}>{err}</Alert></div>}

        {canWrite ? (
          <footer className="border-t border-white/10 p-3">
            {blocked && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-200">
                <span className="flex items-center gap-2"><AlertTriangle size={14} /> The 24-hour reply window has closed. Send an approved template to re-open the conversation.</span>
                <Button size="sm" onClick={() => setShowTpl(true)}><FileText size={13} /> Send template</Button>
              </div>
            )}
            {mode === "reply" && windowOpen && conv.window_expires_at && <div className="mb-1.5 text-[11px] text-white/35">Free-form replies allowed until {fmtDateTime(conv.window_expires_at)}</div>}
            <div className="mb-2 flex items-center gap-1">
              {(["reply", "note"] as const).map((k) => (
                <button key={k} onClick={() => setMode(k)} className={cx("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px]", mode === k ? "bg-white/10 text-white" : "text-white/45 hover:text-white/75")}>
                  {k === "reply" ? <Send size={12} /> : <StickyNote size={12} />} {k === "reply" ? "Reply" : "Private note"}
                </button>
              ))}
            </div>
            <div className="relative">
              {shortcutMatches.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full overflow-hidden rounded-lg border border-white/10 bg-surface shadow-xl">
                  {shortcutMatches.map((q) => (
                    <button key={q.id} onClick={() => setText(q.text)} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-white/[0.06]">
                      <Zap size={13} className="mt-1 text-amber-300" /><span className="min-w-0"><span className="text-[12.5px] font-medium text-white">/{q.shortcut}</span><span className="block truncate text-[12px] text-white/45">{q.text}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <div className={cx("flex items-end gap-2 rounded-xl border p-2", mode === "note" ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03]")}>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={blocked || sending} aria-label={mode === "note" ? "Private note" : "Message"}
                  placeholder={blocked ? "Window closed — use a template" : mode === "note" ? "Only your team can see this note…" : "Type a message… (type / for quick replies)"}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                  className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50" />
                <input ref={fileRef} type="file" hidden onChange={(e) => void onFile(e.target.files?.[0])} accept="image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/ogg,audio/aac,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                <button onClick={() => fileRef.current?.click()} disabled={blocked || sending || mode === "note"} className="rounded-md p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Attach file"><Paperclip size={17} /></button>
                <button onClick={() => setShowTpl(true)} disabled={sending || mode === "note"} className="rounded-md p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Send template"><FileText size={17} /></button>
                <button onClick={() => setShowPay(true)} disabled={sending || mode === "note"} className="rounded-md p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Request payment" title="Request payment"><IndianRupee size={17} /></button>
                <Button onClick={submit} loading={sending} disabled={!text.trim() || blocked}><Send size={15} /></Button>
              </div>
            </div>
          </footer>
        ) : <footer className="border-t border-white/10 p-3 text-center text-[12.5px] text-white/40">Your role is read-only.</footer>}
      </section>

      {panel && <ContactPanel conv={conv} onChanged={async () => { await loadConv(); onChanged(); }} canWrite={canWrite} />}
      <PaymentLinkModal open={showPay} onClose={() => setShowPay(false)} contact={{ id: c.id, name: c.name }} onInsert={(t) => { setMode("reply"); setText((prev) => (prev ? `${prev}
${t}` : t)); }} />
      <TemplateModal open={showTpl} onClose={() => setShowTpl(false)} contact={c} onSend={async (b) => { await send(b); setShowTpl(false); toast("Template sent"); }} />
    </div>
  );
}

// ---- message bubble -------------------------------------------------------------------------------------------------------------------------------------

function Ticks({ m }: { m: ChatMessage }) {
  if (m.status === "failed") return <AlertTriangle size={13} className="text-red-400" aria-label="Failed" />;
  if (m.status === "read") return <CheckCheck size={14} className="text-sky-400" aria-label="Read" />;
  if (m.status === "delivered") return <CheckCheck size={14} className="text-white/45" aria-label="Delivered" />;
  if (m.status === "sent") return <Check size={14} className="text-white/45" aria-label="Sent" />;
  return <Clock size={12} className="text-white/35" aria-label="Sending" />;
}

function Media({ m }: { m: ChatMessage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    inbox.mediaUrl(m.id).then((u) => { obj = u; if (alive) setUrl(u); }).catch(() => alive && setFailed(true));
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [m.id]);
  if (failed) return <div className="text-[12px] italic text-white/45">Media unavailable (it may have expired on WhatsApp).</div>;
  if (!url) return <div className="h-32 w-56 animate-pulse rounded-lg bg-white/10" />;
  if (m.type === "image" || m.type === "sticker") return <img src={url} alt={m.body ?? "Photo"} className="max-h-72 max-w-full rounded-lg" />;
  if (m.type === "video") return <video src={url} controls className="max-h-72 max-w-full rounded-lg" />;
  if (m.type === "audio") return <audio src={url} controls className="max-w-full" />;
  return <a href={url} download={m.media_filename ?? "file"} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[13px] underline"><FileText size={16} /> {m.media_filename ?? "Download file"}</a>;
}

function Bubble({ m, prev, members }: { m: ChatMessage; prev?: ChatMessage; members: Member[] }) {
  const out = m.direction === "out";
  const day = new Date(m.created_at).toDateString();
  const newDay = !prev || new Date(prev.created_at).toDateString() !== day;
  const sender = m.sender_type === "agent" ? members.find((x) => x.user_id === m.sender_user_id)?.full_name?.split(" ")[0] : { bot: "Auto-reply", ai: "AI agent", flow: "Flow", broadcast: "Campaign", api: "API" }[m.sender_type];
  return (
    <>
      {newDay && <div className="my-3 text-center text-[11px] text-white/30">{new Date(m.created_at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}</div>}
      <div className={cx("mb-1.5 flex", out ? "justify-end" : "justify-start")}>
        <div className={cx("max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] shadow-sm", m.is_internal ? "border border-amber-500/30 bg-amber-500/10 text-amber-100" : out ? "theme-fixed rounded-br-md text-white" : "rounded-bl-md bg-white/[0.08] text-white")}
          style={out && !m.is_internal ? { background: "#005c4b" } : undefined}>
          {m.is_internal && <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-300"><StickyNote size={11} /> Private note</div>}
          {out && !m.is_internal && sender && <div className="mb-0.5 text-[11px] font-medium text-emerald-200/70">{sender}</div>}
          {m.type === "template" && <div className="mb-1 flex items-center gap-1 text-[11px] text-white/50"><FileText size={11} /> Template · {String(m.payload.template ?? "")}</div>}
          {m.has_media && <div className="mb-1"><Media m={m} /></div>}
          {m.type === "location" && <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${String(m.payload.latitude)},${String(m.payload.longitude)}`}>📍 {m.body}</a>}
          {m.type === "reaction" ? <span>Reacted {m.body}</span> : m.body && m.type !== "location" && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
          {m.error && <div className="mt-1 text-[11.5px] text-red-300">{m.error}</div>}
          <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-white/40">
            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {out && !m.is_internal && <Ticks m={m} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ---- template picker ---------------------------------------------------------------------------------------------------------------------------------------

function TemplateModal({ open, onClose, contact, onSend }: { open: boolean; onClose: () => void; contact: ConversationDetail["contact"]; onSend: (b: Parameters<typeof inbox.send>[1]) => Promise<void> }) {
  const [list, setList] = useState<Template[] | null>(null);
  const [sel, setSel] = useState<Template | null>(null);
  const [vals, setVals] = useState<{ body: string[]; header_text: string; header_media: string; buttons: Record<string, string> }>({ body: [], header_text: "", header_media: "", buttons: {} });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open && !list) templatesApi.list({ status: "approved" }).then(setList).catch((e) => setErr(errorMessage(e))); }, [open, list]);
  const pick = (t: Template) => {
    setSel(t);
    setErr(null);
    setVals({ body: t.requires.body.map((n) => (n === 1 ? contact.name.split(" ")[0] : "")), header_text: "", header_media: "", buttons: {} });
  };
  const preview = sel ? sel.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => vals.body[Number(n) - 1] || `{{${n}}}`) : "";

  return (
    <Modal open={open} onClose={onClose} title={sel ? `Send “${sel.name}”` : "Send a template"} width={600}
      footer={sel ? <><Button variant="ghost" onClick={() => setSel(null)}>Back</Button><Button loading={busy} onClick={async () => {
        setBusy(true); setErr(null);
        try { await onSend({ type: "template", template_id: sel.id, variables: { body: vals.body, header_text: vals.header_text || undefined, header_media: vals.header_media || undefined, buttons: vals.buttons } }); setSel(null); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
      }}><Send size={14} /> Send</Button></> : undefined}>
      {err && <Alert>{err}</Alert>}
      {!sel && (!list ? <Spinner /> : list.length === 0 ? <div className="py-8 text-center text-[13px] text-white/50">No approved templates yet. <Link href="/dashboard/templates" className="underline">Create one</Link> or sync from WhatsApp.</div> : (
        <div className="space-y-2">{list.map((t) => (
          <button key={t.id} onClick={() => pick(t)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.07]">
            <div className="flex items-center justify-between"><span className="text-[13.5px] font-medium text-white">{t.name}</span><Badge>{t.category.toLowerCase()}</Badge></div>
            <p className="mt-1 line-clamp-2 text-[12.5px] text-white/50">{t.body}</p>
          </button>))}</div>
      ))}
      {sel && (
        <div className="space-y-3">
          {sel.requires.header_text && <Field label="Header value"><Input value={vals.header_text} onChange={(e) => setVals({ ...vals, header_text: e.target.value })} /></Field>}
          {sel.requires.header_media && <Field label={`Header ${sel.requires.header_media} URL`} hint="A public https link to the file"><Input value={vals.header_media} onChange={(e) => setVals({ ...vals, header_media: e.target.value })} placeholder="https://…" /></Field>}
          {sel.requires.body.map((n, i) => <Field key={n} label={`Variable {{${n}}}`}><Input value={vals.body[i] ?? ""} onChange={(e) => { const b = [...vals.body]; b[i] = e.target.value; setVals({ ...vals, body: b }); }} /></Field>)}
          {sel.requires.buttons.map((i) => <Field key={i} label={`Button ${i + 1} URL value`}><Input value={vals.buttons[String(i)] ?? ""} onChange={(e) => setVals({ ...vals, buttons: { ...vals.buttons, [String(i)]: e.target.value } })} /></Field>)}
          <div className="rounded-xl bg-[#005c4b]/40 p-3 text-[13px] text-white/90"><div className="mb-1 text-[11px] uppercase tracking-wide text-white/40">Preview</div><div className="whitespace-pre-wrap">{preview}</div>{sel.footer && <div className="mt-2 text-[11.5px] text-white/45">{sel.footer}</div>}</div>
        </div>
      )}
    </Modal>
  );
}

// ---- contact side panel -----------------------------------------------------------------------------------------------------------------------------------------

function ContactPanel({ conv, onChanged, canWrite }: { conv: ConversationDetail; onChanged: () => void; canWrite: boolean }) {
  const { toast } = useUi();
  const c = conv.contact;
  const [tag, setTag] = useState("");
  const [label, setLabel] = useState("");

  const saveTags = async (tags: string[]) => { try { await contactsApi.update(c.id, { tags }); onChanged(); } catch (e) { toast(errorMessage(e), "error"); } };
  const saveLabels = async (labels: string[]) => { try { await inbox.patch(conv.id, { labels }); onChanged(); } catch (e) { toast(errorMessage(e), "error"); } };
  const addTag = () => { const t = tag.trim(); if (t && !c.tags.includes(t)) void saveTags([...c.tags, t]); setTag(""); };
  const addLabel = () => { const l = label.trim(); if (l && !conv.labels.includes(l)) void saveLabels([...conv.labels, l]); setLabel(""); };
  const ad = c.ad_attribution ?? {};

  return (
    <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-white/10 p-4 lg:block">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[24px] font-semibold">{(c.name.replace("+", "")[0] ?? "?").toUpperCase()}</div>
        <div className="mt-2 text-[15px] font-semibold text-white">{c.name}</div>
        <div className="text-[12.5px] text-white/50">+{c.phone}</div>
        {c.email && <div className="text-[12.5px] text-white/50">{c.email}</div>}
      </div>

      <Section title="Labels (this chat)">
        <Chips items={conv.labels} onRemove={canWrite ? (l) => saveLabels(conv.labels.filter((x) => x !== l)) : undefined} />
        {canWrite && <Input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLabel()} placeholder="Add label + Enter" className="mt-2 !py-1.5 text-[12.5px]" />}
      </Section>
      <Section title="Deals"><ContactDeals contact={{ id: c.id, name: c.name }} canWrite={canWrite} /></Section>
      <Section title="Contact tags">
        <Chips items={c.tags} onRemove={canWrite ? (t) => saveTags(c.tags.filter((x) => x !== t)) : undefined} />
        {canWrite && <Input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Add tag + Enter" className="mt-2 !py-1.5 text-[12.5px]" />}
      </Section>
      {Object.keys(c.traits).length > 0 && (
        <Section title="Details">
          <dl className="space-y-1.5 text-[12.5px]">{Object.entries(c.traits).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-white/45">{k}</dt><dd className="truncate text-right text-white/85">{String(v)}</dd></div>)}</dl>
        </Section>
      )}
      <Section title="Source">
        <div className="text-[12.5px] text-white/70">{c.source}{ad.headline && <div className="mt-1 rounded-lg bg-white/[0.05] p-2 text-[12px]">Ad: {ad.headline}{ad.source_url && <a href={ad.source_url} target="_blank" rel="noreferrer" className="ml-1 text-sky-300 underline">view</a>}</div>}</div>
        <div className="mt-1 text-[11.5px] text-white/35">Customer since {new Date(c.created_at).toLocaleDateString()}</div>
      </Section>
      {conv.events.length > 0 && (
        <Section title="Recent events">
          <ul className="space-y-1.5 text-[12.5px]">{conv.events.slice(0, 6).map((e, i) => <li key={i} className="flex justify-between gap-2"><span className="text-white/80">{e.name}</span><span className="text-white/35">{timeAgo(e.at)}</span></li>)}</ul>
        </Section>
      )}
      {canWrite && (
        <Section title="Messaging consent">
          <label className="flex items-center justify-between text-[12.5px] text-white/70">Opted out of marketing<Toggle checked={c.opted_out} onChange={async (v) => { try { await contactsApi.update(c.id, { opted_out: v }); onChanged(); toast(v ? "Marked as opted out" : "Opted in again"); } catch (e) { toast(errorMessage(e), "error"); } }} label="Opted out" /></label>
        </Section>
      )}
      <Link href="/dashboard/contacts" className="mt-4 block text-center text-[12.5px] text-sky-300 hover:underline">Open in Contacts →</Link>
    </aside>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-5"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/35">{title}</div>{children}</div>;
}
function Chips({ items, onRemove }: { items: string[]; onRemove?: (v: string) => void }) {
  if (items.length === 0) return <div className="text-[12px] text-white/30">None yet</div>;
  return <div className="flex flex-wrap gap-1.5">{items.map((i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] text-white/80">{i}{onRemove && <button onClick={() => onRemove(i)} aria-label={`Remove ${i}`} className="text-white/40 hover:text-white"><X size={11} /></button>}</span>)}</div>;
}

