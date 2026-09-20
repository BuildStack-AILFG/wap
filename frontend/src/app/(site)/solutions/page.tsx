import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, FeatureGrid, PageHero, Section } from "@/components/site/blocks";
import { SOLUTIONS } from "@/lib/site/solutions";
import { MARKETING as M } from "@/lib/marketing/designTokens";
import { pageMetadata } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "Solutions — WhatsApp Automation for Every Industry",
  description: "See how e-commerce, real estate, healthcare, education, restaurants, agencies, financial services and travel businesses use WhatsApp automation to sell and support faster.",
  path: "/solutions",
  ogTitle: "WhatsApp automation for your industry",
  ogKind: "Solutions",
  keywords: ["WhatsApp for business industries", "WhatsApp automation use cases"],
});

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ name: "Solutions", path: "/solutions" }]}
        overline="Solutions"
        title="Playbooks for the way your industry actually sells and supports"
        lead="Every business talks to customers differently. Start from a proven approach for yours and adapt it in an afternoon."
        actions={<Link href="/contact?topic=demo" className={M.btnPrimary}>Book a demo <ArrowRight size={16} /></Link>}
      />
      <Section>
        <FeatureGrid items={SOLUTIONS.map((s) => ({ icon: s.icon, title: s.navLabel, body: s.tagline, href: `/solutions/${s.slug}` }))} cols={4} />
      </Section>
      <CtaBand title="Don't see your industry?" body="WhatsApp works anywhere customers ask questions and make decisions. Tell us about your business and we'll suggest a set-up." secondary={{ label: "Contact us", href: "/contact" }} />
    </>
  );
}
