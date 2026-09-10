"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Table, Td, Th, Tr } from "@/components/ui";

export interface AdminPatientRow {
  id: string;
  full_name: string;
  mrn: string;
  age: number;
  sex: string;
  blood_group: string;
  city: string | null;
  phone: string | null;
}

export function PatientsTable({ rows }: { rows: AdminPatientRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(needle) ||
        r.mrn.toLowerCase().includes(needle) ||
        (r.phone ?? "").includes(needle),
    );
  }, [q, rows]);

  return (
    <div>
      <div className="field flex items-center gap-2 h-9 mb-3 max-w-sm">
        <Search size={14} className="text-[var(--color-ink-3)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, MRN or phone…"
          className="bg-transparent outline-none w-full text-sm"
        />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>MRN</Th>
            <Th>Age / sex</Th>
            <Th>Blood group</Th>
            <Th>City</Th>
            <Th>Phone</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <Tr key={p.id}>
              <Td>
                <Link href={`/admin/patients/${p.id}`} className="font-medium hover:text-[var(--color-brand)]">
                  {p.full_name}
                </Link>
              </Td>
              <Td className="font-mono text-xs">{p.mrn}</Td>
              <Td>{p.age} y · {p.sex}</Td>
              <Td><Badge>{p.blood_group}</Badge></Td>
              <Td>{p.city ?? "—"}</Td>
              <Td className="font-mono text-xs">{p.phone ?? "—"}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {filtered.length === 0 && (
        <p className="text-sm text-[var(--color-ink-3)] text-center py-6">No patients match.</p>
      )}
    </div>
  );
}
