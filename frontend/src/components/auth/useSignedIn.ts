"use client";

import { useEffect, useState } from "react";
import { hasSession } from "@/lib/api";

/** Whether this browser already has a session. False on the server and the first render, so markup hydrates cleanly. */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(hasSession());
    const onStorage = () => setSignedIn(hasSession()); // signed in or out in another tab
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return signedIn;
}
