"use client";
import { useEffect } from "react";
export function OfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => { /* IndexedDB still works when cache permission is denied. */ });
  }, []);
  return null;
}
