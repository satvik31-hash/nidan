import { requireAdmin } from "@/lib/auth";
import { listAllDoctors } from "@/lib/db/store";
import { Badge, Empty, SectionTitle, Table, Td, Th, Tr } from "@/components/ui";
import { Stethoscope } from "lucide-react";

export default async function AdminDoctors() {
  const session = await requireAdmin();
  const doctors = listAllDoctors({ id: session.userId, role: "admin" });

  return (
    <div className="max-w-5xl">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <Stethoscope size={19} className="text-[var(--color-ink-3)]" /> Doctors
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">{doctors.length} on the platform</span>}
      />
      {doctors.length === 0 ? (
        <Empty title="No doctors yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Specialization</Th>
              <Th>Registration no.</Th>
              <Th>Experience</Th>
              <Th>Hospitals</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium">{d.full_name}</Td>
                <Td>{d.specialization}{d.sub_specialty ? ` · ${d.sub_specialty}` : ""}</Td>
                <Td className="font-mono text-xs">{d.registration_no}</Td>
                <Td>{d.experience_years} y</Td>
                <Td>{d.hospitals.map((h) => h.name).join(", ") || "—"}</Td>
                <Td>
                  <Badge tone={d.verified_at ? "good" : "warning"}>
                    {d.verified_at ? "verified" : "pending verification"}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
