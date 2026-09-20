"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/dashboard/WorkspaceContext";

/** Slim strip above the dashboard nudging owners to pick a plan when the trial is nearly over or has ended. */
export default function PlanBanner() {
  const { workspace, role } = useWorkspace();
  if (role !== "owner" && role !== "admin") return null;
  let text: string | null = null;
  if (workspace.plan_id === "trial" && workspace.trial_ends_at) {
    const days = Math.ceil((new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    if (days <= 0) text = "Your free trial has ended. Choose a plan to keep your team, automations and campaigns running.";
    else if (days <= 5) text = `Your free trial ends in ${days} day${days === 1 ? "" : "s"}. Choose a plan to keep everything running.`;
  } else if (workspace.plan_id === "free") {
    text = "You're on the free plan. Upgrade to unlock more contacts, team members, automation and AI replies.";
  }
  if (!text) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-brand/30 bg-brand/10 px-4 py-2 text-[12.5px] text-white">
      <Sparkles size={14} className="text-brand" />
      <span>{text}</span>
      <Link href="/dashboard/settings?tab=billing" className="font-semibold text-brand underline-offset-2 hover:underline">See plans</Link>
    </div>
  );
}
