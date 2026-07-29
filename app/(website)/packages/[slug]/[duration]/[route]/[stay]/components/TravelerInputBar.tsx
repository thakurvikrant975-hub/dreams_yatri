'use client';

import { useBooking } from './PackageBookingProvider';
import LocationSearchSelect from '@/app/components/ui/LocationSearchSelect';
import DatePickerField from '@/app/components/ui/DatePickerField';
import RoomsGuestsField from './RoomsGuestsField';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

// Departures this close out are too soon for a guaranteed room hold —
// stays get allocated on a best-availability basis instead.
const SHORT_NOTICE_DAYS = 4;

function daysUntil(dateStr: string): number | null {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateStr}T00:00:00`);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Dropdowns must sit above the package page's sticky info band / tab bar (z-210).
const MENU_Z = 'z-250';

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
    return (
        <div className={`flex flex-col gap-1 ${className ?? ''}`}>
            <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                {label}
            </span>
            {children}
        </div>
    );
}

export default function TravelerInputBar() {
    const {
        travelDate, setTravelDate,
        leavingFrom, setLeavingFrom,
        dateHighlight,
    } = useBooking();

    const dateValue = travelDate ? new Date(`${travelDate}T00:00:00`) : null;
    const daysToTravel = daysUntil(travelDate);
    const isShortNotice = daysToTravel != null && daysToTravel >= 0 && daysToTravel <= SHORT_NOTICE_DAYS;

    const onDateChange = (d: Date | null) => {
        if (!d) { setTravelDate(''); return; }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTravelDate(`${y}-${m}-${day}`);
    };

    return (
        <div className="bg-neutral-900">
            <div className="screen-space py-3 flex flex-wrap items-end gap-3">

                {/* Leaving from — wider */}
                <Field label="Leaving from" className="min-w-72 flex-1 max-w-sm">
                    <LocationSearchSelect
                        value={leavingFrom}
                        className='cursor-pointer'
                        onChange={setLeavingFrom}
                        placeholder="Select your city"
                        showCurrentLocation
                        menuZClass={MENU_Z}
                    />
                </Field>

                {/* Departure date */}
                <Field label="Departure date" className="min-w-48">
                    <div className={
                        dateHighlight
                            ? 'rounded-input ring-2 ring-red-500 ring-offset-2 ring-offset-neutral-900 bg-red-50'
                            : ''
                    }>
                        <DatePickerField value={dateValue} onChange={onDateChange}
                        className={dateHighlight ? 'bg-red-50 cursor-pointer' : ''}
                        placeholder="Pick a date" menuZClass={MENU_Z} />
                    </div>
                </Field>

                {/* Rooms & Guests */}
                <Field label="Rooms & Guests" className="min-w-48">
                    <RoomsGuestsField />
                </Field>

            </div>

            {isShortNotice && (
                <div className="screen-space pb-3">
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                            Your travel date is only {daysToTravel === 0 ? "today" : `${daysToTravel} day${daysToTravel === 1 ? "" : "s"} away`} — stays will be allocated based on availability.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
