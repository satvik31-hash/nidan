import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";
import { initials } from "@/lib/utils";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <AdminShell user={{ name: session.name, initials: initials(session.name) }}>
      {children}
    </AdminShell>
  );
}
