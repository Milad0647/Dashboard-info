import { parseBillboardAssignmentId } from "@/lib/models/billboard-api";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  isSameDay,
} from "@/lib/safe-dates";
import type { Billboard, CampaignSettings, AdminUser } from "@/lib/types";

export {
  BILLBOARD_PLACEHOLDER_IMAGE,
  getBillboardCardImage,
  getBillboardDisplayImage,
  hasBillboardDisplayImage,
} from "@/lib/billboard-media";

export function getBillboardExternalMapId(billboard: Billboard): string | null {
  if (billboard.externalId?.trim()) return billboard.externalId.trim();
  if (billboard.id.startsWith("int-")) return billboard.id.slice(4);
  if (billboard.id.startsWith("api-")) return billboard.id.slice(4);
  const mapTag = billboard.tags.find((tag) => tag.startsWith("map:"));
  return mapTag ? mapTag.slice(4) : null;
}

export function getBillboardAssignmentId(billboard: Billboard): string | null {
  const fromTag = parseBillboardAssignmentId(billboard.tags);
  if (fromTag) return fromTag;
  if (billboard.source === "manual" && billboard.externalId?.trim()) {
    return billboard.externalId.trim();
  }
  return null;
}

export function canManageBillboardPeriods(billboard: Billboard): boolean {
  return Boolean(getBillboardAssignmentId(billboard) || getBillboardExternalMapId(billboard));
}

export function collectPersistedExternalBillboardIds(dbBillboards: Billboard[]): Set<string> {
  const ids = new Set<string>();
  for (const billboard of dbBillboards) {
    const externalId = getBillboardExternalMapId(billboard);
    if (externalId) ids.add(externalId);
  }
  return ids;
}

/**
 * Ephemeral billboards from a live map-bilboard fetch (not DB rows).
 * Live fetch is disabled; kept for legacy id checks.
 */
export function isLiveApiBillboard(billboard: Billboard): boolean {
  return billboard.id.startsWith("api-") || billboard.id.startsWith("int-");
}

export function isApiBillboard(billboard: Billboard): boolean {
  return isLiveApiBillboard(billboard);
}

/** Live API billboards are re-mapped with createdAt=now on every fetch. */
export function countsAsTodayBillboardUpload(billboard: Billboard): boolean {
  if (isLiveApiBillboard(billboard)) return false;
  return isSameDay(getSafeCreatedTimestamp(billboard), getTehranCalendarDateIso());
}

export function getBillboardUploadActivityDate(billboard: Billboard): string {
  if (isLiveApiBillboard(billboard)) return "";
  return getSafeCreatedTimestamp(billboard);
}

export function billboardBelongsToUser(
  billboard: Billboard,
  ownerUserId: string | null
): boolean {
  return (billboard.ownerUserId ?? null) === ownerUserId;
}

export function filterBillboardsByOwnerUser(
  billboards: Billboard[],
  ownerUserId: string | null
): Billboard[] {
  return billboards.filter((billboard) => billboardBelongsToUser(billboard, ownerUserId));
}

function getBillboardRecency(billboard: Billboard): string {
  return billboard.createdAt || billboard.updatedAt || "";
}

/** Newest billboards first (createdAt DESC), then higher sortOrder. */
function sortLocalBillboards(dbBillboards: Billboard[]): Billboard[] {
  return [...dbBillboards].sort((a, b) => {
    const dateCmp = getBillboardRecency(b).localeCompare(getBillboardRecency(a));
    if (dateCmp !== 0) return dateCmp;
    return b.sortOrder - a.sortOrder;
  });
}

export function getExternalCampaignSlug(settings: CampaignSettings): string | null {
  const slug = settings.billboardConfig?.externalCampaignSlug?.trim();
  return slug || null;
}

export function hasExternalBillboardConnection(_settings: CampaignSettings): boolean {
  void _settings;
  return false;
}

export async function resolveAdminBillboards(
  _settings: CampaignSettings,
  dbBillboards: Billboard[],
  _users: AdminUser[] = [],
  ownerUserId?: string | null
): Promise<Billboard[]> {
  void _settings;
  void _users;
  const resolved = sortLocalBillboards(dbBillboards);

  // undefined = admin/client (unscoped). null/string = contributor scope.
  if (ownerUserId !== undefined) {
    return filterBillboardsByOwnerUser(resolved, ownerUserId);
  }

  return resolved;
}

export async function resolvePublicBillboards(
  _settings: CampaignSettings,
  dbBillboards: Billboard[],
  _users: AdminUser[] = []
): Promise<Billboard[]> {
  void _settings;
  void _users;
  return sortLocalBillboards(dbBillboards);
}

export function hasBillboardCoordinates(billboard: Billboard): boolean {
  return (
    typeof billboard.latitude === "number" &&
    typeof billboard.longitude === "number" &&
    Number.isFinite(billboard.latitude) &&
    Number.isFinite(billboard.longitude)
  );
}

export function shouldShowBillboardStatus(billboard: Billboard): boolean {
  return !isApiBillboard(billboard);
}

export function filterPublicBillboardTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      !tag.startsWith("map:") &&
      !tag.startsWith("province:") &&
      !tag.startsWith("assignment:") &&
      !tag.startsWith("display-range:")
  );
}

const DAY_MS = 86_400_000;

export function getBillboardDisplayDays(billboard: Billboard): number | null {
  const periods = billboard.displayPeriods;
  if (!periods?.length) return null;

  let total = 0;
  for (const period of periods) {
    const start = Date.parse(period.startDate);
    const end = Date.parse(period.endDate);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    total += Math.round((end - start) / DAY_MS) + 1;
  }

  return total > 0 ? total : null;
}

export function shouldShowBillboardNotes(billboard: Billboard): boolean {
  return !isApiBillboard(billboard) && Boolean(billboard.notes);
}

export function getBillboardDateLabel(billboard: Billboard): string | null {
  if (billboard.displayDateRange) return billboard.displayDateRange;

  const rangeTag = billboard.tags.find((tag) => tag.startsWith("display-range:"));
  if (rangeTag) {
    return rangeTag.slice("display-range:".length);
  }

  return null;
}
