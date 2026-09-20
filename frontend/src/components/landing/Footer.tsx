"use client";

import Link from "next/link";
import { Youtube, Linkedin, Facebook } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import NewsletterForm from "@/components/site/NewsletterForm";
import { SITE } from "@/lib/site/config";

const FOOTER_SECTIONS = [
  {
    id: "product",
    title: "Product",
    links: [
      { label: "Shared Inbox", href: "/features/shared-inbox" },
      { label: "Chat Flow Builder", href: "/features/chat-flow-builder" },
      { label: "AI Agent", href: "/features/ai-agent" },
      { label: "Broadcasts", href: "/features/broadcasts" },
      { label: "Auto-Replies", href: "/features/auto-replies" },
      { label: "Sales Pipeline", href: "/features/sales-pipeline" },
      { label: "Payments", href: "/features/payments" },
      { label: "Integrations & API", href: "/features/integrations-api" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    id: "solutions",
    title: "Solutions",
    links: [
      { label: "E-commerce", href: "/solutions/ecommerce" },
      { label: "Real Estate", href: "/solutions/real-estate" },
      { label: "Healthcare", href: "/solutions/healthcare" },
      { label: "Education", href: "/solutions/education" },
      { label: "Restaurants", href: "/solutions/restaurants" },
      { label: "Agencies", href: "/solutions/agencies" },
      { label: "Financial Services", href: "/solutions/financial-services" },
      { label: "Travel & Hospitality", href: "/solutions/travel-hospitality" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Help Center", href: "/help" },
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs/api-reference" },
      { label: "Product Updates", href: "/changelog" },
      { label: "System Status", href: "/status" },
    ],
  },
  {
    id: "company",
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Partners", href: "/partners" },
    ],
  },
  {
    id: "trust",
    title: "Trust",
    links: [
      { label: "Security", href: "/security" },
      { label: "Compliance", href: "/compliance" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

const FOOTER_LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Refund Policy", href: "/refund-policy" },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const FOOTER_SOCIAL = [
  { id: "whatsapp", label: "WhatsApp", href: "https://wa.me/918810873052", Icon: WhatsAppIcon, color: "#25D366" },
  { id: "youtube", label: "YouTube", href: "https://www.youtube.com/@ScaleDeskTechnologies", Icon: Youtube, color: "#FF0000" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/showcase/leadforgrow", Icon: Linkedin, color: "#0A66C2" },
  { id: "x", label: "X", href: "https://x.com/leadforgrow", Icon: XIcon, color: "#000000" },
  { id: "facebook", label: "Facebook", href: "https://www.facebook.com/leadforgrow", Icon: Facebook, color: "#1877F2" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="theme-fixed bg-[#1D4B3E] text-white">
      <div className={`${MARKETING.containerWide} py-14 lg:py-16`}>
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <img src="/image.png" alt="" className="h-9 w-10 object-contain brightness-0 invert" />
              <span className="text-xl font-bold font-[family-name:var(--font-plus-jakarta)] text-white">
                LeadForGrow
              </span>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed">
              WhatsApp Business automation — auto-replies, no-code chat flows, broadcasts, and a shared inbox, all on
              the official WhatsApp Business API.
            </p>
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-white">WhatsApp growth tips, monthly</p>
              <NewsletterForm source="footer" tone="footer" compact />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-8">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.id}>
                <h3 className="mb-4 text-sm font-bold text-white">{section.title}</h3>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs text-white/60">
              © {year} {SITE.legalName}. All rights reserved. {SITE.name} is a product of {SITE.legalName}.
            </p>
            <p className="mt-1 text-xs text-white/40">
              Not affiliated with WhatsApp Inc. or Meta. WhatsApp is a trademark of its respective owner.
              {SITE.address ? ` Registered office: ${SITE.address}.` : ""}
              {SITE.gstin ? ` GSTIN: ${SITE.gstin}.` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {FOOTER_LEGAL.map((l) => (
                <Link key={l.label} href={l.href} className="text-xs text-white/60 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {FOOTER_SOCIAL.map((s) => {
              const Icon = s.Icon;
              return (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-transform hover:scale-105 hover:bg-brand"
                >
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
