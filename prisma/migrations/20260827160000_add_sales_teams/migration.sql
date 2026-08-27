-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "salesTeamId" TEXT;

-- CreateTable
CREATE TABLE "sales_teams" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "leaderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_teams_name_key" ON "sales_teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sales_teams_leaderId_key" ON "sales_teams"("leaderId");

-- CreateIndex
CREATE INDEX "team_members_salesTeamId_idx" ON "team_members"("salesTeamId");

-- AddForeignKey
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_salesTeamId_fkey" FOREIGN KEY ("salesTeamId") REFERENCES "sales_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
