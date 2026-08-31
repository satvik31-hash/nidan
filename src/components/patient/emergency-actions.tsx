"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { MapPin, Phone, Share2 } from "lucide-react";

export function EmergencyActions({
  contacts, labels,
}: {
  contacts: { name: string; phone: string; relation: string; primary: boolean }[];
  labels: { shareLocation: string; emergencyContacts: string };
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const primary = contacts.find((c) => c.primary) ?? contacts[0];

  const share = () => {
    setStatus("Finding you…");
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        const link = `https://maps.google.com/?q=${lat},${lng}`;
        const text = `I need help. My location: ${link}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: "My location", text, url: link });
            setStatus("Shared.");
            return;
          } catch { /* fall through to copy */ }
        }
        try {
          await navigator.clipboard.writeText(text);
          setStatus("Location copied. Paste it into any message.");
        } catch {
          setStatus(link);
        }
      },
      () => setStatus("Could not get your location. Turn on location access."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <Card>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          onClick={share}
          className="rounded-[6px] border border-[var(--color-line)] py-4 px-4 text-left hover:border-[var(--color-brand)]"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Share2 size={18} className="text-[var(--color-brand)]" /> {labels.shareLocation}
          </span>
          <span className="block text-xs text-[var(--color-ink-3)] mt-0.5">
            Sends coordinates and a map link to your primary contact.
          </span>
        </button>

        {primary && coords && (
          <a
            href={`sms:${primary.phone}?body=${encodeURIComponent(`I need help. My location: https://maps.google.com/?q=${coords.lat},${coords.lng}`)}`}
            className="rounded-[6px] border border-[var(--color-critical)] py-4 px-4 text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-[var(--color-critical)]">
              <MapPin size={18} /> Text it to {primary.name}
            </span>
            <span className="block text-xs text-[var(--color-ink-3)] mt-0.5">{primary.phone}</span>
          </a>
        )}
      </div>

      {status && (
        <p className="text-sm text-[var(--color-ink-2)] mt-2" aria-live="polite">{status}</p>
      )}

      <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
        <div className="eyebrow mb-2">{labels.emergencyContacts}</div>
        <div className="flex flex-wrap gap-2">
          {contacts.map((c) => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              className={`pill px-3 py-2 hover:border-[var(--color-critical)] ${
                c.primary ? "border-[var(--color-critical)] text-[var(--color-critical)]" : ""
              }`}
            >
              <Phone size={13} /> {c.name} · {c.relation}
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}
