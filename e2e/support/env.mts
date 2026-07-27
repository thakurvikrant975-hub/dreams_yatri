import { config } from "dotenv";

// Mirrors the --env-file=.env --env-file=.env.development.local chain used by
// every other script in this repo. In CI, DATABASE_URL/AUTH_SECRET etc. are
// already real env vars (from secrets) — config() silently no-ops on missing
// files, so this is a no-op there.
config({ path: ".env" });
config({ path: ".env.development.local", override: true });
