import { listReviewNotes } from "@/app/(dashboard)/dashboard/(builder)/package-builder/review-notes.actions";
import { loadCostingPanelData } from "./costing-panel-data";
import { VerifyPackageDetailClient } from "./VerifyPackageDetailClient";
import { CostingFindings } from "./CostingFindings";

// ─────────────────────────────────────────────────────────────────────────────
// The Costing tab's contents.
//
// A server component so the builder route can drop it into the editor's sidebar
// without knowing anything about pricing — it hands over a package id, this
// assembles the breakdown, the findings and the decision controls.
//
// Returns null when there is nothing to review (a DRAFT never submitted). The
// tab is only offered when this returns something, so a reviewer never opens a
// Costing section that has nothing in it.
// ─────────────────────────────────────────────────────────────────────────────

export async function CostingPanel({ packageId, canReview }: {
  packageId: string;
  /** From resolveWorkspaceCaps — whether this viewer may raise and close
   * findings, as opposed to only reading what was already raised. */
  canReview: boolean;
}) {
  const [data, notes] = await Promise.all([
    loadCostingPanelData(packageId),
    listReviewNotes(packageId),
  ]);
  if (!data) return null;

  const { pkg, snapshot, rejectionReasons, hotelIdByDay, inclusions, exclusions } = data;

  return (
    <VerifyPackageDetailClient
      variant="panel"
      findingsSlot={
        <CostingFindings
          packageId={pkg.id}
          notes={notes}
          canReview={canReview}
          totalDays={pkg.totalDays}
        />
      }
      pkg={{
        id: pkg.id, title: pkg.title, destination: pkg.destination, startingPoint: pkg.startingPoint,
        totalDays: pkg.totalDays, totalNights: pkg.totalNights, travelDate: pkg.travelDate,
        adults: pkg.adults, children: pkg.children, infants: pkg.infants,
        childrenAges: pkg.childrenAges, infantAges: pkg.infantAges,
        pricePerPerson: pkg.pricePerPerson, totalPrice: pkg.totalPrice, currency: pkg.currency,
        marginPercentage: pkg.marginPercentage, gstPercentage: pkg.gstPercentage,
        status: pkg.status, builtByName: pkg.builtByName, sentAt: pkg.sentAt,
        readyAt: pkg.readyAt, readyByName: pkg.readyByName,
        viewedAt: pkg.viewedAt, viewCount: pkg.viewCount,
        verified: pkg.verified, verifiedAt: pkg.verifiedAt, verifiedByName: pkg.verifiedByName,
        rejectedAt: pkg.rejectedAt, rejectedByName: pkg.rejectedByName, rejectionNote: pkg.rejectionNote,
        rejectionReasonLabel: pkg.rejectionReason?.label ?? null,
        revisionRequestedAt: pkg.revisionRequestedAt, revisionRequestedByName: pkg.revisionRequestedByName, revisionNote: pkg.revisionNote,
        flightsIncluded: pkg.flightsIncluded, flightNotes: pkg.flightNotes, flightFrom: pkg.flightFrom, flightTo: pkg.flightTo,
        trainIncluded: pkg.trainIncluded, trainNotes: pkg.trainNotes, trainFrom: pkg.trainFrom, trainTo: pkg.trainTo,
      }}
      snapshot={snapshot}
      tickets={pkg.tickets}
      addOns={pkg.addOns}
      query={pkg.query!}
      rejectionReasons={rejectionReasons}
      hotelIdByDay={hotelIdByDay}
      inclusions={inclusions}
      exclusions={exclusions}
    />
  );
}
