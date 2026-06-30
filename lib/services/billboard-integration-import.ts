import { pgSaveBillboard } from "@/lib/db/repository";
import { getExternalBillboardTag } from "@/lib/models/billboard-api";
import {
  fetchCampaignIntegration,
  mapIntegrationBillboardToBillboard,
} from "@/lib/services/billboard-api";
import { matchOwnerToUser } from "@/lib/services/owner-user-match";
import type { AdminUser, Billboard } from "@/lib/types";

export interface IntegrationBillboardImportResult {
  imported: number;
  skipped: number;
  skippedAdmin: number;
  unmatchedOwners: string[];
  matchedUsers: number;
  total: number;
}

function isAlreadyImported(existing: Billboard[], externalBillboardId: string): boolean {
  const tag = getExternalBillboardTag(externalBillboardId);
  return existing.some(
    (billboard) =>
      billboard.tags.includes(tag) ||
      billboard.externalId === externalBillboardId ||
      billboard.id === `int-${externalBillboardId}`
  );
}

export async function importIntegrationBillboards(params: {
  campaignId: string;
  externalCampaignSlug: string;
  users: AdminUser[];
  existingBillboards: Billboard[];
}): Promise<IntegrationBillboardImportResult> {
  const integration = await fetchCampaignIntegration(params.externalCampaignSlug);

  let imported = 0;
  let skipped = 0;
  let skippedAdmin = 0;
  let matchedUsers = 0;
  let sortOrder = params.existingBillboards.length;
  const unmatchedOwners = new Set<string>();

  for (const item of integration.billboards) {
    if (!item.owner) {
      skippedAdmin += 1;
      continue;
    }

    if (isAlreadyImported(params.existingBillboards, item.billboard_id)) {
      skipped += 1;
      continue;
    }

    const matchedUser = matchOwnerToUser(item.owner, params.users);
    if (matchedUser) {
      matchedUsers += 1;
    } else {
      unmatchedOwners.add(item.owner.name || item.owner.email || item.owner.username);
    }

    sortOrder += 1;
    const mapped = mapIntegrationBillboardToBillboard(item, params.campaignId, {
      sortOrder,
      published: true,
      matchedUser,
      source: "manual",
    });

    await pgSaveBillboard({
      ...mapped,
      id: `int-${item.billboard_id}`,
    });

    imported += 1;
  }

  return {
    imported,
    skipped,
    skippedAdmin,
    unmatchedOwners: [...unmatchedOwners].sort((a, b) => a.localeCompare(b, "fa")),
    matchedUsers,
    total: integration.billboards.length,
  };
}
