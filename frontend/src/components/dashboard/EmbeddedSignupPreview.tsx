"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Facebook, Lock, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Button, cx, Modal } from "@/components/ui/kit";

const STEPS = [
  { id: "login", label: "Log in", icon: Facebook, title: "Log in with Facebook", body: "You sign in with the Facebook account that manages your business." },
  { id: "business", label: "Business", icon: Building2, title: "Choose your business portfolio", body: "Pick the Meta business portfolio that will own the WhatsApp Business account." },
  { id: "waba", label: "WhatsApp account", icon: MessageCircle, title: "Choose or create a WhatsApp Business account", body: "Select an existing account or create a new one." },
  { id: "phone", label: "Number", icon: Phone, title: "Add and verify your number", body: "Enter the number and confirm the 6-digit code sent by SMS or call." },
  { id: "allow", label: "Allow", icon: ShieldCheck, title: "Allow LeadForGrow to manage messages", body: "Review the permissions, then finish. We set up webhooks for you." },
] as const;

/**
 * A wireframe of Meta's "Continue with Facebook" (WhatsApp Embedded Signup) window, shown while META_APP_ID / META_APP_SECRET / META_CONFIG_ID aren't set
 * on the server. It walks through the steps the real window has but connects nothing; once those values are added, the button opens Meta's real window
 * and this component is no longer reached.
 */
export default function EmbeddedSignupPreview({ onClose, onManual }: { onClose: () => void; onManual: () => void }) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <Modal open onClose={onClose} title="Connect with Facebook" width={560}
      footer={<><Button variant="ghost" onClick={onManual}>Connect manually instead</Button><Button variant="ghost" onClick={onClose}>Close preview</Button></>}>
      <div className="space-y-4">

        <div className="theme-fixed overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-800 shadow-lg">
          <div className="flex items-center gap-3 bg-[#1877F2] px-5 py-3.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1877F2]"><Facebook size={18} /></span>
            <div className="flex-1"><p className="text-[14px] font-semibold leading-tight">Connect WhatsApp Business</p><p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/80"><Lock size={11} /> Secure sign-in <span className="rounded bg-amber-300 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[#0B2A5B]">Preview</span></p></div>
            <span className="text-[12px] text-white/80">Step {i + 1} of {STEPS.length}</span>
          </div>

          <ol className="flex items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            {STEPS.map((s, n) => (
              <li key={s.id} className="flex flex-1 items-center gap-1.5">
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", n < i || done ? "bg-emerald-500 text-white" : n === i ? "bg-[#1877F2] text-white" : "bg-neutral-200 text-neutral-500")}>{n < i || done ? "✓" : n + 1}</span>
                <span className={cx("hidden truncate text-[11.5px] sm:block", n === i ? "font-semibold text-neutral-900" : "text-neutral-400")}>{s.label}</span>
              </li>
            ))}
          </ol>

          <div className="min-h-[190px] p-6">
            {done ? (
              <div className="flex flex-col items-center py-4 text-center">
                <CheckCircle2 size={40} className="text-emerald-500" />
                <p className="mt-3 text-[16px] font-semibold text-neutral-900">This is where your number gets connected</p>
                <p className="mt-1 max-w-sm text-[13px] text-neutral-500">With the credentials in place, finishing here links your WhatsApp Business number and returns you to LeadForGrow — no copy-pasting tokens.</p>
              </div>
            ) : (
              <>
                <step.icon size={26} className="text-[#1877F2]" />
                <h4 className="mt-3 text-[17px] font-semibold text-neutral-900">{step.title}</h4>
                <p className="mt-1 text-[13px] text-neutral-500">{step.body}</p>
                <div className="mt-4 space-y-2">
                  {step.id === "login" && <><input disabled placeholder="Email or phone number" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px]" /><input disabled placeholder="Password" className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px]" /></>}
                  {step.id === "business" && ["Your business portfolio", "Create a new portfolio"].map((b) => <div key={b} className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-600">{b}</div>)}
                  {step.id === "waba" && ["Your WhatsApp Business account", "Create a new WhatsApp Business account"].map((b) => <div key={b} className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-600">{b}</div>)}
                  {step.id === "phone" && <div className="flex gap-2"><span className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-500">+91</span><input disabled placeholder="Phone number" className="flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px]" /></div>}
                  {step.id === "allow" && ["Manage your WhatsApp Business account", "Send and receive messages"].map((b) => <div key={b} className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-600"><CheckCircle2 size={14} className="text-emerald-500" />{b}</div>)}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
            <button type="button" disabled={i === 0 && !done} onClick={() => (done ? setDone(false) : setI(i - 1))} className="rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">Back</button>
            {done ? <span className="text-[12px] font-medium text-amber-700">Preview mode — nothing was connected</span>
              : <button type="button" onClick={() => (last ? setDone(true) : setI(i + 1))} className="rounded-lg bg-[#1877F2] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#1668D9]">{last ? "Finish" : "Continue"}</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
