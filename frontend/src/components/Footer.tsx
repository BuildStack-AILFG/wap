import { WhatsAppLogoIcon } from "./icons";

const PRODUCT_LINKS = ["Auto-replies", "Chat flow builder", "Shared inbox", "Broadcasts", "Analytics"];
const COMPANY_LINKS = ["Pricing", "FAQ", "Contact support", "Book a demo"];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0B1712] py-16 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <a href="#top" className="flex w-fit items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-[#0B1712]">
                <WhatsAppLogoIcon className="h-4.5 w-4.5" />
              </span>
              <span className="text-[16px] font-extrabold tracking-tight">
                Chatflow<span className="text-[#34D399]">Wa</span>
              </span>
            </a>
            <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-[#9CA3A0]">
              WhatsApp Business automation — auto-replies, no-code chat flows,
              broadcasts, and a shared inbox, in one green dashboard.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#5B6C64]">Product</h4>
            <ul className="mt-5 space-y-3 text-[13.5px] text-[#9CA3A0]">
              {PRODUCT_LINKS.map((l) => (
                <li key={l} className="cursor-pointer transition-colors hover:text-white">
                  {l}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#5B6C64]">Company</h4>
            <ul className="mt-5 space-y-3 text-[13.5px] text-[#9CA3A0]">
              {COMPANY_LINKS.map((l) => (
                <li key={l} className="cursor-pointer transition-colors hover:text-white">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[12px] text-[#5B6C64] sm:flex-row">
          <p>© {new Date().getFullYear()} ChatflowWa. Not affiliated with WhatsApp Inc. or Meta.</p>
          <div className="flex gap-6">
            <span className="cursor-pointer transition-colors hover:text-white">Privacy</span>
            <span className="cursor-pointer transition-colors hover:text-white">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
