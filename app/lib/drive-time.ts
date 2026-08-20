/**
 * Drive time as "4h 10m" / "1h" / "45m".
 *
 * Lives next to the hotel and itinerary pickers that badge a stay with its
 * distance from the day's stop. On mountain roads the distance alone is
 * misleading in the other direction too — 120km of Uttarakhand hairpins is
 * most of an afternoon, while 120km of plains highway is not — so the pickers
 * show the time beside the kilometres rather than leaving it to be guessed.
 */
export function fmtDriveTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
