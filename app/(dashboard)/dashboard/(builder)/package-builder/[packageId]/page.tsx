import { db } from "@/app/lib/db";
import { getCurrentActor } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { resolveWorkspaceCaps, workspaceRoleOf } from "../workspace-caps";
import { PackageWorkspace } from "./PackageWorkspace";

// The builder route is now a thin shell: its only job is to work out what this
// person is allowed to do with this package and hand that to the workspace.
// The editor itself lives in PackageWorkspace and is mounted by the costing
// review too — same code, different capabilities.
//
// A server component so capabilities are resolved BEFORE anything renders. Done
// in the client, the first paint would show a fully-editable builder and then
// take it away, and "what am I allowed to do" would be a value the client had
// decided for itself.
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

  return <PackageWorkspace packageId={packageId} caps={caps} />;
}
