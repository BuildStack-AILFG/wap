"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Play, ExternalLink, Upload, Check } from "lucide-react";
import { Alert, Button, Card, Input, Page, PageHeader, Spinner, useUi } from "@/components/ui/kit";
import { commerce as api, errorMessage, type CommerceSettings } from "@/lib/api";

export default function CommerceSettingsPage() {
  const { toast } = useUi();
  const [s, setS] = useState<CommerceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<number>(1);
  const [catalogId, setCatalogId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  const learnMore = () => {
    setOpenStep(1);
    stepsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    api.settings().then((v) => { setS(v); setCatalogId(v.meta_catalog_id ?? ""); }).catch((e) => setError(errorMessage(e, "Couldn't load commerce settings.")));
  }, []);

  async function connectCatalog() {
    setConnecting(true);
    try { const v = await api.updateSettings({ meta_catalog_id: catalogId.trim(), catalog_enabled: true }); setS(v); toast("Catalog connected"); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setConnecting(false); }
  }

  if (error) return <Page><Alert>{error}</Alert></Page>;
  if (!s) return <Page><Spinner /></Page>;

  return (
    <Page>
      <PageHeader title="Commerce Settings" subtitle="Set up WhatsApp Catalog Messages for your account"
        actions={<a className="inline-flex items-center gap-1 text-[13px] text-sky-300 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Give your Feedback <ExternalLink size={13} /></a>} />

      {/* Hero */}
      <Card className="mb-5 overflow-hidden">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1fr_360px]">
          <div>
            <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Start Selling on WhatsApp!</h2>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/60">
              Send catalogs to customers as part of campaigns &amp; auto-replies. They can then place orders via carts — right inside the chat.
            </p>
            <Button variant="ghost" className="mt-4" onClick={learnMore}><Play size={14} /> Learn More</Button>
          </div>
          <CatalogPreview />
        </div>
      </Card>

      <div ref={stepsRef} className="scroll-mt-4 space-y-3">
        <Step n={1} title="Add products to your WhatsApp Store" open={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
          <div className="space-y-4">
            <SubRow title="Create your catalog" hint="Add your products to a CSV and upload it here.">
              <Link href="/dashboard/catalog"><Button><Upload size={14} /> Upload CSV</Button></Link>
            </SubRow>
            <div className="flex items-center gap-3 text-[12px] uppercase tracking-wide text-white/30"><span className="h-px flex-1 bg-white/10" />OR<span className="h-px flex-1 bg-white/10" /></div>
            <SubRow title="A. Set up FB Catalog & Collections" hint="Import via Google Sheets or Shopify.">
              <Button variant="ghost">Go to FB <ExternalLink size={13} /></Button>
            </SubRow>
            <SubRow title="B. Give catalog access to the platform" hint="Add the platform as a Catalog Partner in Meta Commerce Manager.">
              <Button variant="ghost">Go to FB <ExternalLink size={13} /></Button>
            </SubRow>
            <SubRow title="C. Connect your catalog to your WhatsApp account" hint="Follow the steps shown in Meta Commerce Manager.">
              <Button variant="ghost">Go to FB <ExternalLink size={13} /></Button>
            </SubRow>
            <SubRow title="D. Enter Facebook Catalog ID" hint="We'll fetch products from this catalog.">
              <div className="flex gap-2">
                <Input value={catalogId} onChange={(e) => setCatalogId(e.target.value)} placeholder="e.g. 1234567890" className="!w-48" />
                <Button loading={connecting} disabled={!catalogId.trim()} onClick={connectCatalog}>Connect</Button>
              </div>
            </SubRow>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] text-white/70">
                {s.meta_catalog_id ? <><Check size={15} className="text-emerald-400" /> Catalog connected ({s.meta_catalog_id})</> : "View your catalog here"}
              </div>
              <Link href="/dashboard/catalog"><Button variant="ghost" size="sm">Open Catalog</Button></Link>
            </div>
          </div>
        </Step>

        <Step n={2} title="Set up messages for product collections & catalogs" open={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
          <p className="text-[13.5px] text-white/60">Create catalog and collection message templates customers receive when they browse your store.</p>
          <Link href="/dashboard/checkout-bot" className="mt-3 inline-block"><Button variant="ghost">Set up messages</Button></Link>
        </Step>

        <Step n={3} title="Send out catalogs in campaigns" open={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
          <p className="text-[13.5px] text-white/60">Attach a catalog to a broadcast so customers can shop straight from the campaign message.</p>
          <Link href="/dashboard/broadcasts" className="mt-3 inline-block"><Button variant="ghost">Go to Broadcasts</Button></Link>
        </Step>

        <Step n={4} title="Send out catalogs in auto-replies" open={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
          <p className="text-[13.5px] text-white/60">Reply to keywords with your catalog automatically.</p>
          <Link href="/dashboard/auto-replies" className="mt-3 inline-block"><Button variant="ghost">Go to Auto-Replies</Button></Link>
        </Step>

        <Step n={5} title="Help customers place orders with the Autocheckout workflow" open={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
          <p className="text-[13.5px] text-white/60">A guided checkout bot that collects the cart, address and payment, then records the order.</p>
          <Link href="/dashboard/checkout-bot" className="mt-3 inline-block"><Button>Set up Checkout Bot</Button></Link>
        </Step>

        <Step n={6} title="See all enquiries & orders you get from customers" badge="soon" open={openStep === 6} onToggle={() => setOpenStep(openStep === 6 ? 0 : 6)}>
          <p className="text-[13.5px] text-white/60">Track every order and enquiry from one place.</p>
          <Link href="/dashboard/order-panel" className="mt-3 inline-block"><Button variant="ghost">Open Order Panel</Button></Link>
        </Step>
      </div>
    </Page>
  );
}

function Step({ n, title, badge, open, onToggle, children }: { n: number; title: string; badge?: "new" | "soon"; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-white">{n}</span>
        <span className="flex-1 text-[15px] font-semibold text-white">{title}</span>
        {badge === "new" && <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-fuchsia-300">New</span>}
        {badge === "soon" && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-white/50">Coming Soon</span>}
        {open ? <ChevronUp size={18} className="text-white/40" /> : <ChevronDown size={18} className="text-white/40" />}
      </button>
      {open && <div className="border-t border-white/10 px-5 py-4">{children}</div>}
    </Card>
  );
}

function SubRow({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[14px] font-medium text-white/90">{title}</div>{hint && <div className="text-[12.5px] text-white/45">{hint}</div>}</div>
      {children}
    </div>
  );
}

/** Original WhatsApp-commerce illustration (inline SVG) — a clean phone showing a product catalog message + cart. No third-party artwork. */
function CatalogPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <svg viewBox="0 0 380 320" className="w-full" role="img" aria-label="Selling products on WhatsApp">
        <defs>
          <linearGradient id="cpBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="cpScreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1a20" />
            <stop offset="1" stopColor="#0a1418" />
          </linearGradient>
          <linearGradient id="cpProd" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3dd0a8" />
            <stop offset="1" stopColor="#0f7c66" />
          </linearGradient>
          <filter id="cpSoft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#04120c" floodOpacity="0.45" />
          </filter>
          <clipPath id="cpClip"><rect x="112" y="24" width="156" height="272" rx="26" /></clipPath>
        </defs>

        {/* soft backdrop + decorative dots */}
        <rect x="6" y="8" width="368" height="304" rx="30" fill="url(#cpBg)" />
        <circle cx="52" cy="70" r="7" fill="var(--brand)" opacity="0.30" />
        <circle cx="336" cy="250" r="9" fill="var(--brand)" opacity="0.22" />
        <circle cx="320" cy="78" r="4" fill="var(--brand)" opacity="0.45" />
        <circle cx="44" cy="238" r="4" fill="var(--brand)" opacity="0.4" />

        {/* phone */}
        <g filter="url(#cpSoft)">
          <rect x="108" y="20" width="164" height="280" rx="30" fill="#05252a" />
          <rect x="112" y="24" width="156" height="272" rx="26" fill="url(#cpScreen)" />
          <g clipPath="url(#cpClip)">
            {/* header */}
            <rect x="112" y="24" width="156" height="42" fill="#0f3d33" />
            <circle cx="132" cy="45" r="10" fill="var(--brand)" />
            <path d="M129 45l3 3 5 -5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="148" y="39" width="62" height="5" rx="2.5" fill="#fff" opacity="0.9" />
            <rect x="148" y="49" width="38" height="4" rx="2" fill="#bfe9d9" opacity="0.7" />
            <circle cx="250" cy="45" r="2" fill="#fff" opacity="0.6" />
            <circle cx="250" cy="38" r="2" fill="#fff" opacity="0.6" />
            <circle cx="250" cy="52" r="2" fill="#fff" opacity="0.6" />

            {/* catalog card */}
            <rect x="124" y="80" width="132" height="128" rx="12" fill="#15252b" />
            <rect x="132" y="88" width="116" height="62" rx="8" fill="url(#cpProd)" />
            {/* neat t-shirt product */}
            <path d="M168 104 L182 100 Q190 110 198 100 L212 104 L208 118 L200 114 L200 142 L180 142 L180 142 L168 142 L168 114 L172 116 Z"
              fill="#ffffff" opacity="0.92" />
            <path d="M182 100 Q190 110 198 100" fill="none" stroke="#0f7c66" strokeWidth="1.5" />
            {/* title + rating */}
            <rect x="132" y="158" width="74" height="6" rx="3" fill="#fff" opacity="0.85" />
            <g fill="#fbbf24">
              <circle cx="135" cy="174" r="2" /><circle cx="142" cy="174" r="2" /><circle cx="149" cy="174" r="2" /><circle cx="156" cy="174" r="2" />
              <circle cx="163" cy="174" r="2" opacity="0.4" />
            </g>
            {/* price + add to cart */}
            <text x="132" y="192" fontSize="12" fontWeight="800" fill="#fff">₹499</text>
            <rect x="182" y="180" width="66" height="16" rx="8" fill="var(--brand)" />
            <text x="215" y="191" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">Add to Cart</text>

            {/* sent reply bubble */}
            <rect x="150" y="222" width="106" height="30" rx="10" fill="#144d3b" />
            <rect x="160" y="230" width="70" height="4.5" rx="2.25" fill="#daf6ea" />
            <rect x="160" y="239" width="46" height="4.5" rx="2.25" fill="#daf6ea" opacity="0.7" />
            <path d="M238 244l3 3 6 -7" fill="none" stroke="#53bdeb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

            {/* input bar */}
            <rect x="124" y="268" width="132" height="20" rx="10" fill="#15252b" />
            <circle cx="246" cy="278" r="9" fill="var(--brand)" />
            <path d="M243 278l3 3 4 -5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
            <path d="M242 274l7 4 -7 4z" fill="#fff" />
          </g>
          {/* speaker */}
          <rect x="176" y="30" width="24" height="4" rx="2" fill="#0a333a" />
        </g>

        {/* floating cart badge */}
        <g filter="url(#cpSoft)" transform="translate(292 108)">
          <circle cx="0" cy="0" r="28" fill="var(--brand)" />
          <path d="M-13 -9h5l3.5 15h13l3.5 -10.5h-17.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="-3.5" cy="10" r="2.4" fill="#fff" />
          <circle cx="7.5" cy="10" r="2.4" fill="#fff" />
          <circle cx="16" cy="-15" r="9" fill="#ef4444" />
          <text x="16" y="-11.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">3</text>
        </g>

        {/* floating price tag */}
        <g filter="url(#cpSoft)" transform="translate(70 196) rotate(-10)">
          <path d="M0 0 h44 a8 8 0 0 1 8 8 v18 a8 8 0 0 1 -8 8 h-44 l-14 -17 z" fill="#fff" />
          <circle cx="6" cy="17" r="4" fill="var(--brand)" />
          <rect x="16" y="9" width="30" height="5" rx="2.5" fill="#0f7c66" />
          <rect x="16" y="20" width="20" height="5" rx="2.5" fill="#9fd8c6" />
        </g>
      </svg>
    </div>
  );
}
