"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { users } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  data_entry: "Data entry",
  viewer: "Viewer",
};

export function UsersTable() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-9" />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description="Try a different search term." />
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {filtered.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{u.name}</p>
                  <p className="truncate text-xs text-ink-faint">{u.email}</p>
                  <p className="mt-1 text-xs text-ink-faint">Last active {formatDate(u.lastActive)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge>
                  <Badge tone={u.isActive ? "emerald" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div>
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-xs text-ink-faint">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge tone="blue">{ROLE_LABELS[u.role]}</Badge></TableCell>
                  <TableCell><Badge tone={u.isActive ? "emerald" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-ink-dim">{formatDate(u.lastActive)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
