import { db } from "@/app/lib/db";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import {
  resolveWorkspaceCaps, workspaceRoleOf, ownsPackage,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/workspace-caps";
import { CostingPanel } from "@/app/(dashboard)/dashboard/(main)/verify-packages/[id]/CostingPanel";
import { PackageWorkspace } from "../PackageWorkspace";

// The costing review, inside the editor — the second of the two review paths
// costing has while this one is being proven.
//
//   /dashboard/verify-packages/[id]              the established screen: a
//                                                pricing breakdown beside a
//                                                read-only summary. Unchanged,
//                                                and still the one in daily use.
//
//   /dashboard/package-builder/[id]/review    this one: the same editor the
//                                                exec builds in, plus a Costing
//                                                tab carrying the breakdown, the
//                                                findings and approve/reject —
//                                                so a reviewer corrects an
//                                                element where it sits instead
//                                                of describing it in a note and
//                                                sending the package back.
//
// Deliberately a sibling of the v2 builder rather than a mode inside it. The
// builder at ../page.tsx is the exec's, and has no notion of who is looking;
// this route resolves that first and hands the answer in.
//
// A server component, so the question is settled before the first paint.
// Resolved in the client, the editor would render fully editable and then take
// that away — and "what am I allowed to do" would be a question the client
// answered about itself.
export default async function PackageReviewPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;

  // getEffectiveMember, NOT the session user: a Full Stack Developer using
  // "View As" is deliberately standing in for someone else, and capabilities
  // are the whole point of doing so.
  const [memberCtx, pkg] = await Promise.all([
    getEffectiveMember(),
    db.custom_packages.findUnique({
      where: { id: packageId },
      select: {
        status: true, verified: true, rejectedAt: true, revisionRequestedAt: true,
        builtBy: true, query: { select: { assignedTo: true } },
      },
    }),
  ]);

  const caps = resolveWorkspaceCaps(
    workspaceRoleOf(memberCtx?.member?.teamRole?.name),
    {
      status: pkg?.status ?? "DRAFT",
      verified: pkg?.verified ?? false,
      rejectedAt: pkg?.rejectedAt ?? null,
      revisionRequestedAt: pkg?.revisionRequestedAt ?? null,
    },
    {
      // No row yet means the visitor is about to create it, so they own it.
      isOwner: pkg == null || ownsPackage({
        viewerId: memberCtx?.member?.id,
        viewerRoleName: memberCtx?.member?.teamRole?.name,
        builtBy: pkg.builtBy,
        queryAssignedTo: pkg.query?.assignedTo,
      }),
    },
  );

  // Built only for someone who can actually see costing. For everyone else it
  // is never rendered, never fetched, and the sidebar has no such tab — the
  // absence IS the authorisation, rather than a tab that appears and refuses.
  const costingPanel = caps.seeMargin
    ? <CostingPanel packageId={packageId} canReview={caps.reviewElements} />
    : undefined;

  return <PackageWorkspace packageId={packageId} caps={caps} costingPanel={costingPanel} />;
}
