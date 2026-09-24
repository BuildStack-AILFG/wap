"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, googleSignIn, safeNextPath, storeSession } from "@/lib/api";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup"; context?: "signin" | "signup" }) => void;
  renderButton: (el: HTMLElement, o: Record<string, string | number>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisLoader: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoader = null;
      reject(new Error("Couldn't load Google sign-in."));
    };
    document.head.appendChild(s);
  });
  return gisLoader;
}

/** "Continue with Google" via Google Identity Services. Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset. */
export default function GoogleSignInButton({ mode, companyName }: { mode: "login" | "signup"; companyName?: string }) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const company = useRef(companyName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  company.current = companyName;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        const id = window.google?.accounts.id;
        if (cancelled || !id || !holder.current) return;
        id.initialize({
          client_id: CLIENT_ID,
          ux_mode: "popup",
          context: mode === "signup" ? "signup" : "signin",
          callback: async ({ credential }) => {
            setBusy(true);
            setError(null);
            try {
              const auth = await googleSignIn({ credential, companyName: company.current });
              storeSession(auth);
              router.push(auth.must_rotate_password ? "/rotate-password" : safeNextPath() ?? "/dashboard");
            } catch (err) {
              setError(errorMessage(err, "Google sign-in failed. Please try again."));
              setBusy(false);
            }
          },
        });
        holder.current.innerHTML = "";
        id.renderButton(holder.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: mode === "signup" ? "signup_with" : "continue_with",
          width: Math.min(400, holder.current.offsetWidth || 400),
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [mode, router]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[12px] uppercase tracking-wider text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div ref={holder} className={`flex min-h-[44px] justify-center ${busy ? "pointer-events-none opacity-60" : ""}`} />
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>}
    </div>
  );
}
