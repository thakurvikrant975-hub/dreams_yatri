// Shared pure helpers for QueryStatus — no "use server", safe to import anywhere

export type QueryStatus =
    | "SUBMITTED"
    | "VERIFIED"
    | "REJECTED"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "FOLLOW_UP"
    | "PACKAGE_SENT"
    | "CLIENT_ACCEPTED"
    | "CLIENT_DECLINED"
    | "PAYMENT_INITIATED"
    | "CONVERTED"
    | "CLOSED";

export type SalesQueryStatus =
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "FOLLOW_UP"
  | "PACKAGE_SENT"
  | "CLIENT_ACCEPTED"
  | "CLIENT_DECLINED"
  | "PAYMENT_INITIATED"
  | "CONVERTED"
  | "CLOSED";

// Still actionable by a sales exec
export function isActiveQuery(status: SalesQueryStatus) {
  return (
    status === "VERIFIED" ||
    status === "ASSIGNED" ||
    status === "IN_PROGRESS" ||
    status === "FOLLOW_UP" ||
    status === "PACKAGE_SENT" ||
    status === "CLIENT_ACCEPTED" ||
    status === "CLIENT_DECLINED" ||
    status === "PAYMENT_INITIATED"
  );
}

// Terminal — no further action needed
export function isClosedQuery(status: SalesQueryStatus) {
  return status === "CLOSED" || status === "CONVERTED" || status === "REJECTED";
}
