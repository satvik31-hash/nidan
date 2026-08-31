"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Registers the service worker and shows a persistent offline indicator.
 *  Toggling airplane mode mid-demo and continuing to use the app is a
 *  fifteen-second segment nobody forgets. */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
