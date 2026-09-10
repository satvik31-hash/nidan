import { requireAdmin } from "@/lib/auth";
import { listAllHospitals } from "@/lib/db/store";
import { Empty, SectionTitle, Table, Td, Th, Tr } from "@/components/ui";
import { Building2 } from "lucide-react";

export default async function AdminHospitals() {
  const session = await requireAdmin();
  const hospitals = listAllHospitals({ id: session.userId, role: "admin" });

  return (
    <div className="max-w-4xl">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 size={19} className="text-[var(--color-ink-3)]" /> Hospitals
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">{hospitals.length} on the platform</span>}
      />
      {hospitals.length === 0 ? (
        <Empty title="No hospitals yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>City</Th>
              <Th>HFR ID</Th>
              <Th>Doctors</Th>
              <Th>Visits recorded</Th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map((h) => (
              <Tr key={h.id}>
                <Td className="font-medium">{h.name}</Td>
                <Td>{h.city}, {h.state}</Td>
                <Td className="font-mono text-xs">{h.hfr_id ?? "—"}</Td>
                <Td>{h.doctorCount}</Td>
                <Td>{h.visitCount}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
