import Script from "next/script";
import HomeClient from "@/components/landing/HomeClient";
import { JsonLd } from "@/components/site/blocks";
import HomePricingSection from "@/components/landing/HomePricingSection";
import { getPublicPricing } from "@/lib/site/livePlans";
import { pageMetadata, softwareLd } from "@/lib/site/seo";

export const metadata = pageMetadata({
  title: "LeadForGrow — WhatsApp Business Automation, Inbox, Flows & Payments",
  description:
    "Run sales, support and marketing on WhatsApp: shared team inbox, no-code chat flows, broadcasts, an AI agent, a sales pipeline and Razorpay payment links — on the official WhatsApp Business Platform.",
  path: "/",
  ogTitle: "WhatsApp automation for teams that sell and support",
  ogKind: "",
  keywords: ["WhatsApp Business automation", "WhatsApp chatbot", "WhatsApp CRM", "WhatsApp broadcast", "WhatsApp shared inbox", "WhatsApp Business API India"],
});

// Chat widget embed for the homepage (created in Dashboard -> Widget on production). Override per deployment with
// NEXT_PUBLIC_HOME_WIDGET_SRC; it must be a URL the visitor's browser can reach (not localhost in production).
const HOME_WIDGET_SRC =
  process.env.NEXT_PUBLIC_HOME_WIDGET_SRC?.trim() ||
  "https://wap-production-ce44.up.railway.app/api/public/widget/CCLRD35UNiEob6j1.js";

// Re-render every 5 minutes so price changes made in the admin console reach the home page without a redeploy.
export const revalidate = 300;

export default async function Home() {
  const { plans } = await getPublicPricing();
  return (
    <>
      {HOME_WIDGET_SRC ? <Script src={HOME_WIDGET_SRC} strategy="afterInteractive" /> : null}
      <JsonLd data={softwareLd(plans.filter((p) => p.perMonth).map((p) => ({ name: p.name, price: p.perMonth!.monthly, description: p.audience })))} />
      <HomeClient pricing={<HomePricingSection />} />
    </>
  );
}
