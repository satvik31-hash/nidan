"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, MapPin, Video, X } from "lucide-react";
import { cancelAppt } from "@/app/actions/patient";
import { Button } from "@/components/ui";

export function AppointmentActions({
  id, title, start, end, mapsUrl, teleconsult, labels,
}: {
  id: string; title: string; start: string; end: string; mapsUrl: string;
  teleconsult: boolean;
  labels: { reschedule: string; cancel: string; calendar: string; directions: string; join: string };
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start_] = useTransition();

  // .ics download, built client-side — no dependency, works offline.
  const ics = () => {
    const stamp = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
    const body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nidan//EN", "BEGIN:VEVENT",
      `UID:${id}@nidan.in`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${title}`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nidan-appointment.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2 items-center">
      {teleconsult && (
        <button className="pill hover:border-[var(--color-brand)]">
          <Video size={13} /> {labels.join}
        </button>
      )}
      <button onClick={ics} className="pill hover:border-[var(--color-brand)]">
        <CalendarPlus size={13} /> {labels.calendar}
      </button>
      <a href={mapsUrl} target="_blank" rel="noreferrer" className="pill hover:border-[var(--color-brand)]">
        <MapPin size={13} /> {labels.directions}
      </a>
      <Link href="/patient/book" className="pill hover:border-[var(--color-brand)]">
        {labels.reschedule}
      </Link>
      <button
        onClick={() => setConfirming(true)}
        className="pill hover:border-[var(--color-critical)] text-[var(--color-critical)]"
      >
        <X size={13} /> {labels.cancel}
      </button>

      {/* Every destructive action confirms, and cancelling asks why —
          it feeds analytics and takes ten seconds. */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirming(false)} />
          <div className="relative card-elevated p-5 w-full max-w-sm">
            <h3 className="font-semibold">Cancel this appointment?</h3>
            <p className="text-sm text-[var(--color-ink-3)] mt-1">{title}</p>
            <label className="block mt-4">
              <span className="label">Why are you cancelling?</span>
              <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason</option>
                <option>Feeling better</option>
                <option>Cannot make the time</option>
                <option>Going to a different doctor</option>
                <option>Cost</option>
                <option>Other</option>
              </select>
            </label>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={!reason || pending}
                onClick={() => start_(async () => { await cancelAppt(id, reason); setConfirming(false); })}
              >
                {pending ? "Cancelling…" : "Cancel appointment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
