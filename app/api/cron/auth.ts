/** Shared cron auth: require CRON_SECRET via Authorization: Bearer or x-cron-secret. */
export function isAuthorizedCron(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false; // misconfigured ⇒ deny
    const auth = req.headers.get("authorization");
    const header = req.headers.get("x-cron-secret");
    return auth === `Bearer ${secret}` || header === secret;
}
