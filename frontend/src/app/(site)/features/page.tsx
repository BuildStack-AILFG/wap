import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, FeatureGrid, JsonLd, PageHero, Section } from "@/components/site/blocks";
import { FEATURES } from "@/lib/site/features";
import { MARKETING as M } from "@/lib/marketing/designTokens";
import { absoluteUrl } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "Features — WhatsApp Inbox, Flows, Broadcasts, AI & Sales",
  description: "Everything you need to run sales, support and marketing on WhatsApp: shared inbox, chat flows, broadcasts, AI agent, sales pipeline, payments, widget and integrations.",
  path: "/features",
  ogTitle: "Every tool your WhatsApp team needs",
  ogKind: "Features",
  keywords: ["WhatsApp Business features", "WhatsApp automation platform", "WhatsApp CRM features"],
});

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: "LeadForGrow features", itemListElement: FEATURES.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.navLabel, url: absoluteUrl(`/features/${f.slug}`) })) }} />
      <PageHero
        breadcrumbs={[{ name: "Features", path: "/features" }]}
        overline="The platform"
        title="One workspace for every WhatsApp conversation, campaign and sale"
        lead="From the first message to the final payment. Every feature works together, on the official WhatsApp Business Platform, so your team never has to switch tools."
        actions={<><Link href="/signup" className={M.btnPrimary}>Start free trial <ArrowRight size={16} /></Link><Link href="/pricing" className={M.btnOutline}>See pricing</Link></>}
      />
      <Section overline="Explore" title="Pick a capability to see how it works">
        <FeatureGrid items={FEATURES.map((f) => ({ icon: f.icon, title: f.navLabel, body: f.tagline, href: `/features/${f.slug}` }))} />
      </Section>
      <CtaBand />
    </>
  );
}
