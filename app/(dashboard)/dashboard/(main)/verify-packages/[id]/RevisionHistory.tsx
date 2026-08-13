import { getRevisionHistory } from "@/app/(dashboard)/dashboard/(builder)/package-builder/review-notes.actions";
import { RevisionHistoryDialog } from "./RevisionHistoryDialog";

// ─────────────────────────────────────────────────────────────────────────────
// Fetches the revision series and hands it to the dialog.
//
// Split server/client only because the reading is a database call and the
// button needs state. Renders nothing at all on a package that has never been
// sent back, so a first-pass review carries no dead chrome.
//
// custom_packages holds only the LATEST revision — each request overwrites the
// one before — so this reads the activity log, where each was recorded
// separately. Packages revised before that logging existed show nothing here;
// that is honest, and better than inventing a history from the single note that
// happened to survive.
// ─────────────────────────────────────────────────────────────────────────────

export async function RevisionHistory({ packageId }: { packageId: string }) {
  const entries = await getRevisionHistory(packageId);
  return <RevisionHistoryDialog entries={entries} />;
}
