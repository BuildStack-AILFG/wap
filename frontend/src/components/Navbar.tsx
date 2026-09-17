"use client";

import { useState } from "react";
import { WhatsAppLogoIcon, MenuIcon, XIcon, ArrowUpRightIcon } from "./icons";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-950/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm shadow-emerald-900/10">
            <WhatsAppLogoIcon className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-[#0B1712]">
            Chatflow<span className="text-[#128C7E]">Wa</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-[#3F4C46] transition-colors hover:text-[#0B1712]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#contact"
            className="text-sm font-semibold text-[#3F4C46] transition-colors hover:text-[#0B1712]"
          >
            Log in
          </a>
          <a
            href="#get-started"
            className="group flex items-center gap-2 rounded-full bg-[#0B1712] px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Get started
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366]">
              <ArrowUpRightIcon className="h-3 w-3 text-[#0B1712]" />
            </span>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1712] md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-emerald-950/5 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#3F4C46] hover:bg-emerald-50 hover:text-[#0B1712]"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#get-started"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#0B1712] px-4 py-3 text-sm font-bold text-white"
            >
              Get started
              <ArrowUpRightIcon className="h-4 w-4 text-[#25D366]" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
