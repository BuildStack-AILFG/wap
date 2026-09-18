"use client";

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

const AI_POINTS = [
  { label: "Write, Launch, and Optimize with AI Copilot", image: "/images/interakt-clone/AI-copilot-3.webp" },
  { label: "AI Chatbots That Drive Conversions", image: "/images/interakt-clone/AI-Chatbots-2.webp" },
  { label: "Forms That Convert Chats into Leads", image: "/images/interakt-clone/WhatsApp-Forms-2.webp" },
  { label: "Go Beyond Keywords with Intent-Based Automation", image: "/images/interakt-clone/Intent-matching-2.webp" },
  { label: "Ready-to-Send Templates, Powered by AI", image: "/images/interakt-clone/Templates-2.webp" },
];

export default function AICapabilitiesSection({
  onGetStarted,
  onBookDemo,
}: {
  onGetStarted?: () => void;
  onBookDemo?: () => void;
}) {
  const [active, setActive] = useState(0);

  return (
    <section id="ai-suite" className={`${MARKETING.section} bg-[#FAFDFA]`}>
      <div className={MARKETING.container}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className={MARKETING.overline}>AI Suite</p>
            <h2 className={`${MARKETING.h2} mt-3`}>Elevate Your WhatsApp CX with an AI-Powered Platform</h2>

            <ul className="mt-6 space-y-4">
              {AI_POINTS.map((point, i) => (
                <li key={point.label}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    className={`flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      active === i ? "bg-emerald-50" : "hover:bg-emerald-50/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        active === i ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-[15px] font-semibold text-[#111827]">{point.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <p className={`${MARKETING.body} mt-6`}>A simple, transparent, and powerful platform — built only for WhatsApp.</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onGetStarted} className={MARKETING.btnPrimary}>
                Start Free Trial
              </button>
              <button type="button" onClick={onBookDemo} className={`group ${MARKETING.btnOutline}`}>
                Book a Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-violet-400/15 blur-2xl" />
              <img
                src={AI_POINTS[active].image}
                alt={AI_POINTS[active].label}
                className="w-full rounded-2xl bg-white object-contain shadow-[0_20px_48px_rgba(15,23,42,0.12)]"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
