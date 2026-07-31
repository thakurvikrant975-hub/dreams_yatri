// Guest cap per room, shared by every room-picker UI (frontend booking
// widget, dashboard pricing preview, …) so they can never drift out of sync
// with each other or with what the pricing engine is validated against.
export const MAX_GUESTS_PER_ROOM = 4;
