// Shared by the sales package-builder (client + server) and its "use server"
// action file — kept in a plain module (not "use server", which may only
// export async functions) so all three call sites derive the package's
// flight/train inclusion flags from the same source of truth: its ticket
// list, rather than a separately hand-maintained toggle that could drift.

export type TicketLike = {
  type: "FLIGHT" | "TRAIN";
  provider: string;
  ticketNumber: string;
  fromPlace: string;
  toPlace: string;
};

export type DerivedTransportFields = {
  flightsIncluded: boolean;
  flightFrom: string;
  flightTo: string;
  flightNotes: string;
  trainIncluded: boolean;
  trainFrom: string;
  trainTo: string;
  trainNotes: string;
};

export function deriveTransportFields(tickets: TicketLike[]): DerivedTransportFields {
  const flights = tickets.filter((t) => t.type === "FLIGHT");
  const trains = tickets.filter((t) => t.type === "TRAIN");
  const label = (t: TicketLike) => [t.provider, t.ticketNumber].filter(Boolean).join(" ");

  return {
    flightsIncluded: flights.length > 0,
    flightFrom: flights[0]?.fromPlace ?? "",
    flightTo: flights[0]?.toPlace ?? "",
    flightNotes: flights.map(label).filter(Boolean).join(", "),
    trainIncluded: trains.length > 0,
    trainFrom: trains[0]?.fromPlace ?? "",
    trainTo: trains[0]?.toPlace ?? "",
    trainNotes: trains.map(label).filter(Boolean).join(", "),
  };
}
