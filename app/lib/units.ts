const SQFT_PER_SQM = 10.7639;

export function convertAreaUnit(value: number, from: "sqft" | "sqm", to: "sqft" | "sqm"): number {
  if (from === to) return value;
  const converted = from === "sqft" ? value / SQFT_PER_SQM : value * SQFT_PER_SQM;
  return Math.round(converted * 100) / 100;
}
