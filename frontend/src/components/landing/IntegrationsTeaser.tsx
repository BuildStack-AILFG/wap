import Link from "next/link";
import { ArrowRight, Store, Webhook, Workflow } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import {
  MetaIcon,
  ZapierIcon,
  GoogleSheetsIcon,
  ShopifyIcon,
  SlackColorIcon,
  StripeIcon,
  RazorpayIcon,
  WooCommerceIcon,
  MakeIcon,
} from "@/components/icons/IntegrationBrandIcons";

/** Only integrations that work today (see backend/app/services/integrations.py). "via" = connected through our webhooks, not a native app. */
const INTEGRATIONS = [
  { name: "WhatsApp Business API", icon: WhatsAppIcon, color: "#25D366" },
  { name: "IndiaMART", icon: Store, color: "#38BDF8" },
  { name: "Google Sheets", icon: GoogleSheetsIcon, color: "#0F9D58" },
  { name: "Meta Lead Ads", icon: MetaIcon, color: "#1877F2" },
  { name: "Shopify", icon: ShopifyIcon, color: "#95BF47" },
  { name: "WooCommerce", icon: WooCommerceIcon, color: "#96588A" },
  { name: "Razorpay", icon: RazorpayIcon, color: "#5B8DEF" },
  { name: "Stripe", icon: StripeIcon, color: "#635BFF" },
  { name: "Slack", icon: SlackColorIcon, color: undefined },
  { name: "Webhooks & REST API", icon: Webhook, color: "#E5E7EB" },
  { name: "Zapier", icon: ZapierIcon, color: "#FF4A00", via: true },
  { name: "Make", icon: MakeIcon, color: "#A855F7", via: true },
  { name: "Pabbly Connect", icon: Workflow, color: "#22C55E", via: true },
];

export default function IntegrationsTeaser() {
  return (
    <section id="integrations" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Leads in from where they already are, <span style={{ color: "var(--brand-soft)" }}>answered on WhatsApp</span>
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] text-white/55">
              IndiaMART enquiries and new Google Sheet rows arrive on their own. Store orders and payments trigger messages. Anything else connects through webhooks and our API.
            </p>
          </div>
          <Link
            href="/features/integrations-api"
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white btn-accent shrink-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Explore Integrations
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-6">
          {INTEGRATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.name} className="inline-flex items-center gap-2 text-white">
                <Icon size={22} style={{ color: item.color }} />
                <span className="text-base font-bold">{item.name}</span>
                {item.via && <span className="text-[11px] font-medium text-white/40">via webhook</span>}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
