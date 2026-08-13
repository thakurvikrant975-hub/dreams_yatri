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
 * a Platform Manager can open a package and look, and that is all. */
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
  /** Attach findings to individual elements. */
  reviewElements: boolean;
  /** Approve, reject, or send back for revision. */
  decide: boolean;
  /** Hand the finished package to the client. */
  send: boolean;
};

const NONE: WorkspaceCaps = {
  editItinerary: false,
  editCost: false,
  editMargin: false,
  seeMargin: false,
  editLockedPolicy: false,
  reviewElements: false,
  decide: false,
  send: false,
};

/** Maps a team role name (free text in team_roles.name) onto the three roles
 * this workspace distinguishes. Case- and spacing-insensitive, because these
 * are typed by an admin in the roles screen rather than chosen from an enum. */
export function workspaceRoleOf(teamRoleName: string | null | undefined): WorkspaceRole {
  const name = (teamRoleName ?? "").trim().toLowerCase();
  if (!name) return "other";
  if (name.includes("costing")) return "costing";
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

export function resolveWorkspaceCaps(role: WorkspaceRole, stage: WorkspaceStage): WorkspaceCaps {
  if (isClosed(stage)) return NONE;

  if (role === "costing") {
    // Costing's whole job lives at READY. Before that the exec is still
    // building and there is nothing to review; after SENT the quote is with the
    // client and re-pricing it underneath them would change a number they have
    // already been given.
    const underReview = stage.status === "READY";
    return {
      // Full itinerary editing, so costing can correct an element outright
      // rather than only describing what is wrong with it.
      editItinerary: underReview,
      editCost: underReview,
      editMargin: underReview,
      seeMargin: true,
      editLockedPolicy: underReview,
      reviewElements: underReview,
      decide: underReview,
      send: false,
    };
  }

  if (role === "exec") {
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
      reviewElements: false,
      decide: false,
      // Sending is gated on costing having approved it.
      send: stage.status === "READY" && stage.verified,
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
