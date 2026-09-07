import FitToWidth from "@/app/components/ui/FitToWidth";

/**
 * The invoice's fit. The mechanism — and the reasoning for scaling a document
 * rather than reflowing it — now lives in FitToWidth, which the voucher shares.
 *
 * This stays as a named wrapper because INVOICE_WIDTH is a fact about the
 * invoice, not about fitting: it must track `max-w-215` on InvoiceDocument, and
 * a caller passing the width by hand at four separate call sites is four places
 * to get it wrong.
 *
 * NOTE ON LEGIBILITY. At 390px this lands near 0.45×, so the 10px labels render
 * around 4.5px. That is small, and deliberately so — it is a faithful thumbnail
 * of a document you pinch to read or download, not body copy. The alternative
 * is a reflowed mobile layout that no longer matches the PDF.
 */

/** The width the invoice is drawn at — max-w-215 on the document itself.
 *  Change both or the fit is wrong. */
const INVOICE_WIDTH = 860;

export default function InvoiceFit({ children }: { children: React.ReactNode }) {
  return <FitToWidth width={INVOICE_WIDTH}>{children}</FitToWidth>;
}
