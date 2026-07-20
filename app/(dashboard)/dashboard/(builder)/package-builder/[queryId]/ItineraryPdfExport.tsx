"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Eye } from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { ItineraryDocument, type PreviewData } from "./ItineraryDocument";
import { captureToPdfPages, buildPdf, type PdfPage } from "./pdfExport";

/** "Romantic Kerala Honeymoon Package" → "romantic-kerala-honeymoon-package-itinerary.pdf" */
function pdfFilename(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "itinerary"}-itinerary.pdf`;
}

export function ItineraryPdfExport({ form }: { form: PreviewData }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pages, setPages] = useState<PdfPage[] | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generatePages(): Promise<PdfPage[] | null> {
    const root = captureRef.current?.querySelector<HTMLElement>(".itinerary-print-area");
    if (!root) {
      toast.error("Couldn't find the itinerary content to export");
      return null;
    }
    setGenerating(true);
    try {
      const result = await captureToPdfPages(root);
      setPages(result);
      return result;
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF. If a hotel/activity photo is hosted somewhere without CORS enabled, it may be blocking the capture.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreview() {
    setPreviewOpen(true);
    if (!pages) await generatePages();
  }

  async function handleDownload() {
    const result = pages ?? (await generatePages());
    if (!result) return;
    const pdf = buildPdf(result);
    pdf.save(pdfFilename(form.title));
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
