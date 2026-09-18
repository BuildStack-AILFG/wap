import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    desc: "For solo sellers getting started with WhatsApp automation.",
    features: ["1 WhatsApp number", "Auto-replies & 1 chat flow", "500 broadcast contacts", "Shared inbox (2 seats)"],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$49",
    period: "/mo",
    desc: "For teams running broadcasts and multi-step flows daily.",
    features: [
      "3 WhatsApp numbers",
      "Unlimited chat flows",
      "10,000 broadcast contacts",
      "Shared inbox (10 seats)",
      "AI-assisted replies",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For high-volume support and sales teams at scale.",
    features: ["Unlimited numbers & seats", "Priority delivery throughput", "Dedicated onboarding", "SLA & priority support"],
    highlighted: false,
  },
];

export default function HomePricingSection() {
  return (
    <section id="pricing" className="relative bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Pricing</p>
        <h2
          className="mt-3 text-[1.75rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#111827] sm:text-[2.15rem]"
          style={{ fontFamily: "var(--font-plus-jakarta)" }}
        >
          Simple, Transparent Pricing
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#64748B]">
          Every plan runs on the official WhatsApp Business API — even your free trial.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-7 ${
              plan.highlighted ? "border-emerald-700 bg-[#0B1712] text-white shadow-xl" : "border-emerald-100/80 bg-white"
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-7 rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-bold text-[#0B1712]">
                Most popular
              </span>
            )}
            <h3 className={`text-[15px] font-bold ${plan.highlighted ? "text-white" : "text-[#111827]"}`}>{plan.name}</h3>
            <p className={`mt-3 flex items-end gap-1 ${plan.highlighted ? "text-white" : "text-[#111827]"}`}>
              <span className="text-[2.4rem] font-extrabold leading-none tracking-tight">{plan.price}</span>
              <span className={`text-sm font-semibold ${plan.highlighted ? "text-[#9CA3A0]" : "text-[#94A3B8]"}`}>
                {plan.period}
              </span>
            </p>
            <p className={`mt-2 text-[13.5px] leading-relaxed ${plan.highlighted ? "text-[#9CA3A0]" : "text-[#64748B]"}`}>
              {plan.desc}
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className={`flex items-center gap-2.5 text-[13.5px] ${plan.highlighted ? "text-[#D1D5D2]" : "text-[#374151]"}`}>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      plan.highlighted ? "bg-white/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="#get-started"
              className={`mt-8 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold transition-transform hover:-translate-y-0.5 ${
                plan.highlighted ? "bg-emerald-500 text-[#0B1712]" : "bg-[#111827] text-white"
              }`}
            >
              Choose {plan.name}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
