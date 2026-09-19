"use client";

import { useEffect, useState } from "react";
import { Rocket, SlidersHorizontal, Link2, Crown, Phone, Info, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import { listContacts, listFlows } from "@/lib/api";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

const ACCENT = "#00926B";

export default function DashboardHome() {
  const me = useWorkspace();
  const [showConnectNotice, setShowConnectNotice] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [flowCount, setFlowCount] = useState<number | null>(null);

  useEffect(() => {
    listContacts().then((c) => setContactCount(c.length)).catch(() => setContactCount(0));
    listFlows().then((f) => setFlowCount(f.length)).catch(() => setFlowCount(0));
  }, []);

  const hasBasicSetup = (contactCount ?? 0) > 0;
  const isPaidPlan = !["trial", "free"].includes(me.workspace.plan_id);

  const steps = [
    { icon: Rocket, label: "Start Onboarding", done: true },
    { icon: SlidersHorizontal, label: "Add Your First Contact", done: hasBasicSetup },
    { icon: Link2, label: "Connect Number", done: false },
    { icon: Crown, label: "Start Subscription", done: isPaidPlan },
  ];

  const displayName = me.full_name?.trim().split(" ")[0] || me.workspace.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-bold text-white">Hello 👋 Welcome, {displayName}!</h1>
      <p className="mt-1 text-[14px] text-white/50">Let&apos;s get your WhatsApp Business number automated.</p>

      {/* Onboarding progress banner */}
      <div
        className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 px-6 py-6 text-white sm:px-8"
        style={{ backgroundImage: `linear-gradient(90deg, #000000, ${ACCENT}33)` }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-bold sm:text-[16px]">Complete onboarding to unlock your automation credits</p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/50">
              <Info className="h-3.5 w-3.5" /> Connect your number and set up your first flow
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 overflow-x-auto">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex flex-1 items-center gap-2 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: step.done ? ACCENT : "rgba(255,255,255,0.1)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: step.done ? "#FFFFFF" : "rgba(255,255,255,0.6)" }} />
                  </span>
                  <span className="max-w-[110px] text-[11px] font-semibold leading-tight">{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="h-px flex-1" style={{ backgroundColor: step.done ? ACCENT : "rgba(255,255,255,0.15)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>
              <Phone className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">WhatsApp number not connected</p>
              <p className="text-[12px] text-white/40">Connect via the official WhatsApp Business API</p>
            </div>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowConnectNotice((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
              style={{ backgroundColor: ACCENT }}
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              Connect WhatsApp
            </button>
            {showConnectNotice && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-white/10 bg-[#0F0F0F] p-3 text-[12px] text-white/60 shadow-lg backdrop-blur-xl">
                WhatsApp connection isn&apos;t wired up yet — this will walk you through linking
                your Meta WhatsApp Business number soon.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60">
              <SlidersHorizontal className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">
                {flowCount === null ? "Loading flows…" : flowCount === 0 ? "No automation flows yet" : `${flowCount} automation flow${flowCount === 1 ? "" : "s"}`}
              </p>
              <p className="text-[12px] text-white/40">Build your first auto-reply or flow</p>
            </div>
          </div>
          <a
            href="/dashboard/flow-builder"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/5"
          >
            {flowCount ? "View flows" : "Create flow"}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Plan upsell */}
      {!isPaidPlan && (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg" style={{ backgroundColor: ACCENT }} />
            <p className="text-[14px] font-semibold text-white">Unlock more with a paid plan</p>
          </div>
          <a
            href="/dashboard/settings"
            className="shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            Subscribe to a plan
          </a>
        </div>
      )}
    </div>
  );
}
