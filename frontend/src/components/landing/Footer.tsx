"use client";

import Link from "next/link";
import { Youtube, Linkedin, Facebook } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";

const FOOTER_SECTIONS = [
  {
    id: "product",
    title: "Product",
    links: [
      { label: "Auto-Replies", href: "#features" },
      { label: "Chat Flow Builder", href: "#features" },
      { label: "AI Assistant", href: "#ai-suite" },
      { label: "Shared Inbox", href: "#features" },
      { label: "Integrations", href: "#integrations" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    id: "solutions",
    title: "Solutions",
    links: [
      { label: "Startups", href: "#industries" },
      { label: "Agencies", href: "#industries" },
      { label: "Restaurants", href: "#industries" },
      { label: "Real Estate", href: "#industries" },
      { label: "Healthcare", href: "#industries" },
      { label: "Education", href: "#industries" },
      { label: "Enterprise", href: "#industries" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Help Center", href: "#" },
      { label: "Documentation", href: "#" },
      { label: "API Docs", href: "#" },
      { label: "Product Updates", href: "#" },
      { label: "Guides", href: "#" },
      { label: "System Status", href: "#" },
    ],
  },
  {
    id: "company",
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#contact" },
      { label: "Careers", href: "#" },
      { label: "Customers", href: "#success-stories" },
      { label: "Case Studies", href: "#success-stories" },
      { label: "Partners", href: "#" },
    ],
  },
  {
    id: "trust",
    title: "Trust",
    links: [
      { label: "Security", href: "#" },
      { label: "Compliance", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "GDPR", href: "#" },
      { label: "Accessibility", href: "#" },
    ],
  },
];

const FOOTER_LEGAL = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy", href: "#" },
  { label: "Refund Policy", href: "#" },
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
    <footer id="contact" className="bg-[#1D4B3E] text-white">
      <div className={`${MARKETING.containerWide} py-14 lg:py-16`}>
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Link href="#top" className="inline-flex items-center gap-3 mb-4">
              <img src="/image.png" alt="" className="h-9 w-10 object-contain brightness-0 invert" />
              <span className="text-xl font-bold font-[family-name:var(--font-plus-jakarta)] text-white">
                LeadForGrow
              </span>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed">
              WhatsApp Business automation — auto-replies, no-code chat flows, broadcasts, and a shared inbox, all on
              the official WhatsApp Business API.
            </p>
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
              © {year} LeadForGrow. Not affiliated with WhatsApp Inc. or Meta. All rights reserved.
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
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-transform hover:scale-105 hover:bg-[#00926B]"
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
