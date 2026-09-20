import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Smartphone,
  Inbox,
  ClipboardCheck,
  Megaphone,
  Users2,
  BarChart3,
  Headphones,
  ClipboardList,
  Zap,
  MessageSquareReply,
  Workflow,
  Target,
  Bot,
  Plug,
  LayoutGrid,
  FileText,
  Handshake,
  TrendingUp,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  /** Sub-heading within a group's flyout panel — e.g. Interakt's "Utilities" under Automation. Omit for an unlabeled section. */
  label?: string;
  items: NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  sections: NavSection[];
  badge?: "new";
};

/** Flat, always-visible rail icons — no flyout panel, click navigates directly. */
export const QUICK_LINKS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "whatsapp", label: "WhatsApp number", href: "/dashboard/whatsapp", icon: Smartphone },
  { id: "inbox", label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { id: "contacts", label: "Contacts", href: "/dashboard/contacts", icon: ClipboardCheck },
];

/** Grouped rail icons — click opens a flyout panel listing that section's pages. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    sections: [
      {
        items: [
          { id: "templates", label: "Templates", href: "/dashboard/templates", icon: FileText },
          { id: "broadcasts", label: "Broadcasts", href: "/dashboard/broadcasts", icon: Megaphone },
          { id: "segments", label: "Segments", href: "/dashboard/segments", icon: Users2 },
          { id: "campaign-reports", label: "Campaign Reports", href: "/dashboard/campaign-reports", icon: BarChart3 },
        ],
      },
    ],
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: Headphones,
    sections: [
      {
        items: [
          { id: "conversation-analytics", label: "Analytics", href: "/dashboard/conversation-analytics", icon: BarChart3 },
          { id: "assignment-rules", label: "Assignment Rules", href: "/dashboard/assignment-rules", icon: ClipboardList },
        ],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: Handshake,
    badge: "new",
    sections: [
      {
        items: [
          { id: "pipeline", label: "Pipeline", href: "/dashboard/pipeline", icon: Handshake },
          { id: "sales-reports", label: "Sales Reports", href: "/dashboard/sales-reports", icon: TrendingUp },
        ],
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Zap,
    badge: "new",
    sections: [
      {
        items: [
          { id: "auto-replies", label: "Auto-Replies", href: "/dashboard/auto-replies", icon: MessageSquareReply },
          { id: "custom-replies", label: "Custom Replies", href: "/dashboard/custom-replies", icon: MessageSquareReply },
          { id: "flow-builder", label: "Flow Builder", href: "/dashboard/flow-builder", icon: Workflow },
          { id: "intent-matching", label: "Intent Matching", href: "/dashboard/intent-matching", icon: Target },
          { id: "ai-agent", label: "AI Agent", href: "/dashboard/ai-agent", icon: Bot },
        ],
      },
    ],
  },
];

/** Flat, single-page rail icons that sit after the groups — no flyout panel (mirrors Interakt's Integrations/Widget). */
export const RAIL_LINKS: NavItem[] = [
  { id: "integrations", label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { id: "widget", label: "Widget", href: "/dashboard/widget", icon: LayoutGrid },
];

export function findNavItemByHref(href: string): NavItem | undefined {
  for (const item of QUICK_LINKS) {
    if (item.href === href) return item;
  }
  for (const group of NAV_GROUPS) {
    for (const section of group.sections) {
      for (const item of section.items) {
        if (item.href === href) return item;
      }
    }
  }
  for (const item of RAIL_LINKS) {
    if (item.href === href) return item;
  }
  return undefined;
}

export const SIDEBAR_WIDTH = { rail: 72, panel: 260 } as const;
