"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "Does LeadForGrow support the WhatsApp Business API?",
    a: "Yes. We integrate with the official Meta WhatsApp Business API. Connect your number, use approved templates, and manage team conversations from one unified inbox.",
  },
  {
    q: "How does onboarding work?",
    a: "Most teams go live in under 15 minutes. Connect WhatsApp, import contacts, set up your first flow, and launch — with guided onboarding on Growth and Enterprise plans.",
  },
  {
    q: "Can I upgrade or downgrade my plan anytime?",
    a: "Yes. Start on Starter and upgrade to Growth as your team scales. You can change plans anytime — billing adjusts on your next cycle.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. Chat flows, auto-replies, and broadcasts are all built with a drag-and-drop, no-code builder.",
  },
  {
    q: "How does AI automation work?",
    a: "AI drafts replies, qualifies leads, and triggers follow-up sequences based on intent. You stay in control with approval rules on sensitive conversations.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit and at rest. We use tenant isolation, role-based access, and follow enterprise security best practices.",
  },
];

export default function FAQSection({ onBookDemo }: { onBookDemo?: () => void }) {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="relative overflow-hidden bg-[#FAFDFA] py-14 sm:py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FAFDFA] via-white to-[#EEF8ED]/30" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">FAQ</p>
          <h2
            className="mt-3 text-[1.75rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#111827] sm:text-[2.15rem]"
            style={{ fontFamily: "var(--font-plus-jakarta)" }}
          >
            Questions before you start
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#64748B]">
            Common questions about LeadForGrow, onboarding, pricing, and security.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-[#FAFDFA]"
                >
                  <span className="pr-4 text-[15px] font-semibold text-[#111827]">{faq.q}</span>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isOpen ? "bg-emerald-700 text-white" : "bg-[#ECFDF5] text-emerald-800"
                    }`}
                  >
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[#E2E8F0] px-5 pb-5 pt-4">
                    <p className="text-[15px] leading-relaxed text-[#4B5563]">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[15px] text-[#64748B]">
          Still have questions?{" "}
          {onBookDemo ? (
            <button type="button" onClick={onBookDemo} className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800">
              Book a demo
            </button>
          ) : (
            <Link href="#contact" className="font-semibold text-emerald-700 transition-colors hover:text-emerald-800">
              Book a demo
            </Link>
          )}
        </p>
      </div>
    </section>
  );
}
