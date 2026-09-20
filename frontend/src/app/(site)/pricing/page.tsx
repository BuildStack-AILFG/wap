import { BadgeCheck, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { CtaBand, FaqList, FeatureGrid, JsonLd, PageHero, Section } from "@/components/site/blocks";
import PricingTable from "@/components/site/PricingTable";
import { PLANS } from "@/lib/site/plans";
import { pageMetadata, softwareLd, type Faq } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "Pricing — WhatsApp Automation Plans in ₹",
  description: "Simple INR pricing for WhatsApp Business automation. Starter ₹999, Growth ₹2,499, Scale ₹5,999 per month plus GST. Start with a free trial, pay online with UPI or card, get GST invoices.",
  path: "/pricing",
  ogTitle: "Simple pricing, built for Indian businesses",
  ogKind: "Pricing",
  keywords: ["WhatsApp automation pricing", "WhatsApp Business API pricing India", "WhatsApp CRM price"],
});

const FAQS: Faq[] = [
  { q: "Is there a free trial?", a: "Yes. Every new workspace starts with a free trial with no credit card required. You can try every feature with trial limits before choosing a plan." },
  { q: "Are the prices inclusive of GST?", a: "No. Prices are shown before GST. 18% GST is added at checkout and shown on your invoice with a CGST/SGST or IGST breakup." },
  { q: "Do plans renew automatically?", a: "No. Plans are prepaid for 1, 3 or 12 months and do not auto-debit. We email you before your plan ends so you can renew when you're ready." },
  { q: "Does the plan price include WhatsApp message charges?", a: "No. Meta charges for certain WhatsApp message categories under its own pricing, billed separately by Meta. LeadForGrow's plans cover the software: inbox, automation, campaigns, AI, pipeline and payments." },
  { q: "What payment methods can I use?", a: "UPI, credit and debit cards, netbanking and wallets through Razorpay. You'll get a GST invoice for every payment." },
  { q: "Can I change plans later?", a: "Yes. Upgrade or switch any time; the unused time on your current plan is credited toward the new one, shown before you pay." },
  { q: "What happens if my plan expires?", a: "After a short grace period your workspace moves to the free plan with lower limits. Nothing is deleted — renew to restore your limits." },
  { q: "Do you offer discounts for agencies or NGOs?", a: "Talk to us. We have a partner programme for agencies and can look at special cases." },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={softwareLd(PLANS.filter((p) => p.perMonth).map((p) => ({ name: p.name, price: p.perMonth!.monthly, description: p.blurb })))} />
      <PageHero
        breadcrumbs={[{ name: "Pricing", path: "/pricing" }]}
        center
        overline="Pricing"
        title="Simple pricing that grows with your conversations"
        lead="Start free, pay online in rupees and get a GST invoice every time. No setup fees, no lock-in, no surprise auto-renewals."
      />
      <Section>
        <PricingTable />
      </Section>
      <Section overline="Every plan includes" title="Built for how Indian businesses pay and sell" alt>
        <FeatureGrid cols={4} items={[
          { icon: CreditCard, title: "Pay your way", body: "UPI, cards, netbanking and wallets through Razorpay." },
          { icon: FileText, title: "GST invoices", body: "Sequential invoices with CGST + SGST or IGST and your GSTIN." },
          { icon: ShieldCheck, title: "Prepaid, no surprises", body: "No auto-debit. We remind you before your plan ends." },
          { icon: BadgeCheck, title: "Fair upgrades", body: "Unused time is credited when you move to a bigger plan." },
        ]} />
      </Section>
      <Section overline="FAQ" title="Pricing questions, answered" narrow>
        <FaqList faqs={FAQS} />
      </Section>
      <CtaBand title="Need something bigger?" body="Custom limits, guided onboarding and a named contact for high-volume teams." primary={{ label: "Talk to sales", href: "/contact?topic=sales" }} secondary={{ label: "Start free trial", href: "/signup" }} />
    </>
  );
}
