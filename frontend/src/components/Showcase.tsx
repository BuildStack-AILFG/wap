import Image from "next/image";
import { CheckIcon } from "./icons";

export default function Showcase() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-20 px-6 lg:px-8">
        {/* Row 1 */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">
              AI-assisted replies
            </p>
            <h3 className="mt-3 text-[1.7rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.1rem]">
              Your WhatsApp agent that never clocks out
            </h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5B6C64]">
              Draft-quality replies suggested in real time, trained on your
              catalog, FAQs, and past conversations — your team approves or
              sends with one tap.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Understands order status, pricing, and product questions",
                "Escalates automatically when confidence is low",
                "Learns from every conversation your team handles",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#374943]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#0F5132]">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 flex justify-center rounded-3xl bg-gradient-to-br from-[#ECFDF5] to-white p-8 lg:order-2">
            <Image
              src="/illustrations/ai-avatar.png"
              alt="Friendly AI assistant that powers automated WhatsApp replies"
              width={260}
              height={260}
              className="h-auto w-56 sm:w-64"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex justify-center rounded-3xl bg-gradient-to-br from-[#ECFDF5] to-white p-8">
            <Image
              src="/illustrations/thinking_guy.png"
              alt="Support lead reviewing WhatsApp automation performance"
              width={260}
              height={260}
              className="h-auto w-56 sm:w-64"
            />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">
              Built for teams
            </p>
            <h3 className="mt-3 text-[1.7rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.1rem]">
              No more "who's replying to this chat?"
            </h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5B6C64]">
              Assign conversations, leave internal notes, and see exactly
              who's handling what — so nothing falls through the cracks
              during a busy sale or launch.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Round-robin or manual assignment rules",
                "Private internal notes on every chat",
                "Full history synced across your whole team",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#374943]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#0F5132]">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
