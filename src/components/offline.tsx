"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Registers the service worker and shows a persistent offline indicator.
 *  Toggling airplane mode mid-demo and continuing to use the app is a
 *  fifteen-second segment nobody forgets.
 *
 *  Set NEXT_PUBLIC_DISABLE_SW=true to turn the worker off and actively
 *  unregister any copy already installed in the visitor's browser. It is a
 *  demo-day kill switch: a service worker is the one part of this app that
 *  keeps running after a bad deploy, and being able to disable it from an
 *  environment variable — with no code change and no cache to clear by hand —
 *  is worth the six lines. */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const disabled = process.env.NEXT_PUBLIC_DISABLE_SW === "true";
    if ("serviceWorker" in navigator) {
      if (disabled) {
        // Unregister, and drop the caches too — an unregistered worker leaves
        // its caches behind, and a stale cached page is the whole problem.
        navigator.serviceWorker.getRegistrations()
          .then((rs) => Promise.all(rs.map((r) => r.unregister())))
          .then(() => caches?.keys())
          .then((keys) => Promise.all((keys ?? []).map((k) => caches.delete(k))))
          .catch(() => {});
      } else if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-2 text-sm shadow-[var(--shadow-modal)]"
    >
      <WifiOff size={15} />
      Offline — your records, emergency card and first aid still work
    </div>
  );
}
