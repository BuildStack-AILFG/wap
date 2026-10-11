import { BadgeIndianRupee, CreditCard, LayoutGrid, Receipt, Rocket, ShieldCheck } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

/** Plain statements of how we sell: every one is true of our pricing and onboarding today. */
export default function ValueStrip({ startPrice, trialDays }: { startPrice: number; trialDays: number }) {
  const items = [
    { icon: BadgeIndianRupee, title: `From ₹${startPrice.toLocaleString("en-IN")}/month`, body: "Clear published prices in rupees. No setup or build fee." },
    { icon: LayoutGrid, title: "Every feature on every paid plan", body: "AI agent, follow-ups, lead scoring, flows and integrations. Plans differ only in volume." },
    { icon: CreditCard, title: `${trialDays}-day free trial, no card`, body: "Try the real product with your own WhatsApp number." },
    { icon: Rocket, title: "Live in minutes, not weeks", body: "Connect your number, import leads and switch on the AI yourself. We're on WhatsApp if you get stuck." },
    { icon: Receipt, title: "GST invoices", body: "Proper tax invoices for every payment, prepaid plans with no auto-debit." },
    { icon: ShieldCheck, title: "Official WhatsApp Business API", body: "Built on Meta's official platform, with no unofficial WhatsApp Web workarounds that put your number at risk." },
  ];
  return (
    <section id="why-talkforgrow" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={MARKETING.overline}>Simple to buy, simple to start</p>
          <h2 className={`${MARKETING.h2} mt-3`}>Everything included. Nothing to set up for weeks.</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className={`${MARKETING.card} flex gap-4 p-5`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-white">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
