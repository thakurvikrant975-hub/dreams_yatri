"use client";

import Image from "next/image";
import {
  Mail, Phone, Smartphone, Users2, Calendar, Building2, Briefcase,
  BadgeCheck, CreditCard, FileText, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/app/lib/utils";
import { Badge } from "../../components/ui/badge";
import {
  Card, CardHeader, CardContent, CardFooter,
} from "../../components/ui/card";
import type { DetailedTeamMember } from "./actions";

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Can't say",
};

const NAME_TITLE_LABELS: Record<string, string> = {
  MR: "Mr.", MRS: "Mrs.", LATE_MR: "Late Mr.", LATE_MRS: "Late Mrs.",
};

function withTitle(title: string | null, name: string | null): string | null {
  if (!name) return null;
  return title && NAME_TITLE_LABELS[title] ? `${NAME_TITLE_LABELS[title]} ${name}` : name;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAadhaar(n: string | null) {
  if (!n) return null;
  return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

// ── Small building blocks ────────────────────────────────────────────────────

function Field({
  label, value, icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-md bg-dashboard-base-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-dashboard-base-content/50" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-dashboard-base-content/45">{label}</p>
        <p className="text-sm mt-0.5 truncate text-dashboard-base-content font-medium">{value}</p>
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-dashboard-base-content/70">{title}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</div>
    </div>
  );
}

function DocumentRow({
  label, number, fileUrl,
}: {
  label: string;
  number?: string | null;
  fileUrl: string | null;
}) {
  const isImage = !!fileUrl && !/\.pdf($|\?)/i.test(fileUrl);
  const thumb = (
    <div className="h-12 w-16 rounded-lg bg-dashboard-base-200 overflow-hidden flex items-center justify-center shrink-0">
      {fileUrl ? (
        isImage
          ? <Image src={fileUrl} alt={label} width={64} height={48} className="h-full w-full object-cover" />
          : <FileText className="h-4 w-4 text-dashboard-base-content/40" />
      ) : (
        <FileText className="h-4 w-4 text-dashboard-base-content/40" />
      )}
    </div>
  );
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashboard-base-300 p-2.5">
      {fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" title={`Open ${label} in a new tab`}>
          {thumb}
        </a>
      ) : thumb}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-dashboard-base-content/60">{label}</p>
        {number !== undefined && (
          <p className={cn(
            "text-xs font-mono mt-0.5 truncate",
            number ? "text-dashboard-base-content" : "text-dashboard-base-content/35 italic font-sans",
          )}>
            {number || "Not added"}
          </p>
        )}
      </div>
      {fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-[11px] font-medium text-dashboard-primary hover:underline whitespace-nowrap">
          View ↗
        </a>
      ) : (
        <span title="Not uploaded" className="shrink-0"><ShieldCheck className="h-3.5 w-3.5 text-dashboard-base-content/25" /></span>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  member: DetailedTeamMember;
}

export function MemberDetailCard({ member: m }: Props) {
  return (
    <Card className="rounded-2xl border-dashboard-base-300">
      <CardHeader className="border-b border-dashboard-base-300 pb-4!">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center text-base font-bold text-purple-100 shrink-0"
            style={{ background: m.profilePicUrl ? "none" : "linear-gradient(135deg,#7F77DD,#534AB7)" }}>
            {m.profilePicUrl
              ? <img src={m.profilePicUrl} alt={m.name} className="h-full w-full object-cover" />
              : initials(m.name)
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-dashboard-base-content truncate">{m.name}</h3>
              <Badge className={cn(
                "text-[10px] rounded-full px-2 py-0.5 font-medium border",
                m.isActive ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200",
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full mr-1", m.isActive ? "bg-green-500" : "bg-red-500")} />
                {m.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-dashboard-base-content/60 mt-0.5 font-mono">{m.employeeId}</p>
            <p className="text-xs text-dashboard-base-content/70 mt-0.5 truncate">
              {m.designation || m.role?.name || "—"}
              {m.department?.name && <> · {m.department.name}</>}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <SubSection title="Work">
          <Field label="Employee ID" value={m.employeeId} icon={BadgeCheck} />
          <Field label="Department" value={m.department?.name} icon={Building2} />
          <Field label="Role" value={m.role?.name} icon={Briefcase} />
          <Field label="Joined" value={m.joiningDate ? format(new Date(m.joiningDate), "d MMM yyyy") : null} icon={Calendar} />
        </SubSection>

        <SubSection title="Contact">
          <Field label="Work Email" value={m.email} icon={Mail} />
          <Field label="Personal Email" value={m.personalEmail} icon={Mail} />
          <Field label="Personal Mobile" value={m.personalMobile} icon={Smartphone} />
          <Field label="Alternative Mobile" value={m.alternativeMobile} icon={Phone} />
          <Field label="Official Mobile" value={m.officialMobile} icon={Phone} />
          <Field label="Gender" value={m.gender ? GENDER_LABELS[m.gender] : null} icon={Users2} />
          <Field label="Date of Birth" value={m.dateOfBirth ? format(new Date(m.dateOfBirth), "d MMM yyyy") : null} icon={Calendar} />
        </SubSection>

        {(m.fatherName || m.motherName) && (
          <SubSection title="Family">
            <Field label="Father's Name" value={withTitle(m.fatherTitle, m.fatherName)} icon={Users2} />
            <Field label="Father's Mobile" value={m.fatherMobile} icon={Phone} />
            <Field label="Mother's Name" value={withTitle(m.motherTitle, m.motherName)} icon={Users2} />
            <Field label="Mother's Mobile" value={m.motherMobile} icon={Phone} />
          </SubSection>
        )}

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-dashboard-base-content/70 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Identity Documents
          </p>
          <div className="space-y-2">
            <DocumentRow label="Aadhaar (Front)" number={formatAadhaar(m.aadhaarNumber)} fileUrl={m.aadhaarFileUrl} />
            <DocumentRow label="Aadhaar (Back)" fileUrl={m.aadhaarBackFileUrl} />
            <DocumentRow label="PAN Card" number={m.panNumber} fileUrl={m.panFileUrl} />
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-dashboard-base-300 text-[11px] text-dashboard-base-content/45">
        Created {format(new Date(m.createdAt), "d MMM yyyy")}
      </CardFooter>
    </Card>
  );
}
