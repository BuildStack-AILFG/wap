import Link from "next/link";
import { ArrowRight, BellRing, Bot, Flame, Inbox, Store } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

/** The lead-to-sale loop, built only from features that ship today; each step links to its feature page. */
const STEPS = [
  { icon: Store, title: "Capture every lead", body: "IndiaMART enquiries, Google Sheet rows, Meta lead forms, your website widget and every WhatsApp message land as one contact per phone number.", href: "/features/lead-capture" },
  { icon: Bot, title: "Reply in seconds, 24×7", body: "The AI agent answers from your own price lists and FAQs, in the customer's language, and asks the qualifying questions you choose.", href: "/features/ai-agent" },
  { icon: Flame, title: "Know who's hot", body: "Each lead is scored hot, warm or cold with the reason, so your team calls the ready buyers first.", href: "/features/lead-scoring" },
  { icon: BellRing, title: "Follow up until they reply", body: "Quiet leads get nudges over hours or days: AI-written inside 24 hours, templates after. A reply stops it instantly.", href: "/features/follow-ups" },
  { icon: Inbox, title: "Hand over to a closer", body: "Warm conversations reach the right person in a shared inbox with the full history, notes and a deal in the pipeline.", href: "/features/shared-inbox" },
];

export default function SalesEngineSection() {
  return (
    <section id="sales-engine" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={MARKETING.overline}>Built to close, not just to chat</p>
          <h2 className={`${MARKETING.h2} mt-3`}>From first enquiry to closed deal, on autopilot</h2>
          <p className={`${MARKETING.body} mt-4`}>
            Most leads don&apos;t say no, they just go quiet. TalkForGrow answers them first, finds the ready buyers and keeps following up
            until they reply, so your team spends its time closing.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(({ icon: Icon, title, body, href }, i) => (
            <li key={title}>
              <Link href={href} className={`group ${MARKETING.card} ${MARKETING.cardHover} flex h-full flex-col p-5`}>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand"><Icon className="h-5 w-5" /></span>
                  <span className="text-[12px] font-bold text-white/30">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[15px] font-bold leading-snug text-white">{title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/60">{body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand">
                  How it works <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
