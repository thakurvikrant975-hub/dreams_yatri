// PackagePolicy.tsx
'use client';

import Accordion from '@/app/components/ui/Accordian';
import { cn } from '@/app/lib/utils';
import {
    XCircleIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    CreditCardIcon,
    DocumentTextIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/solid';

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error';

interface CancellationRow {
    days: string;
    charge: string;
    badge: { label: string; variant: BadgeVariant };
}

interface DateChangeRow {
    days: string;
    charge: string;
    badge: { label: string; variant: BadgeVariant };
}

interface PaymentStep {
    step: number;
    title: string;
    description: string;
}

interface PolicyData {
    cancellation: {
        rows: CancellationRow[];
        note: string;
    };
    dateChange: {
        rows: DateChangeRow[];
        bullets: string[];
    };
    refund: {
        bullets: string[];
        note: string;
    };
    payment: {
        steps: PaymentStep[];
        note: string;
    };
    terms: {
        sections: { title: string; points: string[] }[];
    };
}

// ─── Default data (replace with API/props) ────────────────────────────────────

const DEFAULT_POLICY: PolicyData = {
    cancellation: {
        rows: [
            { days: '30+ days before', charge: '10% of total amount', badge: { label: 'Low Risk', variant: 'success' } },
            { days: '15–29 days before', charge: '25% of total amount', badge: { label: 'Moderate', variant: 'warning' } },
            { days: '7–14 days before', charge: '50% of total amount', badge: { label: 'High', variant: 'error' } },
            { days: '0–6 days / No Show', charge: '100% of total amount', badge: { label: 'Non-Refundable', variant: 'error' } },
        ],
        note: 'Cancellation requests must be submitted in writing via email to support@dreamsyatri.com. Cancellation charges are calculated on the total package value.',
    },
    dateChange: {
        rows: [
            { days: '30+ days before', charge: '₹2,000 per person', badge: { label: 'Yes', variant: 'success' } },
            { days: '15–29 days before', charge: '₹4,000 per person', badge: { label: 'Limited', variant: 'warning' } },
            { days: 'Less than 15 days', charge: 'Subject to availability', badge: { label: 'Not Guaranteed', variant: 'error' } },
        ],
        bullets: [
            'Date changes are permitted a **maximum of 2 times** per booking.',
            'New travel dates must be within **12 months** of the original booking date.',
            'Hotel & flight availability at the time of change is not guaranteed. Any fare differences will be charged to the traveller.',
        ],
    },
    refund: {
        bullets: [
            'Approved refunds will be processed within **7–10 business days** from the date of cancellation approval.',
            'Refunds will be credited to the **original payment source** only (bank account, UPI, or card used at booking).',
            'Cash refunds are **not applicable** under any circumstance.',
            'Refunds for third-party services (flights, visa, insurance) are subject to the respective vendor\'s policy.',
            'GST and convenience fees paid at the time of booking are **non-refundable**.',
        ],
        note: 'Once your cancellation is approved, you will receive a confirmation email with an estimated refund date. Contact support@dreamsyatri.com for status updates.',
    },
    payment: {
        steps: [
            { step: 1, title: 'Booking Confirmation — 30% Advance', description: 'Pay 30% of the total package value at the time of booking to confirm your reservation. A booking confirmation will be sent via email & WhatsApp.' },
            { step: 2, title: '30 Days Before Departure — 50% Payment', description: 'An additional 50% must be paid 30 days before the travel date to proceed with hotel & activity confirmations.' },
            { step: 3, title: '7 Days Before Departure — Full Payment', description: 'The remaining balance must be cleared at least 7 days before departure. Failure to do so may result in cancellation.' },
        ],
        note: 'Accepted: UPI, Net Banking, Credit/Debit Card, Bank Transfer. EMI available on select cards. All prices inclusive of GST unless stated otherwise.',
    },
    terms: {
        sections: [
            {
                title: 'General',
                points: [
                    'Dreams Yatri acts as an agent for hotels, airlines, and other service providers. We are not liable for delays or interruptions caused by them.',
                    'Package prices are subject to change until full payment is received. Confirmed bookings are locked at the agreed price.',
                    'Dreams Yatri reserves the right to modify itineraries due to weather, safety, or operational reasons.',
                ],
            },
            {
                title: 'Inclusions & Exclusions',
                points: [
                    'Inclusions are limited to what is explicitly stated in the package. Additional services will be billed separately.',
                    'Personal expenses, tips, travel insurance, and visa fees are not included unless specifically mentioned.',
                ],
            },
            {
                title: 'Traveller Responsibilities',
                points: [
                    'Travellers must carry valid government-issued ID. Dreams Yatri is not responsible for denied boarding due to invalid documents.',
                    'Travel insurance is strongly recommended. Dreams Yatri is not liable for medical emergencies or theft during the trip.',
                    'Behaviour that disrupts fellow travellers or violates local laws may result in removal without refund.',
                ],
            },
            {
                title: 'Dispute Resolution',
                points: [
                    'All disputes are subject to the jurisdiction of courts in Shimla, Himachal Pradesh.',
                    'By confirming a booking, the traveller agrees to all terms stated herein and on the Dreams Yatri website.',
                ],
            },
        ],
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const badgeClasses: Record<BadgeVariant, string> = {
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-600',
};

function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
    return (
        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', badgeClasses[variant])}>
            {label}
        </span>
    );
}

function InfoBullet({ text }: { text: string }) {
    // Bold text wrapped in **
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
        <div className="flex items-start gap-2.5 py-2 border-b border-neutral-100 last:border-none">
            <span className="size-1.5 rounded-full bg-primary-500 shrink-0 mt-[7px]" />
            <p className="text-[13px] text-secondary leading-relaxed">
                {parts.map((part, i) =>
                    i % 2 === 1
                        ? <strong key={i} className="font-semibold text-primary">{part}</strong>
                        : part
                )}
            </p>
        </div>
    );
}

function NoteBox({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('mt-3 bg-error-50 border border-error-100 rounded-xl px-3.5 py-2.5 text-[12px] text-secondary leading-relaxed', className)}>
            {children}
        </div>
    );
}

function PolicyTable({ headers, rows }: {
    headers: string[];
    rows: { cells: React.ReactNode[] }[];
}) {
    return (
        <div className="mt-3 rounded-xl overflow-hidden border border-neutral-200">
            <table className="w-full text-[13px] border-collapse">
                <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                        {headers.map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-neutral-100 last:border-none">
                            {row.cells.map((cell, j) => (
                                <td key={j} className={cn('px-3 py-2.5 text-secondary', j === 0 && 'font-medium text-primary')}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Section Triggers ─────────────────────────────────────────────────────────

function PolicyTrigger({
    icon: Icon,
    iconBg,
    iconColor,
    title,
    subtitle,
}: {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
                <div className={cn('size-9 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
                    <Icon className={cn('size-[18px]', iconColor)} />
                </div>
                <div className="text-left">
                    <p className="text-[14px] font-bold text-primary">{title}</p>
                    <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
                </div>
            </div>
            <Accordion.Chevron className="size-4 text-neutral-400 mr-1" />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PackagePolicyProps {
    policy?: PolicyData;
    className?: string;
}

export default function PackagePolicy({
    policy = DEFAULT_POLICY,
    className,
}: PackagePolicyProps) {
    return (
        <div className={cn( className)}>

            {/* ── 1. Cancellation Policy ── */}
            <Accordion variant="default" multiple defaultOpen={['cancellation', 'date-change', 'refund', 'payment', 'terms']} className='flex flex-col gap-7'>

                <Accordion.Item id="cancellation">
                    <Accordion.Trigger className="px-4 py-3.5">
                        <PolicyTrigger
                            icon={XCircleIcon}
                            iconBg="bg-error-50"
                            iconColor="text-error-500"
                            title="Cancellation Policy"
                            subtitle="Charges & applicable days"
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 pb-5">
                        <PolicyTable
                            headers={['Days Before Departure', 'Cancellation Charge', 'Status']}
                            rows={policy.cancellation.rows.map(r => ({
                                cells: [r.days, r.charge, <Badge label={r.badge.label} variant={r.badge.variant} />],
                            }))}
                        />
                        <NoteBox>
                            <strong className="text-error-500 font-semibold">Note: </strong>
                            {policy.cancellation.note}
                        </NoteBox>
                    </Accordion.Content>
                </Accordion.Item>

                {/* ── 2. Date Change Policy ── */}
                <Accordion.Item id="date-change">
                    <Accordion.Trigger className="px-4 py-3.5">
                        <PolicyTrigger
                            icon={CalendarDaysIcon}
                            iconBg="bg-warning-50"
                            iconColor="text-warning-600"
                            title="Date Change Policy"
                            subtitle="Rescheduling & amendment charges"
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 pb-5">
                        <PolicyTable
                            headers={['Days Before Departure', 'Amendment Charge', 'Allowed']}
                            rows={policy.dateChange.rows.map(r => ({
                                cells: [r.days, r.charge, <Badge label={r.badge.label} variant={r.badge.variant} />],
                            }))}
                        />
                        <div className="mt-3">
                            {policy.dateChange.bullets.map((b, i) => <InfoBullet key={i} text={b} />)}
                        </div>
                    </Accordion.Content>
                </Accordion.Item>

                {/* ── 3. Refund Policy ── */}
                <Accordion.Item id="refund">
                    <Accordion.Trigger className="px-4 py-3.5">
                        <PolicyTrigger
                            icon={ArrowPathIcon}
                            iconBg="bg-success-50"
                            iconColor="text-success-600"
                            title="Refund Policy"
                            subtitle="Processing time & refund method"
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 pb-5">
                        <div className="mt-1">
                            {policy.refund.bullets.map((b, i) => <InfoBullet key={i} text={b} />)}
                        </div>
                        <NoteBox className="bg-success-50 border-success-100">
                            <strong className="text-success-700 font-semibold">Refund Tracker: </strong>
                            {policy.refund.note}
                        </NoteBox>
                    </Accordion.Content>
                </Accordion.Item>

                {/* ── 4. Payment Policy ── */}
                <Accordion.Item id="payment">
                    <Accordion.Trigger className="px-4 py-3.5">
                        <PolicyTrigger
                            icon={CreditCardIcon}
                            iconBg="bg-primary-50"
                            iconColor="text-primary-500"
                            title="Payment Policy"
                            subtitle="Booking amount & payment schedule"
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 pb-5">
                        <div className="mt-1 flex flex-col">
                            {policy.payment.steps.map(({ step, title, description }) => (
                                <div key={step} className="flex gap-3 py-3 border-b border-neutral-100 last:border-none">
                                    <div className="size-7 rounded-full border-[1.5px] border-primary-400 bg-primary-50 flex items-center justify-center text-[11px] font-bold text-primary-500 shrink-0 mt-0.5">
                                        {step}
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-primary mb-1">{title}</p>
                                        <p className="text-[12px] text-secondary leading-relaxed">{description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <NoteBox className="bg-primary-50 border-primary-100">
                            {policy.payment.note}
                        </NoteBox>
                    </Accordion.Content>
                </Accordion.Item>

                {/* ── 5. Terms & Conditions ── */}
                <Accordion.Item id="terms">
                    <Accordion.Trigger className="px-4 py-3.5">
                        <PolicyTrigger
                            icon={DocumentTextIcon}
                            iconBg="bg-neutral-100"
                            iconColor="text-neutral-500"
                            title="Terms & Conditions"
                            subtitle="Liability, inclusions & general terms"
                        />
                    </Accordion.Trigger>
                    <Accordion.Content className="px-4 pb-5">
                        <div className="flex flex-col gap-4 mt-1">
                            {policy.terms.sections.map(({ title, points }) => (
                                <div key={title}>
                                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                                        {title}
                                    </p>
                                    {points.map((point, i) => (
                                        <div key={i} className="flex gap-2 mb-1.5">
                                            <span className="text-primary-500 font-bold text-[12px] shrink-0 mt-0.5">•</span>
                                            <p className="text-[12.5px] text-secondary leading-relaxed">{point}</p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Accordion.Content>
                </Accordion.Item>

            </Accordion>
        </div>
    );
}