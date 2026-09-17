const STEPS = [
  {
    step: "01",
    label: "Message comes in",
    detail: "A customer messages your WhatsApp Business number from an ad, your website, or a saved contact.",
  },
  {
    step: "02",
    label: "Flow decides what happens",
    detail: "Your no-code flow answers FAQs, shares a catalog, or collects details — instantly.",
  },
  {
    step: "03",
    label: "Handoff when it matters",
    detail: "Complex or high-intent chats route to the right teammate in the shared inbox.",
  },
  {
    step: "04",
    label: "Follow-up, automatically",
    detail: "Reminders and re-engagement templates go out on schedule, so no chat goes cold.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#FAFDFA] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">
            How it works
          </p>
          <h2 className="mt-3 text-[1.9rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.4rem]">
            From "hi" to resolved — automatically
          </h2>
        </div>

        <div className="mt-14 space-y-0">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F5132] text-[13px] font-bold text-white">
                  {s.step}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-px flex-1 min-h-[36px] bg-emerald-900/15" />
                )}
              </div>
              <div className="pb-10">
                <p className="text-[16px] font-bold text-[#0B1712]">{s.label}</p>
                <p className="mt-1 max-w-lg text-[14px] leading-relaxed text-[#5B6C64]">
                  {s.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
