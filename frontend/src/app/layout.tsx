import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LeadForGrow — WhatsApp Business Automation",
  description:
    "Auto-replies, no-code chat flows, broadcasts, and a shared team inbox for WhatsApp Business — all in one green dashboard.",
  icons: {
    icon: "/favicon-green.png",
    shortcut: "/favicon-green.png",
    apple: "/favicon-green.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
