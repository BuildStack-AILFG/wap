import { ArrowUpRightIcon, BoltIcon, CheckIcon, DoubleCheckIcon, MegaphoneIcon } from "./icons";

export default function Hero() {
  return (
    <section id="top" className="bg-white px-3 pt-6 sm:px-4 sm:pt-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-[#0B1712]">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#25D366]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#128C7E]/20 blur-3xl" />

        <div className="relative grid gap-10 px-6 py-14 sm:px-10 sm:py-16 lg:grid-cols-2 lg:gap-8 lg:px-14 lg:py-20">
          {/* Left: copy */}
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6EE7B7]">
              WhatsApp business automation
            </span>

            <h1 className="mt-5 max-w-xl text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[3.1rem]">
              Never leave a chat<br className="hidden sm:block" /> on{" "}
              <span className="text-[#34D399]">read</span> again.
            </h1>

            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-[#9CA3A0]">
              Auto-reply in seconds, run no-code chat flows, and broadcast to
              thousands — all on the official WhatsApp Business API, from one
              green dashboard built only for WhatsApp.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#get-started"
                className="group flex items-center justify-between gap-6 rounded-full bg-white py-3.5 pl-6 pr-2 text-[15px] font-bold text-[#0B1712] transition-transform hover:-translate-y-0.5 sm:w-[230px]"
              >
                Get started free
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
                  <ArrowUpRightIcon className="h-4 w-4 text-[#0B1712]" />
                </span>
              </a>
              <a
                href="#how-it-works"
                className="text-[13px] font-semibold text-[#9CA3A0] underline underline-offset-4 transition-colors hover:text-white"
              >
                see how it works
              </a>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2">
              {["Official WhatsApp API", "No-code flow builder", "Live in 15 minutes"].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3A0]">
                  <CheckIcon className="h-3.5 w-3.5 text-[#34D399]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: phone mockup */}
          <div className="relative flex items-center justify-center">
            <div className="pointer-events-none absolute inset-0 hidden lg:block">
              <div
                className="float-card absolute left-0 top-6 w-[168px] rounded-2xl border border-white/10 bg-[#12211C] p-3 shadow-2xl shadow-black/40"
                style={{ animationDelay: "0s" }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#34D399]">
                    <MegaphoneIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[11px] font-bold text-white">Broadcast sent</p>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-[#9CA3A0]">
                  12,406 contacts delivered · 61% opened
                </p>
              </div>

              <div
                className="float-card absolute bottom-10 right-0 w-[160px] rounded-2xl border border-white/10 bg-[#12211C] p-3 shadow-2xl shadow-black/40"
                style={{ animationDelay: "0.6s" }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#34D399]">
                    <BoltIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[11px] font-bold text-white">Auto-reply</p>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-[#9CA3A0]">
                  Sent in 4 seconds, zero agents online
                </p>
              </div>
            </div>

            {/* Chat panel */}
            <div className="relative w-full max-w-[300px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0C1A15] shadow-2xl">
              <div className="flex items-center gap-2.5 bg-[#128C7E] px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold text-white">
                  R
                </span>
                <div>
                  <p className="text-[13px] font-bold text-white">Riya's Store</p>
                  <p className="text-[10px] text-emerald-100/80">online</p>
                </div>
              </div>

              <div
                className="flex flex-col gap-2.5 px-3 py-4"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, rgba(37,211,102,0.05), transparent 40%)",
                }}
              >
                <div className="max-w-[78%] rounded-t-xl rounded-br-xl bg-[#1F2C27] px-3 py-2 text-[12px] leading-snug text-[#E5E7E3]">
                  Hi! Do you have this in size M? 😊
                </div>

                <div className="ml-auto max-w-[82%] rounded-t-xl rounded-bl-xl bg-[#25D366] px-3 py-2 text-[12px] leading-snug text-[#062114]">
                  Yes! Size M is in stock ✅ Want me to reserve one for you?
                  <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#08301f]/70">
                    09:41 <DoubleCheckIcon className="h-3 w-3" />
                  </span>
                </div>

                <div className="max-w-[78%] rounded-t-xl rounded-br-xl bg-[#1F2C27] px-3 py-2 text-[12px] leading-snug text-[#E5E7E3]">
                  Yes please!
                </div>

                <div className="flex w-fit items-center gap-1 rounded-full bg-[#1F2C27] px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9CA3A0] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9CA3A0] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9CA3A0]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
