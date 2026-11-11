"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasSession, safeNextPath } from "@/lib/api";

/** On the login/signup pages: a visitor who is already signed in goes straight to the dashboard (or the page they asked for).
 *  If the stored session turns out to be dead, the dashboard's AuthGuard clears it and sends them back here, so this can't loop. */
export default function RedirectIfSignedIn() {
  const router = useRouter();
  useEffect(() => {
    if (hasSession()) router.replace(safeNextPath() ?? "/dashboard");
  }, [router]);
  return null;
}
