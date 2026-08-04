export function deriveRouteName(stops: { place_name: string }[]): string {
  const names = stops.map((s) => s.place_name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(" → ") : "Route";
}

/** One location name per day, derived from the route stops' night counts.
 *  Plain/sync, no client- or server-only APIs — shared by server components
 *  (e.g. hotel-requests) and client components (the builder, the PDF
 *  document, the public custom-package page) alike. */
export function deriveDayLocations(stops: { name: string; nights: number }[], totalDays: number): string[] {
  if (stops.length === 0) return Array(totalDays).fill("");
  const locations: string[] = [];
  for (const stop of stops) {
    for (let i = 0; i < stop.nights && locations.length < totalDays; i++) {
      locations.push(stop.name);
    }
  }
  const lastStopName = stops[stops.length - 1]?.name ?? "";
  while (locations.length < totalDays) locations.push(lastStopName);
  return locations;
}
