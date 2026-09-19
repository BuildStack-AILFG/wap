"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearSession, getMe, ApiError, type MeResponse } from "@/lib/api";
import { WorkspaceContext } from "./WorkspaceContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    const latest = await getMe();
    setMe(latest);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    getMe()
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/login");
        }
      });
  }, [router]);

  if (!me) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <p className="text-[14px] text-white/60">Loading…</p>
      </div>
    );
  }

  return <WorkspaceContext.Provider value={{ ...me, refresh }}>{children}</WorkspaceContext.Provider>;
}
