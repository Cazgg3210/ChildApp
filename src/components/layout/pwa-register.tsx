"use client";

import { useEffect } from "react";

/**
 * Registers the minimal service worker (app shell only — it never caches
 * private routes or API responses; see public/sw.js).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures are non-fatal */
    });
  }, []);
  return null;
}
