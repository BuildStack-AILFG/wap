"use client";

import { useState } from "react";
import { PlusIcon, MinusIcon } from "./icons";

const FAQS = [
  {
    q: "Does this use the official WhatsApp Business API?",
    a: "Yes. Every message is sent through the official Meta WhatsApp Business API, so your number stays verified and compliant.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. Chat flows, auto-replies, and broadcasts are all built with a drag-and-drop, no-code builder.",
  },
  {
    q: "Can my whole team use one WhatsApp number?",
    a: "Yes. The shared inbox lets multiple teammates reply from the same number, with assignment and internal notes.",
  },
  {
    q: "What happens if the bot can't answer a question?",
    a: "Chats automatically hand off to a human teammate in the shared inbox whenever confidence is low or a customer asks for a person.",
  },
  {
    q: "How fast can I go live?",
    a: "Most teams connect their WhatsApp number and launch their first automation in under 15 minutes.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">FAQ</p>
          <h2 className="mt-3 text-[1.9rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.2rem]">
            Questions before you start
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-2xl border border-emerald-950/8 bg-[#FAFDFA]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="text-[15px] font-semibold text-[#0B1712]">{faq.q}</span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isOpen ? "bg-[#0F5132] text-white" : "bg-[#25D366]/15 text-[#0F5132]"
                    }`}
                  >
                    {isOpen ? <MinusIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-emerald-950/8 px-5 pb-5 pt-4">
                    <p className="text-[14.5px] leading-relaxed text-[#5B6C64]">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
