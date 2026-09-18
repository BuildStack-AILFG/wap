import { CheckCircle2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-[#64748B]" aria-hidden>
      <span className="typing-dot" />
      <span className="typing-dot typing-dot-delay-1" />
      <span className="typing-dot typing-dot-delay-2" />
    </span>
  );
}

const WORKFLOW_STEPS = [
  "Message received",
  "Intent detected",
  "Auto-reply sent",
  "Customer replied",
  "Follow-up scheduled",
  "Conversation resolved",
];

export default function AutomationInActionSection() {
  return (
    <section className="relative w-full bg-[#F8FAFC] py-16 sm:py-20">
      <div className="mx-auto mb-10 w-full max-w-3xl px-4 text-center sm:px-6">
        <h2
          className="text-3xl font-extrabold tracking-[-0.03em] text-[#111827] sm:text-4xl"
          style={{ fontFamily: "var(--font-plus-jakarta)" }}
        >
          Automation in Action
        </h2>
        <p className="mt-2 text-base text-[#64748B] sm:text-lg">
          See how LeadForGrow replies to every WhatsApp message, instantly.
        </p>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-center md:gap-14">
        <div className="mx-auto h-[420px] w-[210px] shrink-0">
          <div className="flex h-full flex-col rounded-[1.75rem] border-[3px] border-[#0a0a0a] bg-[#0a0a0a] p-[3px] shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] bg-black">
              <div className="flex h-5 shrink-0 items-end justify-center bg-black pb-0.5">
                <div className="h-1.5 w-14 rounded-full bg-[#2a2a2a]" />
              </div>
              <div className="flex h-9 shrink-0 items-center gap-2 bg-[#075E54] px-3 text-white">
                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                <span className="truncate text-[11px] font-semibold">WhatsApp Business</span>
              </div>
              <div className="phone-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#ECE5DD] p-2.5">
                <div className="max-w-[88%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[11px] leading-relaxed text-[#111827]">
                    Hi 👋 do you have this in size M?
                  </p>
                  <p className="mt-0.5 text-right text-[9px] text-[#667781]">10:24</p>
                </div>

                <div className="flex max-w-[70%] self-end rounded-lg bg-[#D9FDD3] px-2.5 py-1.5">
                  <TypingDots />
                </div>

                <div className="flex max-w-[90%] flex-col self-end rounded-lg rounded-tr-none bg-[#D9FDD3] px-2.5 py-1.5 shadow-sm">
                  <p className="text-[11px] leading-relaxed text-[#111827]">
                    Yes! Size M is in stock ✅ Want me to reserve one?
                  </p>
                  <p className="mt-0.5 text-right text-[9px] text-[#667781]">10:24</p>
                </div>

                <div className="max-w-[80%] rounded-lg rounded-tl-none bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[11px] leading-relaxed text-[#111827]">Yes please!</p>
                  <p className="mt-0.5 text-right text-[9px] text-[#667781]">10:25</p>
                </div>

                <div className="flex flex-col items-end">
                  <div className="max-w-[90%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-2.5 py-1.5 shadow-sm">
                    <p className="text-[11px] leading-relaxed text-[#111827]">
                      Reserved 🎉 We&apos;ll hold it for 24 hours.
                    </p>
                    <p className="mt-0.5 text-right text-[9px] text-[#667781]">10:25</p>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[9px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Replied automatically
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex max-w-xs flex-col gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-emerald-700">The workflow</p>
          <div className="flex flex-wrap gap-1.5">
            {WORKFLOW_STEPS.map((step) => (
              <span
                key={step}
                className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 shadow-sm"
              >
                ✓ {step}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
            From the first message to a resolved conversation — all without an agent lifting a finger.
          </p>
        </div>
      </div>
    </section>
  );
}
