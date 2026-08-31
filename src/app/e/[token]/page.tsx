import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { breakGlass } from "@/lib/db/store";
import { Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { AlertTriangle, Phone, ShieldAlert } from "lucide-react";

// The public emergency page. Scanning the QR — by anyone, with no login —
// opens a read-only slice: blood group, allergies, current medications,
// chronic conditions, organ donor status and emergency contacts.
//
// It is not silent. The read is written to access_audit with basis
// 'emergency_override', the patient gets an SMS within seconds, and if the
// scanner is a signed-in doctor the relationship auto-expires in six hours.

export const dynamic = "force-dynamic";

export default async function EmergencyCardPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  const h = await headers();
  const data = breakGlass(token, session?.userId ?? null, h.get("user-agent"));

  if (!data) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="card p-8 max-w-sm text-center">
          <AlertTriangle size={28} className="mx-auto text-[var(--color-warning)]" />
          <h1 className="font-semibold mt-3">This card is not valid</h1>
          <p className="text-sm text-[var(--color-ink-3)] mt-1">
            It may have been revoked by its owner, or the code was mistyped.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--color-paper)]">
      <div className="bg-[var(--color-critical)] text-[var(--color-on-critical)] px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <ShieldAlert size={18} />
          <p className="text-sm font-medium">
            Emergency record · read-only · this access has been logged and the patient notified
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">
        <header>
          <h1 className="text-[2rem] font-bold tracking-tight leading-none">{data.name}</h1>
          <p className="text-[var(--color-ink-2)] mt-1">
            {data.age} years · {data.sex} · <span className="font-mono">{data.mrn}</span>
          </p>
        </header>

        <section className="card p-5">
          <div className="eyebrow">Blood group</div>
          <p className="text-[3.5rem] font-bold leading-none text-[var(--color-critical)]">
            {data.blood_group}
          </p>
        </section>

        <section className="card p-5 border-[color-mix(in_srgb,var(--color-critical)_45%,transparent)]">
          <div className="eyebrow mb-2">Allergies</div>
          {data.allergies.length === 0 ? (
            <p className="text-[1.25rem]">None recorded</p>
          ) : (
            <ul className="space-y-2">
              {data.allergies.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[1.5rem] font-bold text-[var(--color-critical)]">
                    {a.allergen}
                  </span>
                  <Badge tone={a.severity === "mild" ? "warning" : "critical"}>{a.severity}</Badge>
                  {a.reaction && <span className="text-sm text-[var(--color-ink-2)]">{a.reaction}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="eyebrow mb-2">Current medications</div>
          {data.medications.length === 0 ? (
            <p className="text-[1.125rem]">None</p>
          ) : (
            <ul className="space-y-1 text-[1.125rem]">
              {data.medications.map((med) => (
                <li key={med.id}>
                  {med.drug_text} {med.dose}
                  <span className="text-[var(--color-ink-3)] font-mono text-sm"> {med.frequency}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="eyebrow mb-2">Ongoing conditions</div>
          <ul className="space-y-1 text-[1.125rem]">
            {data.conditions.length === 0
              ? <li>None</li>
              : data.conditions.map((c) => (
                  <li key={c.id}>
                    {c.condition}
                    {c.on_treatment && <span className="text-sm text-[var(--color-ink-3)]"> · on treatment</span>}
                  </li>
                ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="eyebrow mb-2">Organ donor</div>
          <p className="text-[1.25rem] capitalize">{data.organ_donor.replace("_", " ")}</p>
        </section>

        <section className="card p-5">
          <div className="eyebrow mb-2">Emergency contacts</div>
          <div className="flex flex-col gap-2">
            {data.contacts.map((c) => (
              <a
                key={c.id}
                href={`tel:${c.phone}`}
                className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--color-line)] px-4 py-3 hover:border-[var(--color-critical)]"
              >
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-[var(--color-ink-3)]"> · {c.relation}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[var(--color-critical)] font-medium">
                  <Phone size={16} /> {c.phone}
                </span>
              </a>
            ))}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <a href="tel:108" className="rounded-[8px] bg-[var(--color-critical)] text-[var(--color-on-critical)] text-center py-4 font-bold text-[1.125rem]">
            Call 108 Ambulance
          </a>
          <a href="tel:112" className="rounded-[8px] border border-[var(--color-line)] text-center py-4 font-semibold text-[1.125rem]">
            Call 112
          </a>
        </div>

        <p className="text-xs text-[var(--color-ink-3)] pb-8">
          Accessed {fmtDateTime(data.scanned_at)}
          {session ? ` by ${session.name}` : " anonymously"}. This page shows only the
          fields above; nothing else in the record is reachable from here. The
          cardholder can revoke this card at any time.
        </p>
      </div>
    </main>
  );
}
