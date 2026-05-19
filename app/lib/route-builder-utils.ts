export function deriveRouteName(stops: { place_name: string }[]): string {
  const names = stops.map((s) => s.place_name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(" → ") : "Route";
}
