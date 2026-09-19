"use client";

import { ArrowRight } from "lucide-react";

export default function LandingCTA({ onGetStarted, onBookDemo }: { onGetStarted?: () => void; onBookDemo?: () => void }) {
  return (
    <section id="get-started" className="bg-black py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00926B]">Get started</p>
        <h2
          className="mt-3 text-[1.75rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-white sm:text-[2.15rem]"
          style={{ fontFamily: "var(--font-plus-jakarta)" }}
        >
          Ready to put WhatsApp on autopilot?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/60">
          See LeadForGrow in action with a personalized demo, or start your free trial and go live in minutes.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBookDemo}
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#00926B] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#007A59]"
          >
            Book a Demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:border-[#00926B]/50 hover:bg-[#00926B]/15"
          >
            Start Free Trial
          </button>
        </div>
      </div>
    </section>
  );
}
