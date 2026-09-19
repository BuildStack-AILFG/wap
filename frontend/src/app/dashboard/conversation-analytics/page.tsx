"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Alert, Card, fmtDuration, Page, PageHeader, Select, Spinner, Stat } from "@/components/ui/kit";
import { BarChart, Funnel } from "@/components/ui/charts";
import { analytics, errorMessage, type Analytics } from "@/lib/api";

export default function ConversationAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [a, setA] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setA(null); analytics.overview(days).then(setA).catch((e) => setErr(errorMessage(e, "Couldn't load analytics."))); }, [days]);
  const sum = <T extends { date: string }>(rows: (T & Record<string, number | string>)[] | undefined, k: string) => (rows ?? []).reduce((s, r) => s + (Number(r[k]) || 0), 0);

  return (
    <Page>
      <PageHeader icon={<BarChart3 size={20} />} title="Conversation analytics" subtitle="How your inbox is performing: volume, response time, delivery and your team's workload."
        actions={<Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="!w-40" aria-label="Date range"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></Select>} />
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {!a ? <Spinner /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Messages received" value={sum(a.messages, "inbound").toLocaleString()} sub={`${sum(a.conversations_started, "count")} new conversations`} />
            <Stat label="Messages sent" value={sum(a.messages, "outbound").toLocaleString()} sub={`${a.delivery.delivered_pct}% delivered · ${a.delivery.read_pct}% read`} />
            <Stat label="Avg. first response" value={fmtDuration(a.first_response.avg_seconds)} sub={`${a.first_response.conversations} conversations measured`} />
            <Stat label="Open conversations" value={a.conversations.open} sub={`${a.conversations.unassigned} unassigned · ${a.conversations.human_handled} with a human`} tone={a.conversations.unassigned > 10 ? "red" : undefined} />
          </div>
          <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">Messages per day</h3><BarChart data={a.messages} series={[{ key: "inbound", label: "Received", color: "#38bdf8" }, { key: "outbound", label: "Sent", color: "#00926B" }]} /></Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">New conversations</h3><BarChart height={140} data={a.conversations_started} series={[{ key: "count", label: "Conversations", color: "#a78bfa" }]} /></Card>
            <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">New contacts</h3><BarChart height={140} data={a.new_contacts} series={[{ key: "count", label: "Contacts", color: "#fbbf24" }]} /></Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">Delivery of outgoing messages</h3><Funnel steps={[{ label: "Sent", value: a.delivery.sent }, { label: "Delivered", value: a.delivery.delivered }, { label: "Read", value: a.delivery.read, color: "#38bdf8" }, { label: "Failed", value: a.delivery.failed, color: "#ef4444" }]} /></Card>
            <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">Team activity</h3>
              {a.agents.length === 0 ? <p className="text-[13px] text-white/40">No agent replies in this period yet.</p> : <div className="space-y-2">{a.agents.map((g) => <div key={g.user_id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-[13px]"><span className="text-white/85">{g.name}</span><span className="text-white/50"><b className="text-white">{g.messages}</b> messages · {g.conversations} chats</span></div>)}</div>}</Card>
          </div>
          <Card className="p-5"><h3 className="mb-3 text-[14.5px] font-semibold text-white">Contacts</h3><div className="flex flex-wrap gap-8 text-[13px] text-white/60"><span><b className="text-[20px] text-white">{a.contacts.total.toLocaleString()}</b> total</span><span><b className="text-[20px] text-white">{a.contacts.opted_out.toLocaleString()}</b> opted out</span></div></Card>
        </div>
      )}
    </Page>
  );
}
