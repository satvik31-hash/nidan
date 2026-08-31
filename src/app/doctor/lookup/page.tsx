import { requireDoctor } from "@/lib/auth";
import { SectionTitle } from "@/components/ui";
import { PatientSearch } from "@/components/doctor/patient-search";

export default async function Lookup() {
  await requireDoctor();
  return (
    <div className="max-w-3xl">
      <SectionTitle
        eyebrow="Lookup"
        title="Find a patient"
        action={
          <span className="text-xs text-[var(--color-ink-3)] max-w-[260px] text-right hidden sm:block">
            Search returns an identity card only. Opening the record needs an
            active care relationship.
          </span>
        }
      />
      <PatientSearch />
    </div>
  );
}
