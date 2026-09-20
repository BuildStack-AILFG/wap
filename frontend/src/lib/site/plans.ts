/**
 * Public plan catalogue. Keep in step with backend/scripts/seed_plans.py — that seed is what checkout actually charges.
 * Prices are rupees per month, before 18% GST, for each billing period.
 */

export type PlanId = "starter" | "growth" | "scale" | "enterprise";
export type Period = "monthly" | "quarterly" | "yearly";

export const PERIODS: { id: Period; label: string; months: number }[] = [
  { id: "monthly", label: "Monthly", months: 1 },
  { id: "quarterly", label: "Quarterly", months: 3 },
  { id: "yearly", label: "Yearly", months: 12 },
];

export const GST_PERCENT = 18;

export type PlanInfo = {
  id: PlanId;
  name: string;
  blurb: string;
  perMonth: Record<Period, number> | null;
  highlight?: boolean;
  limits: { numbers: number | "Unlimited"; seats: number | "Unlimited"; contacts: number | "Unlimited"; campaign: number | "Unlimited"; flows: number | "Unlimited"; ai: number | "Unlimited"; knowledge: number | "Unlimited" };
  features: string[];
};

export const PLANS: PlanInfo[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For a single team getting its first WhatsApp workflows live.",
    perMonth: { monthly: 999, quarterly: 899, yearly: 799 },
    limits: { numbers: 1, seats: 2, contacts: 2000, campaign: 2000, flows: 3, ai: 500, knowledge: 3 },
    features: ["Shared team inbox with assignment", "Auto-replies, chat flows & templates", "Broadcasts, segments & website widget", "AI agent with human hand-over", "Sales pipeline & Razorpay payment links", "API keys, webhooks & integrations"],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "For teams that run campaigns and automation every day.",
    perMonth: { monthly: 2499, quarterly: 2249, yearly: 1999 },
    highlight: true,
    limits: { numbers: 3, seats: 7, contacts: 10000, campaign: 10000, flows: 15, ai: 2000, knowledge: 10 },
    features: ["Everything in Starter", "3 WhatsApp numbers on one workspace", "5× the contacts and 4× the AI replies", "15 automation flows", "A bigger team: 7 seats", "Shopify, WooCommerce & Razorpay event triggers"],
  },
  {
    id: "scale",
    name: "Scale",
    blurb: "For larger sales and support desks with several numbers.",
    perMonth: { monthly: 5999, quarterly: 5399, yearly: 4799 },
    limits: { numbers: 10, seats: 20, contacts: 50000, campaign: 50000, flows: 50, ai: 10000, knowledge: 25 },
    features: ["Everything in Growth", "10 WhatsApp numbers and 20 seats", "50,000 contacts and campaign recipients", "50 automation flows and 10,000 AI replies", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Custom limits, onboarding and support for high-volume operations.",
    perMonth: null,
    limits: { numbers: "Unlimited", seats: "Unlimited", contacts: "Unlimited", campaign: "Unlimited", flows: "Unlimited", ai: "Unlimited", knowledge: "Unlimited" },
    features: ["Custom limits and invoicing", "Guided onboarding & migration", "Security review and DPA", "Named support contact"],
  },
];

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const fmtLimit = (v: number | "Unlimited") => (v === "Unlimited" ? "Unlimited" : v.toLocaleString("en-IN"));

export const savingPercent = (p: PlanInfo, period: Period) => (p.perMonth && period !== "monthly" ? Math.round((1 - p.perMonth[period] / p.perMonth.monthly) * 100) : 0);
