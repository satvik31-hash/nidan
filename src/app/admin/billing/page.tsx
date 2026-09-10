import { requireAdmin } from "@/lib/auth";
import { listAllBills } from "@/lib/db/store";
import { Badge, Empty, SectionTitle, Stat, Table, Td, Th, Tr } from "@/components/ui";
import { fmtDate, rupees } from "@/lib/utils";
import { Receipt } from "lucide-react";

export default async function AdminBilling() {
  const session = await requireAdmin();
  const bills = listAllBills({ id: session.userId, role: "admin" }, { limit: 300 });

  const total = bills.reduce((a, b) => a + b.total, 0);
  const outstanding = bills.reduce((a, b) => a + (b.status === "paid" ? 0 : b.patient_payable), 0);
  const unpaidCount = bills.filter((b) => b.status !== "paid").length;

  return (
    <div className="max-w-5xl space-y-4">
      <SectionTitle
        eyebrow="Administration"
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt size={19} className="text-[var(--color-ink-3)]" /> Billing
          </span>
        }
        action={<span className="text-xs text-[var(--color-ink-3)]">Most recent {bills.length}</span>}
      />

      <div className="grid gap-3 grid-cols-3 max-w-md">
        <Stat label="Total billed" value={rupees(total)} />
        <Stat label="Outstanding" value={rupees(outstanding)} tone={outstanding > 0 ? "warning" : "neutral"} />
        <Stat label="Unpaid bills" value={unpaidCount} tone={unpaidCount > 0 ? "warning" : "good"} />
      </div>

      {bills.length === 0 ? (
        <Empty title="No bills yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Bill no.</Th>
              <Th>Patient</Th>
              <Th>Hospital</Th>
              <Th>Date</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <Tr key={b.id}>
                <Td className="font-mono text-xs">{b.bill_no}</Td>
                <Td>{b.patientName}</Td>
                <Td>{b.hospitalName}</Td>
                <Td>{fmtDate(b.billed_on)}</Td>
                <Td>{rupees(b.total)}</Td>
                <Td>
                  <Badge tone={b.status === "paid" ? "good" : b.status === "partial" ? "warning" : "critical"}>
                    {b.status}
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
