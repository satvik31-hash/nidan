import Link from "next/link";
import { getLocale, requirePatient } from "@/lib/auth";
import {
  allergiesFor, contactsFor, emergencyCardFor, historyFor, listAmbulance,
  listHospitals, medicationsFor, patientHeader,
} from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { Badge, Card } from "@/components/ui";
import { EmergencyActions } from "@/components/patient/emergency-actions";
import { FirstAid } from "@/components/patient/first-aid";
import { QrBlock } from "@/components/qr";
import { Phone, MapPin, WifiOff } from "lucide-react";

// Deliberately the loudest screen in the app: high contrast, oversized
// targets, no scroll needed for the primary action.

export default async function Emergency() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const actor = { id: session.userId, role: "patient" as const };
  const p = patientHeader(session.userId)!;
  const allergies = allergiesFor(actor, session.userId);
  const meds = medicationsFor(actor, session.userId).current;
  const { chronic } = historyFor(actor, session.userId);
  const contacts = contactsFor(session.userId);
  const card = emergencyCardFor(session.userId);
  const ambulances = listAmbulance();
  const hospitals = listHospitals();

  return (
    <div className="space-y-4">
      {/* Primary action, above everything, full width. */}
      <a
        href="tel:108"
        className="block w-full rounded-[8px] bg-[var(--color-critical)] text-[var(--color-on-critical)] text-center py-6 text-[1.5rem] font-bold tracking-tight active:scale-[0.99] transition-transform"
      >
        <Phone size={26} className="inline mb-1 mr-2" />
        {m.call108}
      </a>

      <div className="grid gap-2 sm:grid-cols-2">
        <a href="tel:112" className="card p-4 text-center font-semibold text-[1.0625rem] hover:border-[var(--color-critical)]">
          {m.call112}
          <span className="block text-xs font-normal text-[var(--color-ink-3)]">
            National emergency number
          </span>
        </a>
        <a
          href={`tel:${hospitals[0].emergency_phone ?? hospitals[0].phone}`}
          className="card p-4 text-center font-semibold text-[1.0625rem] hover:border-[var(--color-critical)]"
        >
          {hospitals[0].name.split(" ")[0]} Emergency
          <span className="block text-xs font-normal text-[var(--color-ink-3)]">
            {hospitals[0].emergency_phone ?? hospitals[0].phone}
          </span>
        </a>
      </div>

      <EmergencyActions
        contacts={contacts.map((c) => ({ name: c.name, phone: c.phone, relation: c.relation, primary: c.is_primary }))}
        labels={{ shareLocation: m.shareLocation, emergencyContacts: m.emergencyContacts }}
      />

      {/* ── My emergency card: the QR, plus the critical data rendered
             large and legible on screen. Works offline from the service
             worker cache. ─────────────────────────────────────────── */}
      <Card className="border-[color-mix(in_srgb,var(--color-critical)_35%,transparent)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-[1.0625rem]">{m.myEmergencyCard}</h2>
            <p className="text-xs text-[var(--color-ink-3)] flex items-center gap-1">
              <WifiOff size={12} /> {m.worksOffline}
            </p>
          </div>
          <Link href="/patient/card" className="pill hover:border-[var(--color-brand)]">
            Print
          </Link>
        </div>

        <div className="flex flex-wrap gap-5">
          {card && (
            <div className="text-center">
              <QrBlock value={`/e/${card.token}`} size={132} />
              <p className="font-mono text-[0.625rem] text-[var(--color-ink-3)] mt-1">{card.token}</p>
            </div>
          )}

          <dl className="flex-1 min-w-[220px] space-y-3">
            <Big label={m.bloodGroup} value={p.blood_group} tone="critical" />
            <div>
              <dt className="eyebrow">{m.allergies}</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {allergies.length === 0 ? (
                  <span className="text-[var(--color-ink-3)]">None recorded</span>
                ) : (
                  allergies.map((a) => (
                    <Badge key={a.id} tone={a.severity === "mild" ? "warning" : "critical"}>
                      {a.allergen} · {a.severity}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{m.medications}</dt>
              <dd className="text-[1.0625rem] leading-snug">
                {meds.length === 0 ? "None" : meds.map((x) => x.drug_text.split(" (")[0]).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{m.chronicConditions}</dt>
              <dd className="text-[1.0625rem] leading-snug">
                {chronic.length === 0 ? "None" : chronic.map((c) => c.condition).join(", ")}
              </dd>
            </div>
            <Big label={m.organDonor} value={p.organ_donor.replace("_", " ")} />
          </dl>
        </div>

        <p className="text-xs text-[var(--color-ink-3)] mt-4 pt-3 border-t border-[var(--color-line)]">
          Anyone scanning this QR sees only the six items above — no login needed,
          because that is what saves a life. Every scan is logged and you get an SMS
          within seconds. Manage or revoke the card from your{" "}
          <Link href="/patient/card" className="text-[var(--color-brand)] underline">card page</Link>.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">{m.nearestHospitals}</h2>
        <ul className="space-y-2">
          {hospitals.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium text-sm">{h.name}</p>
                <p className="text-xs text-[var(--color-ink-3)]">{h.address}, {h.city}</p>
              </div>
              <a href={`tel:${h.emergency_phone ?? h.phone}`} className="pill hover:border-[var(--color-critical)]">
                <Phone size={13} /> Call
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                target="_blank" rel="noreferrer"
                className="pill hover:border-[var(--color-brand)]"
              >
                <MapPin size={13} /> Directions
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold mb-1">Ambulance numbers</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          {ambulances.map((a) => (
            <a key={a.id} href={`tel:${a.phone}`} className="pill hover:border-[var(--color-critical)] px-3 py-2">
              <Phone size={13} /> {a.name} · {a.phone}
            </a>
          ))}
        </div>
      </Card>

      <FirstAid locale={locale} />
    </div>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone?: "critical" }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`text-[1.75rem] font-bold leading-none capitalize ${
          tone === "critical" ? "text-[var(--color-critical)]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
