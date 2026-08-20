// Values shared between the follow-up queue's server action and its page.
//
// Kept out of catalog-actions.ts because a "use server" module may only export
// async functions — a plain `export const` there builds fine under tsc and then
// fails the production build.

/** Enough for any realistic follow-up backlog; the page says so when it bites. */
export const QUICK_HOTEL_LIMIT = 200;
