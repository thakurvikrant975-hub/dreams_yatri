"use client";

import { useState } from "react";
import Image from "next/image";
import {
    Camera, Mail, Phone, Smartphone, Shield, ShieldCheck,
    Users2, IdCard, CreditCard, Lock, BadgeCheck, Building2, Briefcase,
    Calendar, Clock, FileText, CircleAlert,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/app/lib/utils";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { EditPersonalDialog } from "./EditPersonalDialog";
import { EditFamilyDialog } from "./EditFamilyDialog";
import { EditIdentityDialog } from "./EditIdentityDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { AvatarUploadDialog } from "./AvatarUploadDialog";

const GENDER_LABELS: Record<string, string> = {
    MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Can't say",
};

export const NAME_TITLE_LABELS: Record<string, string> = {
    MR: "Mr.", MRS: "Mrs.", LATE_MR: "Late Mr.", LATE_MRS: "Late Mrs.",
};

function withTitle(title: string | null, name: string | null): string | null {
    if (!name) return null;
    return title && NAME_TITLE_LABELS[title] ? `${NAME_TITLE_LABELS[title]} ${name}` : name;
}

export type ProfileData = {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
    dateOfBirth: Date | null;
    joiningDate: Date | null;
    joiningDateUnknown: boolean;
    lastLoginAt: Date | null;
    designation: string | null;
    employeeId: string;
    personalEmail: string | null;
    personalMobile: string | null;
    alternativeMobile: string | null;
    officialMobile: string | null;
    fatherName: string | null;
    fatherTitle: "MR" | "MRS" | "LATE_MR" | "LATE_MRS" | null;
    fatherMobile: string | null;
    motherName: string | null;
    motherTitle: "MR" | "MRS" | "LATE_MR" | "LATE_MRS" | null;
    motherMobile: string | null;
    aadhaarNumber: string | null;
    aadhaarFileKey: string | null;
    aadhaarFileUrl: string | null;
    aadhaarBackFileKey: string | null;
    aadhaarBackFileUrl: string | null;
    panNumber: string | null;
    panFileKey: string | null;
    panFileUrl: string | null;
    profilePicKey: string | null;
    profilePicUrl: string | null;
    department: { id: string; name: string } | null;
    teamRole: { id: string; name: string } | null;
};

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAadhaar(n: string | null) {
    if (!n) return null;
    return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function SectionCard({
    title, icon: Icon, action, children,
}: {
    title: string;
    icon: React.ElementType;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-dashboard-base-100 border border-dashboard-base-300 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-dashboard-base-300">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-dashboard-primary" />
                    </div>
                    <p className="text-sm font-semibold text-dashboard-base-content">{title}</p>
                </div>
                {action}
            </div>
            <div className="p-5 space-y-4">{children}</div>
        </div>
    );
}

function Field({
    label, value, icon: Icon, placeholder = "Not added yet",
}: {
    label: string;
    value: string | null | undefined;
    icon?: React.ElementType;
    placeholder?: string;
}) {
    return (
        <div className="flex items-start gap-3">
            {Icon && (
                <div className="h-8 w-8 rounded-lg bg-dashboard-base-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-dashboard-base-content/50" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-dashboard-base-content/45">{label}</p>
                <p className={cn(
                    "text-sm mt-0.5 truncate",
                    value ? "text-dashboard-base-content font-medium" : "text-dashboard-base-content/35 italic",
                )}>
                    {value || placeholder}
                </p>
            </div>
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
    const thumb = (
        <div className="h-14 w-20 rounded-lg bg-dashboard-base-200 overflow-hidden flex items-center justify-center shrink-0">
            {fileUrl ? (
                <Image src={fileUrl} alt={label} width={80} height={56} className="h-full w-full object-cover" />
            ) : (
                <FileText className="h-4 w-4 text-dashboard-base-content/40" />
            )}
        </div>
    );
    return (
        <div className="flex items-center gap-3 rounded-xl border border-dashboard-base-300 p-3">
            {/* The actual scan, not just a status dot — clickable so it opens
                full size rather than being stuck at a 20x14 thumbnail. */}
            {fileUrl ? (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" title={`Open ${label} full size`}>
                    {thumb}
                </a>
            ) : thumb}
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-dashboard-base-content/60">{label}</p>
                {number !== undefined && (
                    <p className={cn(
                        "text-sm font-mono mt-0.5",
                        number ? "text-dashboard-base-content" : "text-dashboard-base-content/35 italic font-sans",
                    )}>
                        {number || "Not added yet"}
                    </p>
                )}
            </div>
            {fileUrl ? (
                <span title="Document uploaded"><ShieldCheck className="h-4 w-4 text-dashboard-success shrink-0" /></span>
            ) : (
                <span title="No document uploaded"><CircleAlert className="h-4 w-4 text-dashboard-warning shrink-0" /></span>
            )}
        </div>
    );
}

export function ProfileClient({ profile }: { profile: ProfileData }) {
    const [avatarOpen, setAvatarOpen] = useState(false);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">

            {/* ── Hero header ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-dashboard-primary via-dashboard-secondary to-dashboard-accent">
                <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-white/10 blur-xl" />

                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    <button
                        type="button"
                        onClick={() => setAvatarOpen(true)}
                        className="group relative h-24 w-24 sm:h-28 sm:w-28 rounded-full shrink-0 cursor-pointer"
                        title="Change profile photo"
                    >
                        <div className="h-full w-full rounded-full ring-4 ring-white/30 overflow-hidden bg-white/20 flex items-center justify-center">
                            {profile.profilePicUrl ? (
                                <Image
                                    src={profile.profilePicUrl} alt={profile.name}
                                    width={112} height={112} className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl font-semibold text-white">{initials(profile.name)}</span>
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="h-6 w-6 text-white" />
                        </div>
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-white">{profile.name}</h1>
                            <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
                                profile.isActive ? "bg-white/20 text-white" : "bg-black/20 text-white/70",
                            )}>
                                {profile.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <p className="text-white/80 text-sm mt-1">
                            {profile.designation || profile.teamRole?.name || "Team Member"}
                            {profile.department?.name && <> · {profile.department.name}</>}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-white/70">
                            <span className="flex items-center gap-1.5">
                                <BadgeCheck className="h-3.5 w-3.5" /> {profile.employeeId}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> {profile.email}
                            </span>
                            {profile.lastLoginAt && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    Last login {formatDistanceToNow(new Date(profile.lastLoginAt), { addSuffix: true })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Quick stats ──────────────────────────────────────────────── */}
            <StatGrid cols={4}>
                <StatCard label="Employee ID" value={profile.employeeId} icon={IdCard} />
                <StatCard label="Department" value={profile.department?.name ?? "—"} icon={Building2} />
                <StatCard label="Role" value={profile.teamRole?.name ?? "—"} icon={Briefcase} />
                <StatCard
                    label="Joined"
                    value={profile.joiningDate ? format(new Date(profile.joiningDate), "d MMM yyyy") : "—"}
                    icon={Calendar}
                />
            </StatGrid>

            {/* ── Detail sections ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <SectionCard
                    title="Personal Details"
                    icon={Mail}
                    action={<EditPersonalDialog profile={profile} />}
                >
                    <Field label="Personal Email" value={profile.personalEmail} icon={Mail} />
                    <Field label="Personal Mobile" value={profile.personalMobile} icon={Smartphone} />
                    <Field label="Alternative Mobile" value={profile.alternativeMobile} icon={Phone} />
                    <Field label="Official Mobile" value={profile.officialMobile} icon={Phone} />
                    <Field label="Gender" value={profile.gender ? GENDER_LABELS[profile.gender] : null} icon={Users2} />
                    <Field
                        label="Date of Birth"
                        value={profile.dateOfBirth ? format(new Date(profile.dateOfBirth), "d MMM yyyy") : null}
                        icon={Calendar}
                    />
                </SectionCard>

                <SectionCard
                    title="Family Details"
                    icon={Users2}
                    action={<EditFamilyDialog profile={profile} />}
                >
                    <Field label="Father's Name" value={withTitle(profile.fatherTitle, profile.fatherName)} icon={Users2} />
                    <Field label="Father's Mobile" value={profile.fatherMobile} icon={Phone} />
                    <Field label="Mother's Name" value={withTitle(profile.motherTitle, profile.motherName)} icon={Users2} />
                    <Field label="Mother's Mobile" value={profile.motherMobile} icon={Phone} />
                </SectionCard>

                <SectionCard
                    title="Identity Documents"
                    icon={CreditCard}
                    action={<EditIdentityDialog profile={profile} />}
                >
                    <DocumentRow label="Aadhaar Number" number={formatAadhaar(profile.aadhaarNumber)} fileUrl={profile.aadhaarFileUrl} />
                    <DocumentRow label="Aadhaar (Back)" fileUrl={profile.aadhaarBackFileUrl} />
                    <DocumentRow label="PAN Number" number={profile.panNumber} fileUrl={profile.panFileUrl} />
                </SectionCard>

                <SectionCard title="Security" icon={Lock}>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashboard-base-300 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-dashboard-warning/10 flex items-center justify-center shrink-0">
                                <Shield className="h-4 w-4 text-dashboard-warning" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-dashboard-base-content">Password</p>
                                <p className="text-xs text-dashboard-base-content/50">Last changed status unavailable</p>
                            </div>
                        </div>
                        <ChangePasswordDialog />
                    </div>
                </SectionCard>
            </div>

            <AvatarUploadDialog
                open={avatarOpen}
                onOpenChange={setAvatarOpen}
                currentUrl={profile.profilePicUrl}
                name={profile.name}
            />
        </div>
    );
}
