import { requireAdmin } from "@/lib/auth";
import { listAllAppointments } from "@/lib/db/store";
import { Badge, Empty, SectionTitle, Table, Td, Th, Tr } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

const STATUS_TONE: Record<string, "good" | "warning" | "critical" | "neutral"> = {
  completed: "good", confirmed: "neutral", checked_in: "neutral",
  in_consult: "warning", requested: "neutral",
  cancelled: "critical", no_show: "critical",
};

export default async function AdminAppointments() {
  const session = await requireAdmin();
  const appointments = listAllAppointments({ id: session.userId, role: "admin" }, { limit: 200 });

  return (
    <div className="max-w-5xl">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={19} className="text-[var(--color-ink-3)]" /> Appointments
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">Most recent {appointments.length}</span>}
      />
      {appointments.length === 0 ? (
        <Empty title="No appointments yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Hospital</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <Tr key={a.id}>
                <Td>{fmtDateTime(a.slot_start)}</Td>
                <Td>{a.patientName}</Td>
                <Td>{a.doctorName}</Td>
                <Td>{a.hospitalName}</Td>
                <Td><Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace("_", " ")}</Badge></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
