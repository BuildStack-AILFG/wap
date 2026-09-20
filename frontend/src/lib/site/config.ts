/** One place for everything the public site says about the company. Override per deployment with NEXT_PUBLIC_* env vars. */

const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const SITE = {
  name: "LeadForGrow",
  legalName: "ScaleDesk Technology Pvt Ltd",
  url: env(process.env.NEXT_PUBLIC_SITE_URL, "https://whatsapp.leadforgrow.com").replace(/\/$/, ""),
  tagline: "WhatsApp Business automation for growing teams",
  description:
    "Run sales, support and marketing on WhatsApp: a shared team inbox, no-code chat flows, broadcasts, an AI agent trained on your knowledge base, a sales pipeline and payment links — on the official WhatsApp Business Platform.",
  supportEmail: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, "support@leadforgrow.com"),
  whatsappNumber: "918810873052",
  /** Registered office. Shown on the contact, legal and invoice pages when set. */
  address: env(process.env.NEXT_PUBLIC_COMPANY_ADDRESS, ""),
  gstin: env(process.env.NEXT_PUBLIC_COMPANY_GSTIN, ""),
  cin: env(process.env.NEXT_PUBLIC_COMPANY_CIN, ""),
  twitter: "@leadforgrow",
  social: {
    linkedin: "https://www.linkedin.com/showcase/leadforgrow",
    youtube: "https://www.youtube.com/@ScaleDeskTechnologies",
    x: "https://x.com/leadforgrow",
    facebook: "https://www.facebook.com/leadforgrow",
  },
  /** ISO date the legal texts were last revised. Bump it whenever they change. */
  legalUpdated: "2026-09-20",
} as const;

export const whatsappLink = (text?: string) => `https://wa.me/${SITE.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const absoluteUrl = (path = "/") => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;

export const formatDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
