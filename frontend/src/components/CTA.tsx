import { ArrowUpRightIcon } from "./icons";

export default function CTA() {
  return (
    <section id="get-started" className="bg-white px-3 py-8 sm:px-4 sm:py-10">
      <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[32px] bg-[#0B1712] px-8 py-14 text-center sm:px-14 sm:py-16">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#25D366]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#128C7E]/20 blur-3xl" />

        <div className="relative">
          <h2 className="mx-auto max-w-xl text-[1.9rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.5rem]">
            Put your WhatsApp on autopilot today
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[#9CA3A0]">
            Connect your WhatsApp Business number and launch your first automation in minutes — free to start.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#top"
              className="flex items-center gap-3 rounded-full bg-white py-3.5 pl-6 pr-2 text-[15px] font-bold text-[#0B1712] transition-transform hover:-translate-y-0.5"
            >
              Get started free
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]">
                <ArrowUpRightIcon className="h-4 w-4 text-[#0B1712]" />
              </span>
            </a>
            <a
              href="#contact"
              className="text-[13px] font-semibold text-[#9CA3A0] underline underline-offset-4 transition-colors hover:text-white"
            >
              or talk to sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
