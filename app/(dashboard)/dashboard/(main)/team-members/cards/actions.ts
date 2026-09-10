"use server";

import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import type { Gender, NameTitle } from "@/app/generated/prisma";

// ── Read-only fetch for the card-grid view ───────────────────────────────────
// Distinct from ../actions.ts's getTeamMembersPaginated: this pulls the full
// profile (DOB, gender, official mobile, both Aadhaar file sides, title
// prefixes) for every member in one shot rather than a paginated table slice
// — the card grid is meant to show everything a member uploaded, not just
// the table's summary columns.

export type DetailedTeamMember = {
  id:                 string;
  employeeId:         string;
  name:               string;
  email:              string;
  personalEmail:      string | null;
  designation:        string | null;
  isActive:           boolean;
  gender:             Gender | null;
  dateOfBirth:        Date | null;
  joiningDate:        Date | null;
  createdAt:          Date;
  profilePicUrl:      string | null;
  personalMobile:     string | null;
  alternativeMobile:  string | null;
  officialMobile:     string | null;
  fatherName:         string | null;
  fatherMobile:       string | null;
  fatherTitle:        NameTitle | null;
  motherName:         string | null;
  motherMobile:       string | null;
  motherTitle:        NameTitle | null;
  aadhaarNumber:      string | null;
  aadhaarFileUrl:     string | null;
  aadhaarBackFileUrl: string | null;
  panNumber:          string | null;
  panFileUrl:         string | null;
  department:         { id: string; name: string } | null;
  role:               { id: string; name: string } | null;
};

export async function getAllTeamMembersDetailed(): Promise<DetailedTeamMember[]> {
  const session = await dashboardAuth();
  if (!session?.user?.id) return [];

  const raw = await db.teamMember.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, employeeId: true, name: true, email: true, personalEmail: true,
      designation: true, isActive: true, gender: true, dateOfBirth: true,
      joiningDate: true, createdAt: true, profilePicUrl: true,
      personalMobile: true, alternativeMobile: true, officialMobile: true,
      fatherName: true, fatherMobile: true, fatherTitle: true,
      motherName: true, motherMobile: true, motherTitle: true,
      aadhaarNumber: true, aadhaarFileUrl: true, aadhaarBackFileUrl: true,
      panNumber: true, panFileUrl: true,
      department: { select: { id: true, name: true } },
      teamRole:   { select: { id: true, name: true } },
    },
  });

  return raw.map(({ teamRole, ...m }) => ({ ...m, role: teamRole }));
}

export async function getDepartmentsForSelect() {
  return db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function getRolesForSelect() {
  return db.teamRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
