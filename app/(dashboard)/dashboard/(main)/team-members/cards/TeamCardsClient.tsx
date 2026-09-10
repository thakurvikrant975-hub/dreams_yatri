"use client";

import { useMemo, useState } from "react";
import { UsersRound, MonitorCheck, MonitorDot, Building2 } from "lucide-react";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { MemberDetailCard } from "./MemberDetailCard";
import type { DetailedTeamMember } from "./actions";

type SelectOption = { id: string; name: string };

interface Props {
  members:     DetailedTeamMember[];
  departments: SelectOption[];
  roles:       SelectOption[];
}

export function TeamCardsClient({ members, departments, roles }: Props) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const totalStats = {
    total:       members.length,
    active:      members.filter((m) => m.isActive).length,
    inactive:    members.filter((m) => !m.isActive).length,
    departments: new Set(members.map((m) => m.department?.id).filter(Boolean)).size,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (department !== "all" && m.department?.id !== department) return false;
      if (role !== "all" && m.role?.id !== role) return false;
      if (status === "active" && !m.isActive) return false;
      if (status === "inactive" && m.isActive) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q)
        || m.email.toLowerCase().includes(q)
        || m.employeeId.toLowerCase().includes(q)
        || (m.personalMobile ?? "").includes(q)
      );
    });
  }, [members, search, department, role, status]);

  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard label="Total Members"    value={totalStats.total}       icon={UsersRound}   />
        <StatCard label="Active Members"   value={totalStats.active}      icon={MonitorCheck} />
        <StatCard label="Inactive Members" value={totalStats.inactive}    icon={MonitorDot}   />
        <StatCard label="Departments"      value={totalStats.departments} icon={Building2}    />
      </StatGrid>

      <TableFilters
        search={search} onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, employee ID, or mobile…"
        filteredCount={filtered.length} totalCount={totalStats.total}
        filters={[
          {
            value: department, onChange: setDepartment, placeholder: "All Departments",
            options: departments.map((d) => ({ label: d.name, value: d.id })),
          },
          {
            value: role, onChange: setRole, placeholder: "All Roles",
            options: roles.map((r) => ({ label: r.name, value: r.id })),
          },
          {
            value: status, onChange: setStatus, placeholder: "All Statuses",
            options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }],
          },
        ]}
      />

      {filtered.length === 0 ? (
        <TableEmptyState title="No team members found" description="Try adjusting your search or filters" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filtered.map((m) => <MemberDetailCard key={m.id} member={m} />)}
        </div>
      )}
    </div>
  );
}
