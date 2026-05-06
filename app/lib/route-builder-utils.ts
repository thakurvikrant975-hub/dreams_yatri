export function deriveRouteName(stops: { place_name: string }[]): string {
  return stops.map((s) => s.place_name).join(" → ");
}
