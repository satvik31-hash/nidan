import { requireDoctor } from "@/lib/auth";
import { doctorCard } from "@/lib/db/store";
import { DoctorShell } from "@/components/doctor/shell";
import { initials } from "@/lib/utils";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDoctor();
  const d = doctorCard(session.userId)!;

  return (
    <DoctorShell
      user={{
        name: d.full_name,
        speciality: d.specialization,
        initials: initials(d.full_name),
        verified: !!d.verified_at,
      }}
    >
      {children}
    </DoctorShell>
  );
}
