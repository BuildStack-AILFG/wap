"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

const SUB_NAV = [
  { label: "Features", href: "#features" },
  { label: "AI Suite", href: "#ai-suite" },
  { label: "Why us?", href: "#why-us" },
  { label: "Industries", href: "#industries" },
  { label: "Integrations", href: "#integrations" },
  { label: "Success Stories", href: "#success-stories" },
];

const CAPABILITIES = [
  {
    tag: "AI Agent",
    title: "Turn Conversations into Sales with AI",
    description: "Deploy an AI agent that answers queries, qualifies leads, and recommends products like a human would.",
    href: "#ai-suite",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/Group-1430106369.webp",
  },
  {
    tag: "Automation",
    title: "Launch WhatsApp Chatbots in Minutes",
    description: "Automate up to 80% of queries with an easy, drag-and-drop, no-code chatbot builder.",
    href: "#features",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/chatbot-builder.gif",
  },
  {
    tag: "Marketing",
    title: "Broadcast Messages to Thousands in One Click",
    description: "Scale your business communication effortlessly and reach every contact in a single send.",
    href: "#features",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/Broadcast-WhatsApp-Messages-to-1000s-in-a-single-click3x_-1.webp",
  },
  {
    tag: "Support",
    title: "Streamline Queries, Boost Efficiency",
    description: "Manage every WhatsApp query with a shared inbox — assignment, notes, and zero missed messages.",
    href: "#features",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/Manage-Customer-Interactions-with-Ease-2.webp",
  },
  {
    tag: "Commerce",
    title: "Bills, Payments & Catalogs in One Chat",
    description: "Share catalogs, collect payments, and confirm orders — all without leaving the conversation.",
    href: "#features",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/Launch-WhatsApp-Store-Payments-1.webp",
  },
  {
    tag: "Analytics",
    title: "Campaign & Team Analytics",
    description: "Track team performance, measure impact, and optimize campaigns with real-time insights.",
    href: "#features",
    tagColor: "var(--brand-bright)",
    image: "/images/interakt-clone/Campaign-Team-Analytics-3.webp",
  },
];

export default function CapabilitiesGridSection() {
  return (
    <section id="features" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 border-b border-white/10 pb-6">
          {SUB_NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white/60 transition-colors hover:bg-brand/15 hover:text-brand-soft"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className={MARKETING.overline}>Power-Packed Suite</p>
          <h2 className={`${MARKETING.h2} mt-3`}>Powerful Capabilities That Maximize Your Reach</h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ tag, title, description, href, tagColor, image }) => (
            <Link
              key={title}
              href={href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/[0.06]"
            >
              <div className="p-6 pb-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: tagColor }}>
                  {tag}
                </p>
                <h3 className="mt-2 text-[16px] font-bold leading-snug text-white">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">{description}</p>
                <span
                  className="mt-3 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold underline underline-offset-2"
                  style={{ color: tagColor }}
                >
                  Learn More
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="mt-4 flex h-44 w-full items-end justify-center overflow-hidden px-5 pb-5">
                <img src={image} alt={title} className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
