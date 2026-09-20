export type ChangeEntry = {
  date: string; // ISO
  title: string;
  tag: "New" | "Improved" | "Platform";
  summary: string;
  items: string[];
};

/** Newest first. Add an entry whenever something customer-visible ships. */
export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-09-20",
    title: "Sales pipeline, online payments and a refreshed public site",
    tag: "New",
    summary: "Turn conversations into deals, pay for your plan online with GST invoices, and collect payments from your own customers.",
    items: [
      "Sales pipeline: drag-and-drop board, deal activity trail, stage manager, CSV export and sales reports",
      "Auto-create a deal for every new WhatsApp contact, or create and move deals from a chat flow",
      "Plan & billing: pay for 1, 3 or 12 months with Razorpay (UPI, cards, netbanking) with GST invoices and credit for unused time",
      "Payment links: connect your own Razorpay account and request payments from any chat or deal",
      "New flow steps: Create deal, Move deal and Payment link",
      "Slack notifications for won deals and received payments",
      "New public site: feature and solution pages, pricing, docs, help centre and blog",
    ],
  },
  {
    date: "2026-09-20",
    title: "Light theme",
    tag: "Improved",
    summary: "Choose a light or dark appearance for the dashboard.",
    items: ["A theme toggle in the dashboard top bar and on the site header", "Your choice is remembered on this device"],
  },
  {
    date: "2026-09-20",
    title: "The complete WhatsApp platform",
    tag: "Platform",
    summary: "The full product is connected to the WhatsApp Cloud API end to end.",
    items: [
      "Connect a WhatsApp Business number, with webhook signature verification",
      "Shared inbox with assignment, notes, quick replies and 24-hour window tracking",
      "Template manager with Meta approval status and a starter library",
      "Broadcast campaigns with audiences, scheduling and per-recipient reports",
      "Visual chat flow builder with a run log",
      "AI agent trained on your knowledge sources, with human hand-over",
      "Website chat widget with lead capture",
      "Integrations with Shopify, WooCommerce, Razorpay, Stripe and Slack, a REST API and signed webhooks",
      "Team roles, assignment rules and conversation analytics",
    ],
  },
  {
    date: "2026-09-19",
    title: "Campaign reports and production deployment",
    tag: "Improved",
    summary: "Understand how each campaign performed and run the platform reliably in production.",
    items: ["Campaign Reports page with delivery and engagement figures", "Hardened deployment with health checks and environment-driven CORS"],
  },
  {
    date: "2026-09-18",
    title: "LeadForGrow launches",
    tag: "New",
    summary: "The first public version of the WhatsApp automation site with sign-up and login.",
    items: ["Marketing site and product overview", "Sign-up, login and password reset"],
  },
];
