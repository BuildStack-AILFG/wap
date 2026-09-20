"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { fmtLimit, GST_PERCENT, inr, PERIODS, PLANS, savingPercent, type Period } from "@/lib/site/plans";

const ROWS: { label: string; key: keyof (typeof PLANS)[number]["limits"] }[] = [
  { label: "WhatsApp numbers", key: "numbers" },
  { label: "Team seats", key: "seats" },
  { label: "Contacts", key: "contacts" },
  { label: "Campaign recipients / month", key: "campaign" },
  { label: "Automation flows", key: "flows" },
  { label: "AI replies / month", key: "ai" },
  { label: "AI knowledge sources", key: "knowledge" },
];

export default function PricingTable() {
  const [period, setPeriod] = useState<Period>("yearly");
  const months = PERIODS.find((p) => p.id === period)!.months;

  return (
    <div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <div role="tablist" aria-label="Billing period" className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {PERIODS.map((p) => (
            <button key={p.id} role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-4 py-2 text-[14px] font-medium transition ${period === p.id ? "btn-accent bg-brand text-white" : "text-white/60 hover:text-white"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-white/50">Save up to {savingPercent(PLANS[0], "yearly")}% with yearly billing · Prices in ₹ per month, excluding {GST_PERCENT}% GST</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const price = p.perMonth?.[period];
          const save = savingPercent(p, period);
          return (
            <div key={p.id} className={`relative flex flex-col rounded-2xl border p-6 ${p.highlight ? "border-brand bg-brand/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
              {p.highlight && <span className="btn-accent absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-[11px] font-semibold text-white">Most popular</span>}
              <h3 className="text-[18px] font-bold text-white">{p.name}</h3>
              <p className="mt-1 min-h-[40px] text-[13.5px] leading-snug text-white/55">{p.blurb}</p>
              {price ? (
                <div className="mt-5">
                  <p className="flex items-baseline gap-1"><span className="text-[34px] font-bold tracking-tight text-white">{inr(price)}</span><span className="text-[13px] text-white/45">/ month</span></p>
                  <p className="mt-1 text-[12px] text-white/40">{period === "monthly" ? "Billed monthly" : `Billed ${inr(price * months)} every ${months} months`} + GST{save > 0 && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">Save {save}%</span>}</p>
                </div>
              ) : <p className="mt-5 text-[28px] font-bold text-white">Custom</p>}
              <Link href={price ? "/signup" : "/contact?topic=sales"} className={`mt-5 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-[14.5px] font-semibold transition ${p.highlight ? "btn-accent bg-brand text-white hover:bg-brand-hover" : "border border-white/15 bg-white/[0.05] text-white hover:bg-white/10"}`}>
                {price ? "Start free trial" : "Talk to sales"}
              </Link>
              <ul className="mt-6 space-y-2.5 text-[13.5px] text-white/70">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-brand" />{f}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-14 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <caption className="sr-only">Plan limits compared</caption>
          <thead className="bg-white/[0.05] text-[12.5px] uppercase tracking-wide text-white/50">
            <tr><th scope="col" className="px-5 py-3 font-semibold">Limits</th>{PLANS.map((p) => <th key={p.id} scope="col" className="px-5 py-3 font-semibold">{p.name}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-t border-white/10">
                <th scope="row" className="px-5 py-3 font-medium text-white">{r.label}</th>
                {PLANS.map((p) => <td key={p.id} className="px-5 py-3 text-white/70">{fmtLimit(p.limits[r.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
