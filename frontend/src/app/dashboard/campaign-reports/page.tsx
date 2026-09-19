"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Send, CheckCheck, XCircle, Megaphone } from "lucide-react";
import { listBroadcasts, ApiError, type ApiBroadcast } from "@/lib/api";

const ACCENT = "#00926B";

function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export default function CampaignReportsPage() {
  const [broadcasts, setBroadcasts] = useState<ApiBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBroadcasts()
      .then(setBroadcasts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load campaign data."))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(() => {
    const sent = broadcasts.reduce((n, b) => n + b.sent, 0);
    const delivered = broadcasts.reduce((n, b) => n + b.delivered, 0);
    const failed = broadcasts.reduce((n, b) => n + b.failed, 0);
    return { campaigns: broadcasts.length, sent, delivered, failed, deliveryRate: rate(delivered, sent) };
  }, [broadcasts]);

  const cards = [
    { label: "Campaigns", value: totals.campaigns.toLocaleString(), icon: Megaphone, color: ACCENT },
    { label: "Messages sent", value: totals.sent.toLocaleString(), icon: Send, color: "#60A5FA" },
    { label: "Delivery rate", value: `${totals.deliveryRate}%`, icon: CheckCheck, color: ACCENT },
    { label: "Failed", value: totals.failed.toLocaleString(), icon: XCircle, color: "#F87171" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
          <BarChart3 className="h-5 w-5" style={{ color: ACCENT }} />
        </span>
        <div>
          <h1 className="text-[20px] font-bold text-white">Campaign Reports</h1>
          <p className="text-[13.5px] text-white/50">How your broadcasts performed — sent, delivered, and failed.</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}26` }}>
              <c.icon className="h-4 w-4" style={{ color: c.color }} />
            </span>
            <p className="mt-2 text-[22px] font-bold text-white">{loading ? "—" : c.value}</p>
            <p className="text-[12px] text-white/50">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-[11.5px] font-semibold uppercase tracking-wide text-white/40">
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Failed</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const deliveryRate = rate(b.delivered, b.sent);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                  <td className="px-4 py-3 text-white/50">{b.audience.type === "all_contacts" ? "All contacts" : `Tag: ${b.audience.tag}`}</td>
                  <td className="px-4 py-3 text-white/50">{b.sent.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${deliveryRate}%`, backgroundColor: ACCENT }} />
                      </div>
                      <span className="text-white/70">{deliveryRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50">{b.failed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white/50">{b.created_at.slice(0, 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && broadcasts.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] text-white/50">No campaigns yet — reports appear here after your first broadcast.</p>
            <Link href="/dashboard/broadcasts" className="mt-3 inline-block text-[13px] font-semibold" style={{ color: ACCENT }}>
              Create a broadcast →
            </Link>
          </div>
        )}
        {loading && <p className="px-4 py-10 text-center text-[13.5px] text-white/50">Loading campaign data…</p>}
      </div>
    </div>
  );
}
