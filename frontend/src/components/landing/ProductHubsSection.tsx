import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

const HUBS = [
  {
    tag: "Automate",
    title: "Reply & Qualify Automatically",
    description: "No-code chat flows greet, answer FAQs, and qualify every WhatsApp conversation instantly.",
    href: "#features",
    image: "/images/interakt-clone/Marketing-CRM_Image-1.webp",
    alt: "Automated WhatsApp reply and qualification dashboard",
  },
  {
    tag: "Broadcast",
    title: "Reach Thousands in One Click",
    description: "Send approved template campaigns to your whole contact list, segmented and scheduled.",
    href: "#features",
    image: "/images/interakt-clone/Broadcast-WhatsApp-Messages-to-1000s-in-a-single-click3x_-1.webp",
    alt: "Broadcasting WhatsApp messages to thousands of contacts in one click",
  },
  {
    tag: "Support",
    title: "Never Miss a Message",
    description: "A shared team inbox for WhatsApp with assignment, read receipts, and internal notes.",
    href: "#features",
    image: "/images/interakt-clone/Support_Image.webp",
    alt: "Shared WhatsApp support inbox",
  },
];

export default function ProductHubsSection() {
  return (
    <section id="hubs" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={MARKETING.overline}>Everything You Need</p>
          <h2 className={`${MARKETING.h2} mt-3`}>Everything You Need to Win on WhatsApp</h2>
          <p className={`${MARKETING.body} mt-4`}>
            LeadForGrow is a full automation engine built only for WhatsApp Business — no bloated CRM, no unrelated channels.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {HUBS.map((hub) => (
            <div key={hub.tag} className={`${MARKETING.card} ${MARKETING.cardHover} overflow-hidden flex flex-col`}>
              <div className="h-44 w-full overflow-hidden bg-[#00926B]/15">
                <img src={hub.image} alt={hub.alt} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00926B]">{hub.tag}</p>
                <h3 className={`${MARKETING.h3} mt-2`}>{hub.title}</h3>
                <p className={`${MARKETING.body} mt-2 flex-1`}>{hub.description}</p>
                <Link
                  href={hub.href}
                  className="group mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#00926B] hover:text-[#00b384]"
                >
                  Learn More
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
