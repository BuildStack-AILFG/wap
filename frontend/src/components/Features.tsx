import {
  BoltIcon,
  ChatIcon,
  BotIcon,
  UsersIcon,
  MegaphoneIcon,
  ChartIcon,
} from "./icons";

const FEATURES = [
  {
    icon: BoltIcon,
    title: "Instant auto-replies",
    desc: "Greet, answer FAQs, and confirm orders the moment a message lands — even at 2am.",
  },
  {
    icon: BotIcon,
    title: "No-code chat flows",
    desc: "Drag-and-drop builder for multi-step conversations: menus, buttons, catalogs, and handoffs.",
  },
  {
    icon: ChatIcon,
    title: "Shared team inbox",
    desc: "One inbox for the whole team, with assignment, read receipts, and internal notes per chat.",
  },
  {
    icon: MegaphoneIcon,
    title: "Broadcast campaigns",
    desc: "Send approved template messages to thousands of contacts with delivery and open tracking.",
  },
  {
    icon: UsersIcon,
    title: "Smart segmentation",
    desc: "Tag and group contacts by behavior so every broadcast reaches the right audience.",
  },
  {
    icon: ChartIcon,
    title: "Reports & analytics",
    desc: "Track response times, resolution rates, and campaign performance in one dashboard.",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">
            Everything on WhatsApp
          </p>
          <h2 className="mt-3 text-[1.9rem] font-extrabold leading-tight tracking-tight text-[#0B1712] sm:text-[2.4rem]">
            One green dashboard. Every WhatsApp conversation, handled.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#5B6C64]">
            Built specifically for WhatsApp Business — no bloated CRM, no unrelated channels.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-emerald-950/5 bg-[#FAFDFA] p-6 transition-shadow hover:shadow-[0_8px_30px_rgba(15,81,50,0.08)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#0F5132]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[16px] font-bold text-[#0B1712]">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5B6C64]">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
