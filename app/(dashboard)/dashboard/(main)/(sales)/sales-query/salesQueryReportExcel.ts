import * as XLSX from "xlsx";
import type { SalesQueryRow } from "./actions";

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
function fmtDate(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "";
}

/** One row per query, more columns than the PDF can fit — the PDF is the
 * skimmable report, this is the working data dump for further filtering in
 * Excel/Sheets. */
export function buildSalesQueryReportExcel(rows: SalesQueryRow[]): XLSX.WorkBook {
  const sheetRows = rows.map((q) => ({
    "Query Date": fmtDate(q.createdAt),
    "Name": q.name,
    "Phone": q.phone,
    "Email": q.email ?? "",
    "Destination": q.destination ?? "",
    "Package": q.packageName ?? "",
    "Status": statusLabel(q.status),
    "Source": statusLabel(q.source),
    "Assigned To": q.assignedToName ?? "",
    "Assigned At": fmtDate(q.assignedAt),
    "Travel Date": fmtDate(q.travelDate),
    "Group Size": q.groupSize ?? "",
    "Follow-Ups": q._count.queryFollowUps,
    "Next Follow-Up": fmtDate(q.nextFollowUpAt),
    "Closed At": fmtDate(q.closedAt),
    "Close Reason": q.closeReasonOther ?? "",
    "Packages Built": q.customPackages.length,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  // Column widths — a plain json_to_sheet defaults to the header's own width,
  // which clips almost every value here (names, emails, destinations).
  worksheet["!cols"] = [
    { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
    { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    { wch: 20 }, { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Queries");
  return workbook;
}
