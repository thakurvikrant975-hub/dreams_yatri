-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "teamMemberId" TEXT,
    "salesTeamId" TEXT,
    "revenueTarget" DOUBLE PRECISION,
    "conversionTarget" INTEGER,
    "setById" TEXT,
    "setByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_targets_year_month_idx" ON "sales_targets"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_teamMemberId_year_month_key" ON "sales_targets"("teamMemberId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_salesTeamId_year_month_key" ON "sales_targets"("salesTeamId", "year", "month");

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_salesTeamId_fkey" FOREIGN KEY ("salesTeamId") REFERENCES "sales_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
