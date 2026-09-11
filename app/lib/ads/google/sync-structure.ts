import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { gaql, customerIdDigits } from "./client";
import { bulkUpsert, type RawExecutor } from "../bulk-upsert";
import { startSyncRun, finishSyncRun, failSyncRun, type SyncRunDb } from "../sync-run";

/**
 * Step 3 — copies the account's structure into the google_ads_* tables:
 * accounts, budgets (and the history of their amounts), campaigns, ad groups
 * and ads. Read-only towards Google; idempotent towards us — run it twice and
 * the second run changes nothing but lastSeenAt.
 *
 * Everything Google returns is written, REMOVED included: a removed campaign's
 * spend is still history, and its leads still need a name to show against.
 *
 * Takes the database client as an argument rather than importing app/lib/db,
 * so the scheduled route and a tsx script (which can't load app/lib/db — see
 * scripts/_db.ts) run exactly the same code.
 */

/** The budget-history operations used below — narrow for the reason given on SyncRunDb. */
type BudgetHistoryDb = {
  googleAdsBudgetHistory: {
    findMany(args: {
      where: Prisma.GoogleAdsBudgetHistoryWhereInput;
      select: { budgetId: true; amountMicros: true; totalAmountMicros: true };
    }): PromiseLike<{ budgetId: string; amountMicros: bigint | null; totalAmountMicros: bigint | null }[]>;
    updateMany(args: {
      where: Prisma.GoogleAdsBudgetHistoryWhereInput;
      data: Prisma.GoogleAdsBudgetHistoryUncheckedUpdateManyInput;
    }): PromiseLike<unknown>;
    createMany(args: { data: Prisma.GoogleAdsBudgetHistoryCreateManyInput[] }): PromiseLike<unknown>;
  };
};

export type StructureDb = RawExecutor & SyncRunDb & BudgetHistoryDb;

export type StructureSyncResult = {
  runId: string;
  accounts: number;
  budgets: number;
  budgetChanges: number;
  campaigns: number;
  adGroups: number;
  ads: number;
};

/** "customers/1/campaignBudgets/123" → "123". */
const idFrom = (resourceName: string | undefined) => resourceName?.split("/").pop() ?? null;
/** Google's int64 arrives as a string; absent means unset, not zero. */
const micros = (v: string | undefined) => (v === undefined ? null : BigInt(v));
/** "2025-08-29 16:20:02" (account timezone) → "2025-08-29". */
const datePart = (v: string | undefined) => (v ? v.slice(0, 10) : null);

type AccountRow = { customerClient: {
  id: string; descriptiveName?: string; manager?: boolean; level?: string;
  currencyCode: string; timeZone: string; status: string;
} };
type BudgetRow = { campaignBudget: {
  id: string; name?: string; amountMicros?: string; totalAmountMicros?: string;
  period: string; deliveryMethod: string; explicitlyShared?: boolean; status: string;
} };
type CampaignRow = { campaign: {
  id: string; name: string; status: string; advertisingChannelType: string;
  biddingStrategyType?: string; campaignBudget?: string; startDateTime?: string; endDateTime?: string;
} };
type AdGroupRow = { campaign: { id: string }; adGroup: { id: string; name: string; status: string; type?: string } };
type AdRow = { adGroup: { id: string }; adGroupAd: { status: string; ad: { id: string; type?: string; finalUrls?: string[] } } };

export async function syncGoogleAdsStructure(db: StructureDb): Promise<StructureSyncResult> {
  const mcc = customerIdDigits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "");
  if (!mcc) throw new Error("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not set");

  const runId = await startSyncRun(db, { platform: "GOOGLE", kind: "STRUCTURE" });
  try {
    const now = new Date();
    const counts = { accounts: 0, budgets: 0, budgetChanges: 0, campaigns: 0, adGroups: 0, ads: 0 };

    // Accounts: the MCC and everything under it, in one query run on the MCC.
    const accounts = await gaql<AccountRow>(mcc, `
      SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,
             customer_client.level, customer_client.currency_code, customer_client.time_zone,
             customer_client.status
      FROM customer_client`);
    counts.accounts = await bulkUpsert(db, "google_ads_accounts", { key: ["id"], rows: accounts.map(({ customerClient: c }) => ({
      id: c.id,
      managerId: c.level === "0" ? null : mcc,
      name: c.descriptiveName ?? "",
      isManager: !!c.manager,
      currencyCode: c.currencyCode,
      timeZone: c.timeZone,
      status: c.status,
      lastSeenAt: now,
      updatedAt: now,
    })) });

    // Budgets, campaigns, ad groups and ads live in ad accounts, not managers.
    // Parents before children, so every foreign key has its row.
    const adAccounts = accounts.map((a) => a.customerClient).filter((c) => !c.manager && c.status === "ENABLED");
    for (const { id: accountId } of adAccounts) {
      const budgets = (await gaql<BudgetRow>(accountId, `
        SELECT campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros,
               campaign_budget.total_amount_micros, campaign_budget.period,
               campaign_budget.delivery_method, campaign_budget.explicitly_shared, campaign_budget.status
        FROM campaign_budget`)).map(({ campaignBudget: b }) => ({
        id: b.id,
        accountId,
        name: b.name ?? null,
        amountMicros: micros(b.amountMicros),
        totalAmountMicros: micros(b.totalAmountMicros),
        period: b.period,
        deliveryMethod: b.deliveryMethod,
        isShared: !!b.explicitlyShared,
        status: b.status,
        lastSeenAt: now,
        updatedAt: now,
      }));
      counts.budgets += await bulkUpsert(db, "google_ads_budgets", { key: ["id"], rows: budgets });
      counts.budgetChanges += await recordBudgetHistory(db, budgets, now);

      const campaigns = await gaql<CampaignRow>(accountId, `
        SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
               campaign.bidding_strategy_type, campaign.campaign_budget,
               campaign.start_date_time, campaign.end_date_time
        FROM campaign`);
      counts.campaigns += await bulkUpsert(db, "google_ads_campaigns", { key: ["id"], rows: campaigns.map(({ campaign: c }) => ({
        id: c.id,
        accountId,
        budgetId: idFrom(c.campaignBudget),
        name: c.name,
        status: c.status,
        channelType: c.advertisingChannelType,
        biddingStrategyType: c.biddingStrategyType ?? null,
        startDate: datePart(c.startDateTime),
        endDate: datePart(c.endDateTime),
        lastSeenAt: now,
        updatedAt: now,
      })) });

      const adGroups = await gaql<AdGroupRow>(accountId, `
        SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, campaign.id FROM ad_group`);
      counts.adGroups += await bulkUpsert(db, "google_ads_ad_groups", { key: ["id"], rows: adGroups.map(({ adGroup: g, campaign }) => ({
        id: g.id,
        campaignId: campaign.id,
        name: g.name,
        status: g.status,
        type: g.type ?? null,
        lastSeenAt: now,
        updatedAt: now,
      })) });

      const ads = await gaql<AdRow>(accountId, `
        SELECT ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status,
               ad_group_ad.ad.final_urls, ad_group.id
        FROM ad_group_ad`);
      counts.ads += await bulkUpsert(db, "google_ads_ads", { key: ["adGroupId", "id"], rows: ads.map(({ adGroup, adGroupAd: a }) => ({
        adGroupId: adGroup.id,
        id: a.ad.id,
        type: a.ad.type ?? null,
        status: a.status,
        finalUrl: a.ad.finalUrls?.[0] ?? null,
        lastSeenAt: now,
        updatedAt: now,
      })) });
    }

    const rowsWritten = counts.accounts + counts.budgets + counts.budgetChanges + counts.campaigns + counts.adGroups + counts.ads;
    await finishSyncRun(db, runId, rowsWritten, { ...counts, adAccounts: adAccounts.map((a) => a.id) });
    return { runId, ...counts };
  } catch (e) {
    await failSyncRun(db, runId, e);
    throw e;
  }
}

/**
 * Opens a history row for every budget whose amount differs from its open one
 * (or that has none yet), closing the old. Two statements, not a transaction:
 * if the second fails, the budget is left with no open row, and the next sync
 * opens one — it heals rather than corrupting.
 */
async function recordBudgetHistory(
  db: StructureDb,
  budgets: { id: string; amountMicros: bigint | null; totalAmountMicros: bigint | null }[],
  now: Date,
): Promise<number> {
  if (budgets.length === 0) return 0;
  const open = await db.googleAdsBudgetHistory.findMany({
    where: { budgetId: { in: budgets.map((b) => b.id) }, validTo: null },
    select: { budgetId: true, amountMicros: true, totalAmountMicros: true },
  });
  const openBy = new Map(open.map((h) => [h.budgetId, h]));
  const changed = budgets.filter((b) => {
    const h = openBy.get(b.id);
    return !h || h.amountMicros !== b.amountMicros || h.totalAmountMicros !== b.totalAmountMicros;
  });
  if (changed.length === 0) return 0;

  const closing = changed.filter((b) => openBy.has(b.id)).map((b) => b.id);
  if (closing.length) {
    await db.googleAdsBudgetHistory.updateMany({ where: { budgetId: { in: closing }, validTo: null }, data: { validTo: now } });
  }
  await db.googleAdsBudgetHistory.createMany({
    data: changed.map((b) => ({ budgetId: b.id, amountMicros: b.amountMicros, totalAmountMicros: b.totalAmountMicros, validFrom: now })),
  });
  return changed.length;
}
