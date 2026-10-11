import { CalendarCheck } from "lucide-react";

export const BOOK_DEMO_URL = "https://www.leadforgrow.com/book/lets-connect";

/** Floating "Book a demo" on the right. On the homepage it sits above the chat widget's bubble (60px, 20px from the edge). */
export default function BookDemoButton({ aboveChat = false }: { aboveChat?: boolean }) {
  return (
    <a
      href={BOOK_DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Book a demo"
      title="Book a demo"
      className={`fixed right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-brand px-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:brightness-110 sm:px-4 ${
        aboveChat ? "bottom-[96px]" : "bottom-6 sm:bottom-8"
      }`}
    >
      <CalendarCheck className="h-5 w-5" strokeWidth={2.25} />
      <span className="hidden sm:inline">Book a demo</span>
    </a>
  );
}
