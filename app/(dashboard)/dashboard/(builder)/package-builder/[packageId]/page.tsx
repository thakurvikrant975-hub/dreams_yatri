import { db } from "@/app/lib/db";
import { getCurrentActor } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { resolveWorkspaceCaps, workspaceRoleOf } from "../workspace-caps";
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

  const actor = await getCurrentActor();
  const [member, pkg] = await Promise.all([
    actor.teamMemberId
      ? db.teamMember.findUnique({
          where: { id: actor.teamMemberId },
          select: { teamRole: { select: { name: true } } },
        })
      : Promise.resolve(null),
    // A brand-new package has no row yet — the exec is navigated here with a
    // freshly-generated id before the first save. Treated as a DRAFT they own,
    // which is exactly what it is about to become.
    db.custom_packages.findUnique({
      where: { id: packageId },
      select: { status: true, verified: true, rejectedAt: true, revisionRequestedAt: true },
    }),
  ]);

  const caps = resolveWorkspaceCaps(workspaceRoleOf(member?.teamRole?.name), {
    status: pkg?.status ?? "DRAFT",
    verified: pkg?.verified ?? false,
    rejectedAt: pkg?.rejectedAt ?? null,
    revisionRequestedAt: pkg?.revisionRequestedAt ?? null,
  });

  // Built only for someone who can actually see costing. For everyone else it
  // is never rendered, never fetched, and the sidebar has no such tab — the
  // absence IS the authorisation, rather than a tab that appears and refuses.
  const costingPanel = caps.seeMargin
    ? <CostingPanel packageId={packageId} canReview={caps.reviewElements} />
    : undefined;

  return <PackageWorkspace packageId={packageId} caps={caps} costingPanel={costingPanel} />;
}
