import { db } from "@/app/lib/db";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveWorkspaceCaps, workspaceRoleOf, ownsPackage } from "../workspace-caps";
import { CostingPanel } from "@/app/(dashboard)/dashboard/(main)/verify-packages/[id]/CostingPanel";
import { PackageWorkspace } from "./PackageWorkspace";

// The one editor. A travel expert building a package and a costing manager
// reviewing one open the SAME url and get the same screen — full width, same
// day rail, same document, same drawers. Nothing about the editor is duplicated
// per role.
//
// What differs is decided here, once, from who is asking:
//
//   travel expert  → builds and prices what we pay; margin and the marked-up
//                    figures are not theirs to see
//   costing        → the same editor, plus a Costing tab carrying the
//                    breakdown, the findings and approve/reject
//
// A server component so this is settled before the first paint. Resolved in the
// client, the editor would render fully editable and then take that away — and
// "what am I allowed to do" would be a question the client answered itself.
export default async function PackageBuilderPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;

  // getEffectiveMember, NOT the session user: a Full Stack Developer using
  // "View As" is deliberately standing in for someone else, and capabilities
  // are the whole point of doing so. Reading the real session here meant the
  // dev saw an FSD's permissions — which map to nothing — no matter who they
  // had switched to.
  const [memberCtx, pkg] = await Promise.all([
    getEffectiveMember(),
    // A brand-new package has no row yet — the exec is navigated here with a
    // freshly-generated id before the first save. Treated as a DRAFT they own,
    // which is exactly what it is about to become.
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
      // A package with no row yet is one the visitor is about to create, so
      // they own it by definition — this is the exec arriving from
      // CreatePackageDialog with a freshly-generated id.
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
