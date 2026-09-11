"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/utils";

interface Alert {
  id: string;
  patientName: string;
  slotStart: string;
  createdAt: string;
}

const POLL_MS = 15_000;
const AUTO_DISMISS_MS = 8_000;

// Polls /api/doctor/booking-alerts for bookings made since the doctor
// opened the console and shows each as a small toast — "Sunita Kale booked
// 9:00 am, 11 Sept". Runs inside the doctor shell, so it's live wherever
// that shell renders, mobile app's Doctor WebView tab included, with no
// separate native/push code needed there.
export function BookingAlerts() {
  const [toasts, setToasts] = useState<Alert[]>([]);
  const sinceRef = useRef(new Date().toISOString());
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/doctor/booking-alerts?since=${encodeURIComponent(sinceRef.current)}`);
        if (!res.ok) return;
        const { alerts } = (await res.json()) as { alerts: Alert[] };
        if (stopped || alerts.length === 0) return;
        const fresh = alerts.filter((a) => !seenIds.current.has(a.id));
        if (fresh.length === 0) return;
        fresh.forEach((a) => seenIds.current.add(a.id));
        sinceRef.current = alerts[alerts.length - 1].createdAt;
        setToasts((t) => [...t, ...fresh]);
        fresh.forEach((a) => {
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), AUTO_DISMISS_MS);
        });
      } catch {
        // A missed poll just tries again in POLL_MS — nothing to surface.
      }
    };
    const t = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(t); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 max-w-xs">
      {toasts.map((a) => (
        <div key={a.id} className="card-elevated p-3 flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)] grid place-items-center shrink-0">
            <CalendarPlus size={15} />
          </span>
          <div className="text-sm min-w-0">
            <p className="font-medium truncate">{a.patientName} booked an appointment</p>
            <p className="text-[var(--color-ink-3)] text-xs mt-0.5">
              {fmtDate(a.slotStart)} · {fmtTime(a.slotStart)}
            </p>
          </div>
          <button
            onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))}
            aria-label="Dismiss"
            className="ml-auto text-[var(--color-ink-3)] hover:text-[var(--color-ink)] shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
