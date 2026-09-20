import Link from "next/link";
import { ArrowRight, Compass, Eye, HeartHandshake, IndianRupee, ShieldCheck, Sparkles, Target } from "lucide-react";
import { CtaBand, FeatureGrid, JsonLd, PageHero, Section } from "@/components/site/blocks";
import { MARKETING as M } from "@/lib/marketing/designTokens";
import { SITE } from "@/lib/site/config";
import { organizationLd, pageMetadata } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: `About ${SITE.name} — Built by ${SITE.legalName}`,
  description: `${SITE.name} is a WhatsApp Business automation platform built by ${SITE.legalName} to help growing teams sell, support and collect payments where their customers already are.`,
  path: "/about",
  ogTitle: `About ${SITE.name}`,
  ogKind: "Company",
  keywords: ["ScaleDesk Technology", "LeadForGrow company", "WhatsApp automation company India"],
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <PageHero
        breadcrumbs={[{ name: "About", path: "/about" }]}
        overline="About us"
        title="We build software that helps businesses talk to customers where they already are"
        lead={`${SITE.name} is a product of ${SITE.legalName}. We make WhatsApp — the app your customers open dozens of times a day — a proper place to sell, support and get paid.`}
        actions={<><Link href="/contact" className={M.btnPrimary}>Talk to us <ArrowRight size={16} /></Link><Link href="/careers" className={M.btnOutline}>Work with us</Link></>}
      />

      <Section overline="Our mission" title="Make every customer conversation a chance to grow the business" alt>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className={`${M.body} space-y-4`}>
            <p>Most Indian businesses already run on WhatsApp: enquiries, orders, follow-ups, payment reminders. But the tools are often a phone passed between staff and a spreadsheet of numbers.</p>
            <p>We built LeadForGrow to fix that. One shared inbox for the team, automation that handles the repetitive work, campaigns you can measure, a sales pipeline that lives beside the chat, and payments customers can complete without leaving the conversation.</p>
            <p>We use the official WhatsApp Business Platform, we price in rupees with GST invoices, and we try to be plain about how things work — including their limits.</p>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[["Built for", "Sales, support and marketing teams on WhatsApp"], ["Platform", "Official WhatsApp Business Platform (Cloud API)"], ["Pricing", "Transparent, in ₹, with GST invoices"], ["Payments", "Razorpay — UPI, cards, netbanking"]].map(([k, v]) => (
              <div key={k} className={`${M.card} p-5`}><dt className="text-[12px] font-semibold uppercase tracking-wide text-brand">{k}</dt><dd className="mt-1.5 text-[14.5px] text-white/80">{v}</dd></div>
            ))}
          </dl>
        </div>
      </Section>

      <Section overline="What we believe" title="Principles we build by">
        <FeatureGrid items={[
          { icon: ShieldCheck, title: "Stay inside the rules", body: "We build on the official platform and design for opt-ins, templates and opt-outs so your number stays healthy." },
          { icon: Eye, title: "Be honest about limits", body: "AI can be wrong, templates can be rejected and delivery can fail. We show you why, instead of hiding it." },
          { icon: IndianRupee, title: "Fair, simple pricing", body: "Prepaid plans, no surprise auto-renewals, and credit for unused time when you upgrade." },
          { icon: HeartHandshake, title: "People stay in charge", body: "Automation handles the routine. A human is always one click away — for you and for your customers." },
          { icon: Target, title: "Ship what teams use", body: "We start from real workflows — lead qualification, order updates, collections — and keep the product focused." },
          { icon: Sparkles, title: "Respect data", body: "Your customers' conversations are yours. We encrypt credentials and limit who can see what." },
        ]} />
      </Section>

      <Section overline="Company" title="Who's behind LeadForGrow" alt narrow>
        <div className={`${M.card} space-y-3 p-6 text-[14.5px] text-white/70`}>
          <p className="flex items-start gap-3"><Compass size={18} className="mt-0.5 shrink-0 text-brand" /><span><b className="text-white">{SITE.legalName}</b> is the company that builds and operates {SITE.name}. It is the contracting party on your invoices, our Terms of Service and our Privacy Policy.</span></p>
          {SITE.address && <p><b className="text-white">Registered office:</b> {SITE.address}</p>}
          {SITE.gstin && <p><b className="text-white">GSTIN:</b> {SITE.gstin}</p>}
          {SITE.cin && <p><b className="text-white">CIN:</b> {SITE.cin}</p>}
          <p><b className="text-white">Contact:</b> <a href={`mailto:${SITE.supportEmail}`} className="text-brand hover:underline">{SITE.supportEmail}</a> · <Link href="/contact" className="text-brand hover:underline">contact form</Link></p>
        </div>
      </Section>
      <CtaBand title="See it working for your business" body="Start a free trial or book a walkthrough with our team." secondary={{ label: "Book a demo", href: "/contact?topic=demo" }} />
    </>
  );
}
