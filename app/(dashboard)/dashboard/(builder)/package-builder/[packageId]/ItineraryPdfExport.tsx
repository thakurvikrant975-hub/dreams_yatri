"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Eye } from "./builder-icons";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { ItineraryDocument, type PreviewData } from "./ItineraryDocument";
import { captureToPdfPages, buildPdf, validateItineraryRequiredFields, type PdfPage } from "./pdfExport";

function warnAboutFailedImages(imageWarnings: string[]) {
  if (imageWarnings.length === 0) return;
  toast.warning(
    `${imageWarnings.length} photo${imageWarnings.length !== 1 ? "s" : ""} didn't load and will show blank in the PDF`,
    { description: imageWarnings.join(" · "), duration: 20000 },
  );
}

// Same light-touch capitalization as Addquerydialog's capitalizeWords —
// only uppercases each word's first letter, so an acronym typed correctly
// elsewhere in the name (e.g. "UAE", "GST") isn't mangled the way a full
// Title Case pass would.
function capitalizeWords(s: string): string {
  return s.replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** "priya sharma" + "romantic kerala honeymoon package" →
 *  "Priya Sharma - Romantic Kerala Honeymoon Package.pdf" */
function pdfFilename(clientName: string, title: string): string {
  const client = capitalizeWords(clientName.trim().replace(/\s+/g, " "));
  const pkg = capitalizeWords(title.trim().replace(/\s+/g, " "));
  const base = [client, pkg].filter(Boolean).join(" - ") || "Itinerary";
  // Strip characters illegal in filenames (Windows/macOS) without touching
  // the readable spaces/hyphens the casing above relies on.
  return `${base.replace(/[\\/:*?"<>|]/g, "")}.pdf`;
}

export function ItineraryPdfExport({ form }: { form: PreviewData }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pages, setPages] = useState<PdfPage[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const validationError = validateItineraryRequiredFields(form);

  async function generatePages(): Promise<PdfPage[] | null> {
    if (validationError) {
      toast.error(validationError);
      return null;
    }
    const root = captureRef.current?.querySelector<HTMLElement>(".itinerary-print-area");
    if (!root) {
      toast.error("Couldn't find the itinerary content to export");
      return null;
    }
    setGenerating(true);
    try {
      const { pages: result, imageWarnings } = await captureToPdfPages(root);
      setPages(result);
      warnAboutFailedImages(imageWarnings);
      return result;
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF. If a hotel/activity photo is hosted somewhere without CORS enabled, it may be blocking the capture.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  // Both actions always recapture from the live DOM rather than reusing
  // `pages` from a previous call — the form (and any photo just added
  // elsewhere in the builder) can have changed since the last preview/
  // download, and a stale capture would silently ship outdated photos in
  // the PDF. The cost is a fresh html2canvas pass every click; correctness
  // here matters more than saving that.
  async function handlePreview() {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setPreviewOpen(true);
    await generatePages();
  }

  async function handleDownload() {
    const result = await generatePages();
    if (!result) return;
    const pdf = buildPdf(result);
    pdf.save(pdfFilename(form.clientName, form.title));
  }

  return (
    <>
      {/* Off-screen capture source — a read-only render of the document (no
         edit affordances, since no onImageChange/onCoverImageChange are
         passed) at a fixed 210mm width so html2canvas always measures a
         consistent, print-accurate layout regardless of the live preview
         pane's actual on-screen size or scroll position. */}
      <div
        ref={captureRef}
        aria-hidden
        style={{ position: "fixed", top: 0, left: "-10000px", width: "210mm" }}
      >
        <ItineraryDocument form={form} variant="flat" />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
        onClick={handlePreview}
        disabled={generating}
        title={validationError ?? undefined}
      >
        <Eye size={13} />
        <span className="hidden sm:inline text-xs">Preview PDF</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
        onClick={handleDownload}
        disabled={generating}
        title={validationError ?? undefined}
      >
        {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        <span className="hidden sm:inline text-xs">Download PDF (A4)</span>
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>
              Exactly how each A4 page will look in the downloaded PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-4 px-4 py-2 bg-dashboard-base-200/60 rounded-xl">
            {generating && !pages ? (
              <div className="flex flex-col items-center justify-center gap-2 py-24 text-dashboard-base-content/50">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-xs">Designing pdf...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-4">
                {pages?.map((page, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, not a static app asset */}
                    <img
                      src={page.dataUrl}
                      alt={`Page ${i + 1}`}
                      className="w-full max-w-md rounded-sm shadow-lg border border-dashboard-base-content/10 bg-white"
                    />
                    <span className="text-[10px] font-medium text-dashboard-base-content/50">
                      Page {i + 1} of {pages.length}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md"
              onClick={handleDownload}
              disabled={generating}
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span className="text-xs">Download PDF</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
