"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Bot, CheckCircle2, Circle, ClipboardCheck, FileText, Inbox, LayoutGrid, Megaphone, Smartphone, Workflow } from "lucide-react";
import { ACCENT, Card, cx, fmtDuration, Page, Spinner, Stat } from "@/components/ui/kit";
import { BarChart } from "@/components/ui/charts";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";
import { ai, analytics, broadcasts, contacts, flows, inbox, templates, whatsapp, widgets, type Analytics } from "@/lib/api";

type Setup = { number: boolean; contact: boolean; template: boolean; campaign: boolean; flow: boolean; ai: boolean; widget: boolean; unread: number };

export default function DashboardHome() {
  const me = useWorkspace();
  const [s, setS] = useState<Setup | null>(null);
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
    Promise.all([
      safe(whatsapp.list(), []), safe(contacts.list({ limit: 1 }), { total: 0, items: [] }), safe(templates.list({ status: "approved" }), []), safe(broadcasts.list(), []),
      safe(flows.list(), []), safe(ai.config(), null), safe(widgets.list(), []), safe(inbox.summary(), null),
    ]).then(([acc, c, t, b, f, aiCfg, w, sum]) => setS({
      number: acc.some((x) => x.status === "connected"), contact: c.total > 0, template: t.length > 0, campaign: b.some((x) => x.status !== "draft"),
      flow: f.some((x) => x.status === "published"), ai: !!aiCfg?.enabled, widget: w.some((x) => x.enabled), unread: sum?.unread_conversations ?? 0,
    }));
    analytics.overview(7).then(setA).catch(() => {});
  }, []);

  const name = me.full_name?.trim().split(" ")[0] || me.workspace.name;
  const steps = s ? [
    { done: s.number, title: "Connect your WhatsApp number", body: "Link your WhatsApp Business number to start sending and receiving.", href: "/dashboard/whatsapp", icon: Smartphone },
    { done: s.contact, title: "Add contacts", body: "Import a CSV or add people — anyone who messages you is added automatically.", href: "/dashboard/contacts", icon: ClipboardCheck },
    { done: s.template, title: "Get a template approved", body: "Templates let you start conversations and run campaigns.", href: "/dashboard/templates", icon: FileText },
    { done: s.campaign, title: "Send your first campaign", body: "Reach a group of contacts with an approved template.", href: "/dashboard/broadcasts?new=1", icon: Megaphone },
    { done: s.flow, title: "Publish an automation flow", body: "Qualify leads and answer questions automatically.", href: "/dashboard/flow-builder", icon: Workflow },
    { done: s.ai, title: "Turn on the AI agent", body: "Let AI answer from your knowledge base.", href: "/dashboard/ai-agent", icon: Bot },
    { done: s.widget, title: "Add the website chat widget", body: "Turn website visitors into WhatsApp conversations.", href: "/dashboard/widget", icon: LayoutGrid },
  ] : [];
  const doneCount = steps.filter((x) => x.done).length;
  const next = steps.find((x) => !x.done);
  const week = (k: "inbound" | "outbound") => (a?.messages ?? []).reduce((t, d) => t + d[k], 0);

  return (
    <Page>
      <h1 className="text-[22px] font-bold text-white">Hello 👋 Welcome, {name}!</h1>
      <p className="mt-1 text-[14px] text-white/50">{s && doneCount === steps.length ? "You're all set up. Here's how things are going." : "Let's get your WhatsApp Business number automated."}</p>

      {s?.unread ? (
        <Link href="/dashboard/inbox" className="mt-5 flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 hover:bg-sky-500/15">
          <span className="flex items-center gap-3 text-[14px] font-medium text-white"><Inbox size={18} className="text-sky-300" /> {s.unread} conversation{s.unread === 1 ? "" : "s"} waiting for a reply</span><ArrowRight size={16} className="text-sky-300" /></Link>
      ) : null}

      {!s ? <Spinner /> : doneCount < steps.length && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 p-6" style={{ backgroundImage: `linear-gradient(90deg, #000000, ${ACCENT}33)` }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-[16px] font-bold text-white">Setup progress · {doneCount} of {steps.length}</p><p className="mt-1 text-[13px] text-white/50">{next ? `Next: ${next.title}` : ""}</p></div>
            {next && <Link href={next.href} className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: ACCENT }}>{next.title} <ArrowRight size={14} /></Link>}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%`, background: ACCENT }} /></div>
        </div>
      )}

      {s && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {steps.map((st) => (
            <Link key={st.title} href={st.href} className={cx("flex items-start gap-3 rounded-2xl border p-4 transition hover:bg-white/[0.05]", st.done ? "border-white/5 bg-white/[0.015] opacity-70" : "border-white/10 bg-white/[0.03]")}>
              {st.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: ACCENT }} /> : <Circle size={20} className="mt-0.5 shrink-0 text-white/25" />}
              <div className="min-w-0 flex-1"><div className={cx("text-[14px] font-semibold", st.done ? "text-white/60 line-through decoration-white/20" : "text-white")}>{st.title}</div><div className="text-[12.5px] text-white/45">{st.body}</div></div>
              <st.icon size={18} className="mt-0.5 shrink-0 text-white/30" />
            </Link>))}
        </div>
      )}

      {a && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-semibold text-white">Last 7 days</h2><Link href="/dashboard/conversation-analytics" className="flex items-center gap-1 text-[12.5px] text-sky-300 hover:underline"><BarChart3 size={13} /> Full analytics</Link></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Messages received" value={week("inbound").toLocaleString()} /><Stat label="Messages sent" value={week("outbound").toLocaleString()} sub={`${a.delivery.delivered_pct}% delivered`} />
            <Stat label="Avg. first response" value={fmtDuration(a.first_response.avg_seconds)} /><Stat label="Contacts" value={a.contacts.total.toLocaleString()} sub={`${a.contacts.opted_out} opted out`} />
          </div>
          <Card className="mt-4 p-5"><BarChart height={150} data={a.messages} series={[{ key: "inbound", label: "Received", color: "#38bdf8" }, { key: "outbound", label: "Sent", color: "#00926B" }]} /></Card>
        </div>
      )}
    </Page>
  );
}
