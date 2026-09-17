import { ArrowUpRightIcon, CheckIcon } from "./icons";

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
    features: ["3 WhatsApp numbers", "Unlimited chat flows", "10,000 broadcast contacts", "Shared inbox (10 seats)", "AI-assisted replies"],
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

export default function Pricing() {
  return (
    <section id="pricing" className="bg-[#FAFDFA] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">Pricing</p>
          <h2 className="mt-3 text-[1.9rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.4rem]">
            Simple pricing, built to scale with your chats
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                plan.highlighted
                  ? "border-[#0F5132] bg-[#0B1712] text-white shadow-xl"
                  : "border-emerald-950/8 bg-white"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-[#25D366] px-3 py-1 text-[11px] font-bold text-[#0B1712]">
                  Most popular
                </span>
              )}
              <h3 className={`text-[15px] font-bold ${plan.highlighted ? "text-white" : "text-[#0B1712]"}`}>
                {plan.name}
              </h3>
              <p className={`mt-3 flex items-end gap-1 ${plan.highlighted ? "text-white" : "text-[#0B1712]"}`}>
                <span className="text-[2.4rem] font-extrabold leading-none tracking-tight">{plan.price}</span>
                <span className={`text-sm font-semibold ${plan.highlighted ? "text-[#9CA3A0]" : "text-[#94A3A0]"}`}>
                  {plan.period}
                </span>
              </p>
              <p className={`mt-2 text-[13.5px] leading-relaxed ${plan.highlighted ? "text-[#9CA3A0]" : "text-[#5B6C64]"}`}>
                {plan.desc}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-center gap-2.5 text-[13.5px] ${
                      plan.highlighted ? "text-[#D1D5D2]" : "text-[#374943]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted ? "bg-white/10 text-[#34D399]" : "bg-[#25D366]/15 text-[#0F5132]"
                      }`}
                    >
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#get-started"
                className={`mt-8 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold transition-transform hover:-translate-y-0.5 ${
                  plan.highlighted ? "bg-[#25D366] text-[#0B1712]" : "bg-[#0B1712] text-white"
                }`}
              >
                Choose {plan.name}
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
