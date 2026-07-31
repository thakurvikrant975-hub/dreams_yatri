'use client';

import SharedRoomsGuestsField from '@/app/components/ui/RoomsGuestsField';
import { useBooking } from './PackageBookingProvider';

// Dropdown must sit above the package page's sticky info band / tab bar (z-210).
const MENU_Z = 'z-250';

/**
 * Package-page binding for the shared rooms & guests picker: the same control
 * the home hero and /packages search bar use, wired to this booking's live
 * hotel inventory (room ceiling, per-room occupancy, and the availability
 * check that can unlock more rooms on Apply).
 */
export default function RoomsGuestsField() {
    const { roomGuests, setRoomGuests, maxRooms, personsPerRoom, requestMoreRooms } = useBooking();

    return (
        <SharedRoomsGuestsField
            value={roomGuests}
            onChange={setRoomGuests}
            maxRooms={maxRooms}
            personsPerRoom={personsPerRoom}
            onRequestMoreRooms={requestMoreRooms}
            menuZClass={MENU_Z}
        />
    );
}
