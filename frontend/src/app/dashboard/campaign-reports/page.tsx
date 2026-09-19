"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, fmtDateTime, Page, PageHeader, Select, Spinner, Stat, statusTone } from "@/components/ui/kit";
import { Funnel } from "@/components/ui/charts";
import { broadcasts, errorMessage, type Broadcast } from "@/lib/api";

export default function CampaignReportsPage() {
  const [list, setList] = useState<Broadcast[] | null>(null);
  const [range, setRange] = useState(30);
  const [now] = useState(() => Date.now());
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { broadcasts.list().then(setList).catch((e) => setErr(errorMessage(e, "Couldn't load campaign reports."))); }, []);

  const rows = useMemo(() => (list ?? []).filter((b) => b.status !== "draft" && now - new Date(b.created_at).getTime() < range * 86400000), [list, range, now]);
  const t = useMemo(() => rows.reduce((a, b) => ({ recipients: a.recipients + b.total_recipients, sent: a.sent + b.sent, delivered: a.delivered + b.delivered, read: a.read + b.read, replied: a.replied + b.replied, failed: a.failed + b.failed }), { recipients: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 }), [rows]);
  const pct = (n: number) => (t.sent ? `${((n / t.sent) * 100).toFixed(1)}%` : "—");

  return (
    <Page>
      <PageHeader icon={<BarChart3 size={20} />} title="Campaign reports" subtitle="Delivery, reads and replies across your broadcasts. Numbers update live as WhatsApp reports back."
        actions={<><Select value={range} onChange={(e) => setRange(Number(e.target.value))} className="!w-40" aria-label="Date range"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={3650}>All time</option></Select><Link href="/dashboard/broadcasts"><Button variant="ghost">Open campaigns</Button></Link></>} />
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {!list ? <Spinner /> : rows.length === 0 ? <EmptyState icon={<BarChart3 size={22} />} title="No campaigns in this period" body="Send a broadcast and its results appear here." action={<Link href="/dashboard/broadcasts?new=1"><Button>New campaign</Button></Link>} /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Campaigns" value={rows.length} /><Stat label="Messages sent" value={t.sent.toLocaleString()} sub={`${t.recipients.toLocaleString()} recipients`} /><Stat label="Delivered" value={pct(t.delivered)} /><Stat label="Read" value={pct(t.read)} /><Stat label="Replied" value={pct(t.replied)} sub={t.failed ? `${t.failed} failed` : undefined} tone={undefined} /></div>
          <Card className="p-5"><h3 className="mb-4 text-[14.5px] font-semibold text-white">Overall funnel</h3><Funnel steps={[{ label: "Sent", value: t.sent }, { label: "Delivered", value: t.delivered }, { label: "Read", value: t.read, color: "#38bdf8" }, { label: "Replied", value: t.replied, color: "#a78bfa" }]} /></Card>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-[13px]"><thead className="border-b border-white/10 text-[11.5px] uppercase tracking-wide text-white/40"><tr><th className="px-5 py-3">Campaign</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Sent</th><th className="px-2 py-3">Delivered</th><th className="px-2 py-3">Read</th><th className="px-2 py-3">Replied</th><th className="px-2 py-3">Failed</th><th className="px-5 py-3">Date</th></tr></thead>
              <tbody>{rows.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.03]"><td className="px-5 py-3"><div className="font-medium text-white">{b.name}</div><div className="text-[11.5px] text-white/40">{b.template_name}</div></td>
                  <td className="px-2 py-3"><Badge tone={statusTone(b.status)}>{b.status}</Badge></td><td className="px-2 py-3 text-white/80">{b.sent.toLocaleString()}</td>
                  <td className="px-2 py-3 text-white/70">{b.delivered_pct}%</td><td className="px-2 py-3 text-white/70">{b.read_pct}%</td><td className="px-2 py-3 text-white/70">{b.replied_pct}%</td>
                  <td className="px-2 py-3">{b.failed ? <span className="text-red-300">{b.failed}</span> : <span className="text-white/35">0</span>}</td><td className="px-5 py-3 text-white/45">{fmtDateTime(b.started_at ?? b.created_at)}</td></tr>))}</tbody></table>
          </Card>
          <div className="flex justify-end"><Button variant="ghost" onClick={() => rows.forEach((b, i) => setTimeout(() => void broadcasts.exportCsv(b.id), i * 400))}><Download size={14} /> Export all recipient reports</Button></div>
        </div>
      )}
    </Page>
  );
}
