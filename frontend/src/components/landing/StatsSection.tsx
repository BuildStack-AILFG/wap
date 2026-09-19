import { MARKETING } from "@/lib/marketing/designTokens";

const STATS = [
  { value: "89%", label: "Higher Average CSAT" },
  { value: "133%", label: "Higher Agent Efficiency" },
  { value: "60%", label: "Faster Response Times" },
  { value: "75%", label: "Boost in Customer Engagement" },
];

export default function StatsSection() {
  return (
    <section id="why-us" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={MARKETING.overline}>What Sets Us Apart?</p>
          <h2 className={`${MARKETING.h2} mt-3`}>Businesses Using WhatsApp Automation Like This See Measurable Impact</h2>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="text-[2.25rem] font-extrabold tracking-[-0.03em] text-[#00926B] sm:text-[2.75rem]"
                style={{ fontFamily: "var(--font-plus-jakarta)" }}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-white/60 sm:text-[14px]">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[12px] leading-relaxed text-white/40">
          *Typical results reported by businesses running WhatsApp-first conversational automation — shared here as
          an industry benchmark, not an audited LeadForGrow customer result.
        </p>

        <p className={`${MARKETING.body} mx-auto mt-6 max-w-2xl text-center`}>
          A simple, transparent, and powerful platform, built to scale with your business!
        </p>
      </div>
    </section>
  );
}
