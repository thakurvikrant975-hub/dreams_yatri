import * as XLSX from "xlsx";
import { STATUS_CONFIG, SOURCE_CONFIG } from "../../components/dashboard/CustomBadges";
import type { PackageQuery } from "./actions";

/** One row per query, plain values only — SheetJS's community build (the one
 * installed here) writes cell values and column widths but not fonts/colors,
 * so "good UI" here means readable headers, real Date cells (not strings, so
 * Excel's own date formatting/sorting works), and an auto-filter dropdown on
 * the header row rather than any manual styling. */
export function buildQueriesReportXlsx(queries: PackageQuery[]): XLSX.WorkBook {
  const rows = queries.map((q) => ({
    "Lead Name":    q.name || "",
    "Phone":        q.phone || "",
    "Email":        q.email || "",
    "Destination":  q.destination || "",
    "Days":         q.requirements?.journey?.noOfDays ?? "",
    "Nights":       q.requirements?.journey?.noOfNights ?? "",
    "Group Size":   q.groupSize ?? "",
    "Status":       STATUS_CONFIG[q.status]?.label ?? q.status,
    "Source":       SOURCE_CONFIG[q.source]?.label ?? q.source,
    "Verified":     q.verified ? "Yes" : "No",
    "Assigned To":  q.assignedToName || "Unassigned",
    "Package Price": q.packagePrice ?? "",
    "Travel Date":  q.travelDate ? new Date(q.travelDate) : "",
    "Received":     new Date(q.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });

  ws["!cols"] = [
    { wch: 22 }, // Lead Name
    { wch: 15 }, // Phone
    { wch: 24 }, // Email
    { wch: 18 }, // Destination
    { wch: 7 },  // Days
    { wch: 8 },  // Nights
    { wch: 10 }, // Group Size
    { wch: 16 }, // Status
    { wch: 14 }, // Source
    { wch: 9 },  // Verified
    { wch: 20 }, // Assigned To
    { wch: 13 }, // Package Price
    { wch: 13 }, // Travel Date
    { wch: 13 }, // Received
  ];

  // Lets the person opening this in Excel/Sheets sort or filter any column
  // without first selecting the header row themselves.
  if (rows.length > 0) {
    ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(13)}${rows.length + 1}` };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Queries");
  return wb;
}
