import type { ComponentType, CSSProperties } from "react";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import {
  MetaIcon,
  ZapierIcon,
  GoogleSheetsIcon,
  ShopifyIcon,
  SlackColorIcon,
  StripeIcon,
  CalendlyIcon,
  RazorpayIcon,
  GoogleCalendarIcon,
} from "@/components/icons/IntegrationBrandIcons";

export type IntegrationStatus = "connected" | "not_connected" | "needs_attention";

export type Integration = {
  id: string;
  name: string;
  description: string;
  category: "messaging" | "commerce" | "payments" | "productivity" | "automation";
  icon: ComponentType<{ className?: string; size?: number; style?: CSSProperties }>;
  iconColor?: string;
  status: IntegrationStatus;
  primary?: boolean; // WhatsApp — always shown first, larger
};

export const INTEGRATIONS: Integration[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Business API",
    description: "Connect your official WhatsApp Business number to send and receive messages.",
    category: "messaging",
    icon: WhatsAppIcon,
    iconColor: "#25D366",
    status: "not_connected",
    primary: true,
  },
  {
    id: "meta",
    name: "Meta Business",
    description: "Sync Meta Ads and Lead Ads so click-to-WhatsApp leads land straight in your inbox.",
    category: "messaging",
    icon: MetaIcon,
    iconColor: "#1877F2",
    status: "not_connected",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Export contacts and broadcast results to a live spreadsheet.",
    category: "productivity",
    icon: GoogleSheetsIcon,
    iconColor: "#0F9D58",
    status: "not_connected",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Send order confirmations and shipping updates over WhatsApp.",
    category: "commerce",
    icon: ShopifyIcon,
    iconColor: "#95BF47",
    status: "not_connected",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get a Slack ping whenever a new conversation needs a human reply.",
    category: "productivity",
    icon: SlackColorIcon,
    status: "not_connected",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Send payment links in chat and get notified when they're paid.",
    category: "payments",
    icon: StripeIcon,
    iconColor: "#635BFF",
    status: "not_connected",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    description: "Collect payments over WhatsApp with Razorpay payment links.",
    category: "payments",
    icon: RazorpayIcon,
    iconColor: "#0C2451",
    status: "not_connected",
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Let contacts book a meeting straight from a chat message.",
    category: "productivity",
    icon: CalendlyIcon,
    iconColor: "#006BFF",
    status: "not_connected",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Turn booked appointments into calendar events automatically.",
    category: "productivity",
    icon: GoogleCalendarIcon,
    iconColor: "#4285F4",
    status: "not_connected",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect WhatsApp to thousands of other apps with no code.",
    category: "automation",
    icon: ZapierIcon,
    iconColor: "#FF4A00",
    status: "not_connected",
  },
];
