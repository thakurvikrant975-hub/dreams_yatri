// Plain module (no "use server") — package-pricing.service.ts has "use server"
// at the top, which requires every export to be an async function; this is a
// small sync pure helper, so it lives here instead rather than being forced
// async just to satisfy that constraint.

/** Splits a manually-filled day's combined `accommodation` string (written
 * as "Hotel Name — Room Name" by hotel-requests' fillPendingHotel, same
 * separator HotelRoomPicker's own auto-fill uses) back into the two parts
 * computeBuilderHotelPricing's manual-price branch needs for its pricing
 * line — there's no catalog join to pull them from for these days. */
export function splitManualHotelName(accommodation: string | null | undefined): { manualHotelName: string | null; manualRoomName: string | null } {
  if (!accommodation) return { manualHotelName: null, manualRoomName: null };
  const idx = accommodation.indexOf(" — ");
  if (idx === -1) return { manualHotelName: accommodation, manualRoomName: null };
  return { manualHotelName: accommodation.slice(0, idx), manualRoomName: accommodation.slice(idx + 3) };
}
