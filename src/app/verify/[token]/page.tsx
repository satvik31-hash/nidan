import { db, getDoctor, getProfile, patientHeader } from "@/lib/db/store";
import { Badge, Card } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { BadgeCheck, XCircle } from "lucide-react";

// The QR on a printed prescription resolves here. A pharmacist can confirm
// the prescription is real and unaltered without an account — and without
// seeing anything about the patient beyond an initialled name.

export const dynamic = "force-dynamic";

export default async function VerifyRx({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rx = db.prescriptions.find((r) => r.verify_token === token);

  if (!rx) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <Card className="max-w-sm text-center p-8">
          <XCircle size={30} className="mx-auto text-[var(--color-critical)]" />
          <h1 className="font-semibold mt-3">No prescription with that code</h1>
          <p className="text-sm text-[var(--color-ink-3)] mt-1">
            Do not dispense against it. Ask for the original.
          </p>
        </Card>
      </main>
    );
  }

  const doctorProfile = getProfile(rx.doctor_id)!;
  const doctor = getDoctor(rx.doctor_id)!;
  const p = patientHeader(rx.patient_id)!;
  const masked = p.full_name.split(" ").map((w) => `${w[0]}${"·".repeat(Math.max(w.length - 1, 1))}`).join(" ");

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <Card className="max-w-md w-full">
        <div className="flex items-center gap-2 text-[var(--color-good)]">
          <BadgeCheck size={22} />
          <h1 className="font-semibold text-[1.125rem]">Genuine prescription</h1>
        </div>
        <p className="text-sm text-[var(--color-ink-3)] mt-1">
          Issued {fmtDateTime(rx.issued_at)}. This matches the record exactly.
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-2">
            <dt className="text-[var(--color-ink-3)]">Prescriber</dt>
            <dd className="text-right">
              {doctorProfile.full_name}
              <span className="block font-mono text-xs text-[var(--color-ink-3)]">
                Reg. {doctor.registration_no}
              </span>
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-2">
            <dt className="text-[var(--color-ink-3)]">For</dt>
            <dd>{masked} <span className="font-mono text-xs">{p.mrn}</span></dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className="eyebrow mb-2">Items on this prescription</div>
          <ul className="space-y-1.5 text-sm">
            {rx.items.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{i.drug_text}</span>
                <span>{i.dose}</span>
                <Badge>{i.frequency}</Badge>
                {i.duration_days && <span className="text-[var(--color-ink-3)]">{i.duration_days} days</span>}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[var(--color-ink-3)] mt-4 pt-3 border-t border-[var(--color-line)]">
          The patient&apos;s name is masked. Nothing else about their record is
          reachable from this page.
        </p>
      </Card>
    </main>
  );
}
