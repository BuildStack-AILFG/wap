import Script from "next/script";
import HomeClient from "@/components/landing/HomeClient";
import { JsonLd } from "@/components/site/blocks";
import { PLANS } from "@/lib/site/plans";
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

// Chat widget embed for the homepage. Set NEXT_PUBLIC_HOME_WIDGET_SRC to the script URL copied from Dashboard -> Widget;
// leave it unset to render no widget. It must be a URL the visitor's browser can reach (not localhost in production).
const HOME_WIDGET_SRC = process.env.NEXT_PUBLIC_HOME_WIDGET_SRC?.trim();

export default function Home() {
  return (
    <>
      {HOME_WIDGET_SRC ? <Script src={HOME_WIDGET_SRC} strategy="afterInteractive" /> : null}
      <JsonLd data={softwareLd(PLANS.filter((p) => p.perMonth).map((p) => ({ name: p.name, price: p.perMonth!.monthly, description: p.blurb })))} />
      <HomeClient />
    </>
  );
}
