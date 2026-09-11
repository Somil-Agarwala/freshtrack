import { PageHeader } from "@/components/ui/page-header";
import { UsersTable } from "@/components/users/users-table";

const roles = [
  { role: "Admin", desc: "Full access, including users and settings" },
  { role: "Manager", desc: "Can count, pack, dispatch and record settlements" },
  { role: "Data entry", desc: "Can log collections and count bags" },
  { role: "Viewer", desc: "Read-only access to everything" },
];

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users & roles" description="Who can access the system and what they can do" />
      <UsersTable />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r) => (
          <div key={r.role} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-semibold text-ink">{r.role}</p>
            <p className="mt-1 text-xs text-ink-dim">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
