"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Sparkles, Workflow, Zap, MessageSquareReply } from "lucide-react";
import { getSettings, patchSettings, ApiError } from "@/lib/api";

const ACCENT = "#00926B";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Understands messages",
    description: "Reads what a customer means even when their words don't match any exact keyword.",
  },
  {
    icon: Zap,
    title: "Triggers the right automation",
    description: "Routes the message to the correct existing custom reply or flow — never a new one.",
  },
  {
    icon: Workflow,
    title: "Zero setup required",
    description: "Works instantly on top of whatever custom replies and flows you've already built.",
  },
];

export default function IntentMatchingPage() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(({ settings }) => setEnabled((settings.intent_matching_enabled as boolean | undefined) ?? false))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this setting."));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await patchSettings({ intent_matching_enabled: next });
    } catch {
      setEnabled(!next);
      setError("Couldn't update this setting — reverted.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}26` }}>
          <Target className="h-5 w-5" style={{ color: ACCENT }} />
        </span>
        <div>
          <h1 className="text-[20px] font-bold text-white">Intent Matching</h1>
          <p className="text-[13.5px] text-white/50">Let AI pick the right existing reply, instead of relying on exact keyword matches.</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-xl">
        <div>
          <p className="text-[14px] font-semibold text-white">
            Intent Matching is {enabled ? "on" : "off"}
          </p>
          <p className="mt-0.5 text-[12.5px] text-white/50">
            {enabled
              ? "Incoming messages are now matched by intent, not just exact keywords."
              : "Turn this on to route messages by meaning instead of exact keyword matches."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? ACCENT : "rgba(255,255,255,0.15)" }}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}26` }}>
              <f.icon className="h-4 w-4" style={{ color: ACCENT }} />
            </span>
            <h3 className="mt-3 text-[13.5px] font-bold text-white">{f.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/50">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-[13px] font-semibold text-amber-200">Before you turn this on</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-amber-300/80">
          Intent Matching only routes to automations that already exist — it doesn't write new replies on its own.
          Set up a few Custom Replies and Flow Builder flows first so there's something for it to route to.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/custom-replies"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-amber-100 hover:bg-white/15"
          >
            <MessageSquareReply className="h-3.5 w-3.5" />
            Set up Custom Replies
          </Link>
          <Link
            href="/dashboard/flow-builder"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-amber-100 hover:bg-white/15"
          >
            <Workflow className="h-3.5 w-3.5" />
            Build a Flow
          </Link>
        </div>
      </div>
    </div>
  );
}
