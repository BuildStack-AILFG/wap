"use client";

import { useState } from "react";
import { MARKETING } from "@/lib/marketing/designTokens";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Slider({ id, label, value, min, max, step, onChange, format }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-white">{label}</label>
        <span className="text-[15px] font-bold tabular-nums text-brand">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
    </div>
  );
}

/** Missed-revenue estimate from the visitor's own numbers. No benchmarks or claims of ours go into the result. */
export default function RevenueCalculator({ startPrice }: { startPrice: number }) {
  const [leads, setLeads] = useState(300);
  const [missed, setMissed] = useState(30);
  const [close, setClose] = useState(10);
  const [deal, setDeal] = useState(15000);
  const lost = leads * (missed / 100) * (close / 100) * deal;
  const lostDeals = leads * (missed / 100) * (close / 100);
  const months = startPrice > 0 ? deal / startPrice : 0;

  return (
    <section id="calculator" className={`${MARKETING.section} bg-black`}>
      <div className={MARKETING.container}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className={MARKETING.overline}>What slow replies cost you</p>
            <h2 className={`${MARKETING.h2} mt-3`}>How much revenue is waiting in your unanswered chats?</h2>
            <p className={`${MARKETING.body} mt-4`}>
              Move the sliders to match your business. The estimate uses only your numbers: leads that got no reply or a late one, times
              how often you close a lead you answer well, times your average sale.
            </p>
          </div>

          <div className={`${MARKETING.card} p-6 sm:p-8`}>
            <div className="space-y-6">
              <Slider id="calc-leads" label="WhatsApp leads per month" value={leads} min={20} max={5000} step={10} onChange={setLeads} format={(v) => v.toLocaleString("en-IN")} />
              <Slider id="calc-missed" label="Leads that get no reply or a late one" value={missed} min={5} max={80} step={5} onChange={setMissed} format={(v) => `${v}%`} />
              <Slider id="calc-close" label="Of leads you answer quickly, how many buy" value={close} min={1} max={50} step={1} onChange={setClose} format={(v) => `${v}%`} />
              <Slider id="calc-deal" label="Average sale value" value={deal} min={500} max={500000} step={500} onChange={setDeal} format={inr} />
            </div>
            <div className="mt-8 rounded-2xl border border-brand/30 bg-brand/10 p-5" aria-live="polite">
              <p className="text-[13px] text-white/60">Estimated sales slipping away every month</p>
              <p className="mt-1 text-[2.25rem] font-extrabold tracking-[-0.03em] text-white tabular-nums" style={{ fontFamily: "var(--font-plus-jakarta)" }}>{inr(lost)}</p>
              <p className="mt-1 text-[13px] text-white/60">About {lostDeals < 10 && !Number.isInteger(Math.round(lostDeals * 10) / 10) ? lostDeals.toFixed(1) : Math.round(lostDeals)} sale{Math.round(lostDeals) === 1 ? "" : "s"} a month.
                {months >= 1 && <> Winning back just one of them pays for about {Math.floor(months)} month{Math.floor(months) === 1 ? "" : "s"} of TalkForGrow.</>}</p>
            </div>
            <p className="mt-3 text-[11.5px] text-white/35">An estimate from the numbers you entered, not a promise of results.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
