"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import { clearSession, getRefreshToken, logout } from "@/lib/api";
import { useWorkspace } from "./WorkspaceContext";

const ACCENT = "var(--brand)";
const GLASS_BORDER = "color-mix(in srgb, var(--foreground) 10%, transparent)";

function useTrialBanner() {
  const { workspace } = useWorkspace();
  const [now] = useState(() => Date.now());
  if (workspace.plan_id !== "trial" || !workspace.trial_ends_at) return null;

  const daysLeft = Math.ceil((new Date(workspace.trial_ends_at).getTime() - now) / 86_400_000);

  if (daysLeft <= 0) {
    return { expired: true as const, daysLeft: 0 };
  }
  return { expired: false as const, daysLeft };
}

export default function TopBar() {
  const router = useRouter();
  const trial = useTrialBanner();
  const { workspace, full_name, email } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = workspace.name.trim().charAt(0).toUpperCase() || "?";

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // Best-effort — clear the local session regardless.
      }
    }
    clearSession();
    router.push("/login");
  };

  return (
    <div className="sticky top-0 z-30">
      {trial && (
        <div className="flex items-center justify-between gap-3 bg-red-950/60 px-4 py-2 text-[13px] text-red-300 sm:px-6">
          <span>
            {trial.expired
              ? "Your trial has expired. Please start your subscription to continue using automations."
              : `Your trial ends in ${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"}. Subscribe to keep your automations running.`}
          </span>
          <Link
            href="/dashboard/settings?tab=billing"
            className="shrink-0 rounded bg-red-600 px-3 py-1 text-[12.5px] font-semibold text-white hover:bg-red-500"
          >
            {trial.expired ? "Start your subscription →" : "Start subscription →"}
          </Link>
        </div>
      )}
      <div
        className="flex h-14 items-center justify-between px-4 backdrop-blur-xl sm:px-6"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", borderBottom: `1px solid ${GLASS_BORDER}` }}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white">
            <WhatsAppIcon className="h-4 w-4" />
          </span>
          <span className="text-[16px] font-normal tracking-tight text-white">LeadForGrow</span>
        </Link>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="btn-accent flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              {initial}
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl p-3 shadow-2xl backdrop-blur-xl"
                  style={{ backgroundColor: "color-mix(in srgb, var(--surface) 94%, transparent)", border: `1px solid ${GLASS_BORDER}` }}
                >
                  <p className="truncate text-[13.5px] font-semibold text-white">{workspace.name}</p>
                  <p className="truncate text-[12px] text-white/50">{workspace.plan_name} plan</p>
                  <div className="my-2" style={{ borderTop: `1px solid ${GLASS_BORDER}` }} />
                  <p className="truncate text-[12.5px] text-white/80">{full_name || email}</p>
                  <p className="truncate text-[11.5px] text-white/40">{email}</p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
