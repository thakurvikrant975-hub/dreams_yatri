"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { ItineraryDocument, type PreviewData } from "./ItineraryDocument";
import { captureToPdfPages, buildPdf, validateItineraryRequiredFields } from "./pdfExport";

export function SendToClientDialog({
  open, onOpenChange, packageId, whatsappUrl, shareUrl, clientEmail, previewForm,
}: {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  packageId:    string;
  whatsappUrl:  string;
  shareUrl:     string;
  clientEmail:  string;
  previewForm:  PreviewData;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const validationError = validateItineraryRequiredFields(previewForm);

  function handleWhatsapp() {
    window.open(whatsappUrl, "_blank");
    setWhatsappOpened(true);
  }

  async function handleEmail() {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setEmailSending(true);
    try {
      // Generate the same A4 PDF the "Download PDF" button produces, from an
      // off-screen render of the same document, so the emailed copy always
      // matches what the exec last saw in the builder.
      let pdfBlob: Blob | null = null;
      const root = captureRef.current?.querySelector<HTMLElement>(".itinerary-print-area");
      if (root) {
        try {
          const pages = await captureToPdfPages(root);
          const pdf = buildPdf(pages);
          pdfBlob = pdf.output("blob");
        } catch (e) {
          console.error("[SendToClientDialog] PDF generation failed, emailing without attachment:", e);
        }
      }

      // A plain FormData POST, not a Server Action — the PDF can be several
      // MB once every hotel/activity photo is baked in, and Server Actions
      // serialize arguments through React Flight, which throws "Maximum
      // array nesting exceeded" on a base64 string that large. FormData has
      // no such limit (same pattern as the app's existing photo uploads).
      const body = new FormData();
      body.set("packageId", packageId);
      if (pdfBlob) body.set("pdf", pdfBlob, "itinerary.pdf");

      const res = await fetch("/api/package-builder/send-email", { method: "POST", body });
      const result = await res.json();
      if (result.success) {
        setEmailSent(true);
        toast.success(`Emailed to ${clientEmail}`);
      } else {
        toast.error(result.error ?? "Failed to send email");
      }
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <>
      {/* Off-screen capture source for the emailed PDF attachment — same
         pattern as ItineraryPdfExport. Rendered as a sibling of <Dialog>,
         NOT inside <DialogContent>: Radix's dialog panel carries a CSS
         transform (for its center/zoom animation), and any transformed
         ancestor becomes the containing block for descendant
         position:fixed elements — so a copy nested inside DialogContent
         gets clipped/positioned against the small dialog panel instead of
         the viewport, which is what was producing the trimmed
         sections/images in the emailed PDF. Kept mounted unconditionally
         (not gated by `open`) so images/maps are already warm by the time
         "Send Email" is clicked, same as ItineraryPdfExport's copy. */}
      <div
        ref={captureRef}
        aria-hidden
        style={{ position: "fixed", top: 0, left: "-10000px", width: "210mm" }}
      >
        <ItineraryDocument form={previewForm} variant="flat" />
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to Client</DialogTitle>
            <DialogDescription>
              Pricing is locked and the itinerary link is live. Choose how to notify the client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* WhatsApp option */}
            <div className="flex items-center gap-3 rounded-xl border border-dashboard-base-300 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                <MessageCircle size={18} className="text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-dashboard-base-content">WhatsApp</p>
                <p className="truncate text-xs text-dashboard-base-content/60">Opens a pre-filled message to send manually</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleWhatsapp} className="shrink-0 gap-1.5">
                {whatsappOpened ? <CheckCircle2 size={13} className="text-dashboard-success" /> : <MessageCircle size={13} />}
                {whatsappOpened ? "Opened" : "Open"}
              </Button>
            </div>

            {/* Email option */}
            <div className="flex items-center gap-3 rounded-xl border border-dashboard-base-300 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Mail size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-dashboard-base-content">Email</p>
                <p className="truncate text-xs text-dashboard-base-content/60">
                  {clientEmail || "No email on file for this client"}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90"
                onClick={handleEmail}
                disabled={!clientEmail || emailSending || emailSent}
                title={validationError ?? undefined}
              >
                {emailSending
                  ? <Loader2 size={13} className="animate-spin" />
                  : emailSent
                    ? <CheckCircle2 size={13} />
                    : <Mail size={13} />}
                {emailSending ? "Sending…" : emailSent ? "Sent" : "Send Email"}
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="flex items-center gap-1.5 text-xs text-dashboard-base-content/50 hover:text-dashboard-base-content transition-colors"
          >
            <Copy size={12} /> Copy client link
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
