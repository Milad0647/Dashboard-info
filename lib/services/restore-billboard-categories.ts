import { readFile } from "fs/promises";
import JSZip from "jszip";
import { matchBillboardCategoryKey } from "@/lib/billboard-categories";
import { resolveBackupFilePath } from "@/lib/backups";
import { getSql } from "@/lib/db/client";
import { pgGetCampaignById } from "@/lib/db/repository";
import { listStoredBackups } from "@/lib/services/stored-backup";

export interface RestoreBillboardCategoriesResult {
  restoredFromBackup: number;
  restoredFromTags: number;
  backupsUsed: string[];
  stillMissing: number;
}

type BackupBillboardRow = {
  id?: unknown;
  category?: unknown;
  tags?: unknown;
};

async function loadCategoryMapFromBackup(
  filename: string
): Promise<Map<string, string>> {
  const filePath = resolveBackupFilePath(filename);
  if (!filePath) return new Map();

  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) return new Map();

  const raw = JSON.parse(await manifestFile.async("string")) as {
    billboards?: BackupBillboardRow[];
  };

  const map = new Map<string, string>();
  for (const row of raw.billboards ?? []) {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const category = typeof row.category === "string" ? row.category.trim() : "";
    if (!id || !category) continue;

    const normalized = matchBillboardCategoryKey(category);
    if (normalized) map.set(id, normalized);
  }
  return map;
}

function inferCategoryFromTags(tags: unknown): string | null {
  if (!Array.isArray(tags)) return null;

  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed || trimmed.startsWith("map:") || trimmed.startsWith("assignment:")) {
      continue;
    }
    if (
      trimmed.startsWith("province:") ||
      trimmed.startsWith("display-range:") ||
      trimmed.startsWith("api:")
    ) {
      continue;
    }

    const matched = matchBillboardCategoryKey(trimmed);
    if (matched) return matched;
  }

  return null;
}

async function countMissingCategories(campaignId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM billboards
    WHERE campaign_id = ${campaignId}
      AND (category IS NULL OR btrim(category) = '')
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Restore cleared billboard categories from stored campaign backups (newest→oldest),
 * then fill remaining gaps from tag labels when possible.
 * Only updates rows whose category is currently empty.
 */
export async function restoreBillboardCategories(
  campaignId: string
): Promise<RestoreBillboardCategoriesResult> {
  const campaign = await pgGetCampaignById(campaignId);
  if (!campaign) {
    throw new Error("کمپین یافت نشد");
  }

  const sql = getSql();
  const now = new Date().toISOString();
  let restoredFromBackup = 0;
  const backupsUsed: string[] = [];

  const backups = await listStoredBackups(campaign.slug);
  for (const backup of backups) {
    const remaining = await countMissingCategories(campaignId);
    if (remaining === 0) break;

    const categoryMap = await loadCategoryMapFromBackup(backup.filename);
    if (categoryMap.size === 0) continue;

    let usedThisBackup = false;
    for (const [billboardId, category] of categoryMap) {
      const updated = await sql`
        UPDATE billboards
        SET category = ${category}, updated_at = ${now}
        WHERE id = ${billboardId}
          AND campaign_id = ${campaignId}
          AND (category IS NULL OR btrim(category) = '')
      `;
      const count = Number(updated.count ?? 0);
      if (count > 0) {
        restoredFromBackup += count;
        usedThisBackup = true;
      }
    }

    if (usedThisBackup) {
      backupsUsed.push(backup.filename);
    }
  }

  let restoredFromTags = 0;
  const missingRows = await sql<{ id: string; tags: string[] | null }[]>`
    SELECT id, tags
    FROM billboards
    WHERE campaign_id = ${campaignId}
      AND (category IS NULL OR btrim(category) = '')
  `;

  for (const row of missingRows) {
    const inferred = inferCategoryFromTags(row.tags);
    if (!inferred) continue;

    const updated = await sql`
      UPDATE billboards
      SET category = ${inferred}, updated_at = ${now}
      WHERE id = ${row.id}
        AND campaign_id = ${campaignId}
        AND (category IS NULL OR btrim(category) = '')
    `;
    restoredFromTags += Number(updated.count ?? 0);
  }

  const stillMissing = await countMissingCategories(campaignId);

  return {
    restoredFromBackup,
    restoredFromTags,
    backupsUsed,
    stillMissing,
  };
}
