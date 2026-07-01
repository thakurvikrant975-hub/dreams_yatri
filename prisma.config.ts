// prisma.config.ts
// Mirrors Next.js env-file loading priority so Prisma CLI always uses
// the same DATABASE_URL as the running app.
//   Priority (highest → lowest):
//   .env.[development|production|test].local
//   .env.local
//   .env.[development|production|test]
//   .env
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const env = process.env.NODE_ENV ?? "development";

dotenv.config({ path: `.env.${env}.local`, override: false });
dotenv.config({ path: ".env.local",        override: false });
dotenv.config({ path: `.env.${env}`,       override: false });
dotenv.config({ path: ".env",              override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: `tsx --env-file=.env.${env}.local prisma/seed.ts`,
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
