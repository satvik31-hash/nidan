import { requireAdmin } from "@/lib/auth";
import { listAllPatients } from "@/lib/db/store";
import { SectionTitle } from "@/components/ui";
import { PatientsTable } from "@/components/admin/patients-table";
import { Users } from "lucide-react";

export default async function AdminPatients() {
  const session = await requireAdmin();
  const patients = listAllPatients({ id: session.userId, role: "admin" });

  return (
    <div className="max-w-5xl">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <Users size={19} className="text-[var(--color-ink-3)]" /> Patients
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">{patients.length} on the platform</span>}
      />
      <PatientsTable rows={patients} />
    </div>
  );
}
