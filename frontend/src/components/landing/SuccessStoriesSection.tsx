import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { MARKETING } from "@/lib/marketing/designTokens";

/**
 * Generic, unattributed industry personas illustrating common use cases —
 * not real named customers, so nothing here is a fabricated endorsement.
 */
const STORIES = [
  {
    quote: "Automated replies mean no customer waits more than a minute for a first response, even after hours.",
    role: "Owner, D2C Retail Brand",
    image: "https://images.pexels.com/photos/36729529/pexels-photo-36729529.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
  {
    quote: "Every WhatsApp enquiry lands in one shared inbox now — nothing falls through the cracks.",
    role: "Marketing Lead, Growing Agency",
    image: "https://images.pexels.com/photos/3855619/pexels-photo-3855619.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
  {
    quote: "Bookings and reminders run themselves, so our team spends more time with customers, not spreadsheets.",
    role: "Manager, Restaurant Chain",
    image: "https://images.pexels.com/photos/28703287/pexels-photo-28703287.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
  {
    quote: "Qualifying property enquiries used to take hours a day — now automation does the first pass for us.",
    role: "Broker, Real Estate Team",
    image: "https://images.pexels.com/photos/8815878/pexels-photo-8815878.jpeg?auto=compress&cs=tinysrgb&w=200",
  },
];

export default function SuccessStoriesSection() {
  return (
    <section id="success-stories" className={MARKETING.section}>
      <div className={MARKETING.container}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={MARKETING.overline}>Success Stories</p>
          <h2 className={`${MARKETING.h2} mt-3`}>Built for Businesses Like Yours</h2>
          <p className={`${MARKETING.body} mt-4`}>A look at how teams across industries use WhatsApp automation every day.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {STORIES.map((story) => (
            <div key={story.role} className={`${MARKETING.card} p-6 flex gap-4`}>
              <Quote className="h-6 w-6 shrink-0 text-emerald-200" fill="currentColor" />
              <div className="min-w-0">
                <p className="text-[15px] leading-relaxed text-[#111827]">&ldquo;{story.quote}&rdquo;</p>
                <div className="mt-4 flex items-center gap-3">
                  <img src={story.image} alt="" aria-hidden="true" className="h-9 w-9 rounded-full object-cover" loading="lazy" />
                  <p className="text-[13px] font-semibold text-[#64748B]">{story.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="#contact" className="group inline-flex items-center gap-2 text-[14px] font-semibold text-emerald-700 hover:text-emerald-800">
            Share your own success story
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
