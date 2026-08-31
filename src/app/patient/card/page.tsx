import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import {
  allergiesFor, contactsFor, emergencyCardFor, historyFor, medicationsFor, patientHeader,
} from "@/lib/db/store";
import { Card } from "@/components/ui";
import { QrBlock } from "@/components/qr";
import { PrintButton } from "@/components/print-button";
import { CardControls } from "@/components/patient/card-controls";
import { ageString } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

// A printable card: photo, MRN, blood group, allergies and the emergency QR.
// Handing a judge a physical print-out is a good moment.

export default async function HealthCard() {
  const session = await requirePatient();
  const actor = { id: session.userId, role: "patient" as const };
  const p = patientHeader(session.userId)!;
  const allergies = allergiesFor(actor, session.userId);
  const meds = medicationsFor(actor, session.userId).current;
  const { chronic } = historyFor(actor, session.userId);
  const contacts = contactsFor(session.userId);
  const card = emergencyCardFor(session.userId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/patient/profile" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]">
          <ArrowLeft size={16} /> Back
        </Link>
        <PrintButton label="Print card" />
      </div>

      {/* CR80-ish proportions so it prints onto a card sleeve sensibly. */}
      <div className="mx-auto w-full max-w-[420px] card-elevated overflow-hidden print:shadow-none">
        <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-3 flex items-center justify-between">
          <span className="font-bold tracking-tight">
            Ni<span className="text-[var(--color-brand)]">dan</span>
          </span>
          <span className="text-[0.625rem] uppercase tracking-[0.14em] opacity-70">
            Emergency health card
          </span>
        </div>

        <div className="p-4 flex gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[1.25rem] font-bold leading-tight">{p.full_name}</p>
            <p className="text-sm text-[var(--color-ink-3)]">
              {ageString(p.date_of_birth)} · {p.sex} · {p.city}
            </p>
            <p className="font-mono text-xs mt-1">{p.mrn}</p>
            {p.abha_number && (
              <p className="font-mono text-[0.6875rem] text-[var(--color-ink-3)]">
                ABHA {p.abha_number}
              </p>
            )}
            <p className="mt-3">
              <span className="eyebrow">Blood group</span>
              <span className="block text-[2rem] font-bold leading-none text-[var(--color-critical)]">
                {p.blood_group}
              </span>
            </p>
          </div>
          {card && (
            <div className="text-center shrink-0">
              <QrBlock value={`/e/${card.token}`} size={110} />
              <p className="text-[0.5625rem] text-[var(--color-ink-3)] mt-1 max-w-[110px]">
                Scan for allergies, medicines and contacts
              </p>
            </div>
          )}
        </div>

        <dl className="px-4 pb-4 space-y-2 text-sm">
          <Row label="Allergies" value={allergies.length ? allergies.map((a) => `${a.allergen} (${a.severity})`).join(", ") : "None recorded"} critical={allergies.length > 0} />
          <Row label="Current medicines" value={meds.length ? meds.map((x) => x.drug_text.split(" (")[0]).join(", ") : "None"} />
          <Row label="Ongoing conditions" value={chronic.length ? chronic.map((c) => c.condition).join(", ") : "None"} />
          <Row label="Organ donor" value={p.organ_donor.replace("_", " ")} />
          <Row
            label="In an emergency call"
            value={contacts.map((c) => `${c.name} ${c.phone}`).join(" · ") || "—"}
          />
        </dl>

        <div className="bg-[var(--color-paper)] px-4 py-2 text-[0.625rem] text-[var(--color-ink-3)] border-t border-[var(--color-line)]">
          Every scan is logged and the cardholder is notified. Ambulance 108 · Emergency 112
        </div>
      </div>

      <div className="no-print max-w-[420px] mx-auto">
        <Card>
          <h3 className="font-semibold text-sm mb-1">Card control</h3>
          <p className="text-xs text-[var(--color-ink-3)] mb-3">
            If you lose the printed card, revoke it — the QR stops resolving
            immediately. Issuing a new one gives you a fresh token.
          </p>
          <CardControls token={card?.token ?? null} />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, critical }: { label: string; value: string; critical?: boolean }) {
  return (
    <div className="border-t border-[var(--color-line)] pt-2">
      <dt className="eyebrow">{label}</dt>
      <dd className={critical ? "text-[var(--color-critical)] font-medium" : ""}>{value}</dd>
    </div>
  );
}
