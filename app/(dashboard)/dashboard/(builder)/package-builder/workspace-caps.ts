// ─────────────────────────────────────────────────────────────────────────────
// Workspace capabilities
//
// The package builder and the costing review are the SAME workspace — same
// document, same drawers, same inline editing. What differs is who is looking
// and what state the package is in. Rather than fork the UI into two screens
// that drift apart, every difference is expressed here, as data.
//
// Deliberately a pure function of (role, status): no React, no Prisma, no
// request context. That means the server can resolve caps before rendering AND
// re-check them inside an action, from the same code — a capability that only
// existed in the client would be a suggestion, not a rule.
//
// The rule these encode, in one sentence: an exec builds the trip and knows
// what we PAY; costing knows what we CHARGE and decides whether it ships.
// ─────────────────────────────────────────────────────────────────────────────

/** Roles that matter here. Anything else falls through to the read-only set —
 * it can open a package and look, and that is all. */
export type WorkspaceRole =
  | "exec"
  | "costing"
  | "other";

/** Mirrors CustomPackageStatus, plus the review flags that ride alongside it.
 * Status alone isn't enough: a READY package that costing already rejected is
 * back with the exec, even though its status hasn't moved. */
export type WorkspaceStage = {
  status: "DRAFT" | "READY" | "SENT" | "ACCEPTED" | "DECLINED";
  verified: boolean;
  rejectedAt: Date | string | null;
  revisionRequestedAt: Date | string | null;
};

export type WorkspaceCaps = {
  /** Change the trip itself — days, hotels, activities, copy, photos. */
  editItinerary: boolean;
  /** Change what we pay: supplier rates, mattress rates, room counts, per-day
   * cost overrides. */
  editCost: boolean;
  /** Change what we charge: margin %, GST %, and the final quoted price. */
  editMargin: boolean;
  /** See the marked-up numbers — margin, GST, and the net each element carries.
   * The exec sees cost without this; costing sees both sides. */
  seeMargin: boolean;
  /** Strike a company-wide standard inclusion/exclusion line off THIS package.
   *
   * Costing only, and deliberately narrower than editItinerary. The standard
   * lists are house content edited in Itinerary Settings — an exec adding their
   * own lines is normal, an exec quietly dropping "Airport transfers included"
   * from one quote is not. Costing is the one role that reviews what actually
   * ships, so it is the one role that may veto a standard line, and the veto is
   * recorded per package (removedInclusions) rather than changing the house
   * list for everyone. */
  editLockedPolicy: boolean;
  /** Change a package the client already has.
   *
   * Separate from editItinerary, which is false at SENT for everyone, because
   * this is a genuinely different act: the quote has been delivered, and an
   * edit revises something the client is holding rather than building it. It
   * stays open because clients routinely ask for changes after seeing the
   * itinerary — saveCustomPackage snapshots the delivered version first, so
   * what they were originally shown survives the edit.
   *
   * The owning exec only. Costing must never be rewriting a package that is
   * already with the client. */
  editAfterSend: boolean;
  /** Attach findings to individual elements. */
  reviewElements: boolean;
  /** Hand a finished draft to costing — the exec's Mark Ready.
   *
   * Its own capability rather than a corollary of editItinerary, because the
   * two diverge exactly where it matters: costing may edit a package at READY
   * and must never be able to submit one. Left ungated, markPackageReady would
   * let a reviewer push an exec's half-built draft into their own queue, and
   * record the reviewer as the person who marked it ready. */
  submit: boolean;
  /** Approve, reject, or send back for revision. */
  decide: boolean;
  /** Hand the finished package to the client. */
  send: boolean;
  /** Pull an approved or already-sent package back for another look.
   *
   * The exec's, not costing's — and the distinction is real rather than
   * cosmetic. Costing's way of sending something back is to reject it, which
   * carries a reason and their findings. requestPackageRevision does something
   * different: it recalls a package that has already CLEARED review, usually
   * because the client changed their mind or the exec spotted something after
   * the fact. Giving costing a second, reason-light path to undo their own
   * approval would blur the two. */
  revise: boolean;
};

const NONE: WorkspaceCaps = {
  editItinerary: false,
  editCost: false,
  editMargin: false,
  seeMargin: false,
  editLockedPolicy: false,
  editAfterSend: false,
  reviewElements: false,
  submit: false,
  decide: false,
  send: false,
  revise: false,
};

/** Maps a team role name (free text in team_roles.name) onto the three roles
 * this workspace distinguishes. Case- and spacing-insensitive, because these
 * are typed by an admin in the roles screen rather than chosen from an enum. */
export function workspaceRoleOf(teamRoleName: string | null | undefined): WorkspaceRole {
  const name = (teamRoleName ?? "").trim().toLowerCase();
  if (!name) return "other";
  // Platform Managers and Sales Managers review pricing alongside the costing
  // team — the queue is small enough that it needs cover, and both already sit
  // above the execs they'd be reviewing. Same capabilities, not a lesser set: a
  // reviewer who can see the margin but not act on it can only ask someone else
  // to click approve, which is not cover. Checked before the generic "sales"
  // match below so "Sales Manager" lands here, not in the exec branch.
  if (name.includes("costing") || name.includes("platform manager") || name.includes("sales manager")) return "costing";
  // Travel Expert and Sales Executive both build packages; Team Leaders build
  // and oversee. All three are "the exec" as far as this workspace cares.
  if (name.includes("sales") || name.includes("travel expert") || name.includes("team leader")) return "exec";
  return "other";
}

/** A package stops being editable by anyone once it has gone to the client and
 * been answered — at that point it is a record of what was quoted. */
function isClosed(stage: WorkspaceStage): boolean {
  return stage.status === "ACCEPTED" || stage.status === "DECLINED";
}

/** Does this package belong to this viewer?
 *
 * An exec edits their own work, not a colleague's. Ownership runs through the
 * query rather than the package alone, so reassigning a lead hands its packages
 * over with it — and whoever originally built one keeps access, since they are
 * usually the person being asked about it.
 *
 * Team Leaders are owners of everything. They build AND oversee (see
 * workspaceRoleOf), and a lead who cannot open their team's drafts cannot do
 * the second half of that job.
 */
export function ownsPackage(input: {
  viewerId: string | null | undefined;
  viewerRoleName: string | null | undefined;
  /** custom_packages.builtBy */
  builtBy: string | null | undefined;
  /** package_queries.assignedTo */
  queryAssignedTo: string | null | undefined;
}): boolean {
  const name = (input.viewerRoleName ?? "").trim().toLowerCase();
  if (name.includes("team leader")) return true;
  if (!input.viewerId) return false;
  return input.viewerId === input.builtBy || input.viewerId === input.queryAssignedTo;
}

/** Whether the viewer owns this package, for the exec branch below. Costing
 * never owns anything — their claim comes from the review, not the lead — so
 * this is ignored for them. */
export type WorkspaceOwnership = { isOwner: boolean };

export function resolveWorkspaceCaps(
  role: WorkspaceRole,
  stage: WorkspaceStage,
  ownership: WorkspaceOwnership = { isOwner: false },
): WorkspaceCaps {
  if (isClosed(stage)) return NONE;

  if (role === "costing") {
    // Costing's whole job lives at READY, and ends the moment they approve.
    // Before READY the exec is still building and there is nothing to review;
    // after SENT the quote is with the client. And once verified, the package
    // is waiting on the exec to send exactly what was signed off — editing it
    // then would change the thing that was approved without re-approving it.
    // If costing spots something afterwards, the exec pulls it back for
    // revision, which is recorded and puts it back in the queue properly.
    const underReview = stage.status === "READY" && !stage.verified;
    return {
      // Full itinerary editing, so costing can correct an element outright
      // rather than only describing what is wrong with it.
      editItinerary: underReview,
      editCost: underReview,
      editMargin: underReview,
      seeMargin: true,
      editLockedPolicy: underReview,
      editAfterSend: false,
      reviewElements: underReview,
      // Costing never submits. Their way forward is approve or reject.
      submit: false,
      decide: underReview,
      send: false,
      // Costing rejects; the exec revises. See `revise` above.
      revise: false,
    };
  }

  if (role === "exec") {
    // Someone else's package is not theirs to touch, at any status — the whole
    // branch collapses to read-only. Nothing checked this before: any exec
    // could open and edit any other exec's draft.
    if (!ownership.isOwner) return { ...NONE, seeMargin: false };

    // DRAFT is the exec's; READY has been handed to costing and is theirs until
    // they hand it back. Editing a package while it is being reviewed is how
    // two people end up correcting the same element in opposite directions.
    const mine = stage.status === "DRAFT";
    return {
      editItinerary: mine,
      // Supplier rates stay with the exec: they are the ones who negotiated
      // them, and a hand-typed hotel has no rate behind it unless they type it.
      editCost: mine,
      // But not what we charge on top. Margin and GST are costing's lever, and
      // the marked-up figures are hidden entirely — an exec quoting from a net
      // they can see is an exec quoting around costing.
      editMargin: false,
      seeMargin: false,
      // An exec adds their own lines and edits those; the house list is not
      // theirs to trim on a single quote.
      editLockedPolicy: false,
      editAfterSend: stage.status === "SENT",
      reviewElements: false,
      // Only from their own draft — a package already with costing, or already
      // quoted to the client, is not theirs to resubmit.
      submit: mine,
      decide: false,
      // Sending is gated on costing having approved it.
      send: stage.status === "READY" && stage.verified,
      // Only worth offering once there is something to recall: an approved
      // package awaiting send, or one already with the client.
      revise: (stage.status === "READY" && stage.verified) || stage.status === "SENT",
    };
  }

  return { ...NONE, seeMargin: false };
}

/** True when this package is sitting in the costing queue right now — used for
 * the "with costing" badge and to explain to an exec why their fields are
 * locked, rather than leaving them looking broken. */
export function isWithCosting(stage: WorkspaceStage): boolean {
  return stage.status === "READY" && !stage.verified && !stage.rejectedAt;
}
