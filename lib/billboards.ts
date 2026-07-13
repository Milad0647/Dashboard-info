import { parseBillboardAssignmentId } from "@/lib/models/billboard-api";
import {
  fetchAllExternalBillboards,
  fetchCampaignIntegration,
  mapExternalBillboardToBillboard,
  mapIntegrationBillboardToBillboard,
} from "@/lib/services/billboard-api";
import { matchOwnerToUser } from "@/lib/services/owner-user-match";
import { isoFromGregorian } from "@/lib/jalali";
import { getSafeUploadTimestamp, isSameDay } from "@/lib/safe-dates";
import type { AdminUser, Billboard, CampaignSettings } from "@/lib/types";

function todayIso(): string {
  const date = new Date();
  return isoFromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export {
  BILLBOARD_PLACEHOLDER_IMAGE,
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

/** Ephemeral billboards fetched live from map-bilboard API (not saved locally). */
export function isLiveApiBillboard(billboard: Billboard): boolean {
  return billboard.source === "api" || billboard.id.startsWith("api-");
}

export function isApiBillboard(billboard: Billboard): boolean {
  return isLiveApiBillboard(billboard);
}

/** Live API billboards are re-mapped with createdAt=now on every fetch. */
export function countsAsTodayBillboardUpload(billboard: Billboard): boolean {
  if (isLiveApiBillboard(billboard)) return false;
  return isSameDay(getSafeUploadTimestamp(billboard), todayIso());
}

export function getBillboardUploadActivityDate(billboard: Billboard): string {
  if (isLiveApiBillboard(billboard)) return "";
  return getSafeUploadTimestamp(billboard);
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

function isManualBillboard(billboard: Billboard): boolean {
  return !isLiveApiBillboard(billboard);
}

function excludePersistedLiveBillboards(
  liveBillboards: Billboard[],
  dbBillboards: Billboard[]
): Billboard[] {
  const persistedIds = collectPersistedExternalBillboardIds(dbBillboards);
  if (persistedIds.size === 0) return liveBillboards;

  return liveBillboards.filter((billboard) => {
    const externalId = getBillboardExternalMapId(billboard);
    return !externalId || !persistedIds.has(externalId);
  });
}

export function getExternalCampaignSlug(settings: CampaignSettings): string | null {
  const slug = settings.billboardConfig?.externalCampaignSlug?.trim();
  return slug || null;
}

export function hasExternalBillboardConnection(settings: CampaignSettings): boolean {
  return Boolean(
    getExternalCampaignSlug(settings) || settings.billboardConfig?.externalCampaignId
  );
}

async function fetchLiveBillboards(
  settings: CampaignSettings,
  users: AdminUser[] = []
): Promise<Billboard[]> {
  const integrationSlug = getExternalCampaignSlug(settings);
  if (integrationSlug) {
    const integration = await fetchCampaignIntegration(integrationSlug);

    return integration.billboards.map((item, index) => {
      const matchedUser = item.owner ? matchOwnerToUser(item.owner, users) : null;
      return mapIntegrationBillboardToBillboard(item, settings.id, {
        sortOrder: index + 1,
        published: true,
        matchedUser,
      });
    });
  }

  const externalCampaignId = settings.billboardConfig?.externalCampaignId;
  if (!externalCampaignId) {
    return [];
  }

  const externalBillboards = await fetchAllExternalBillboards(externalCampaignId);
  return externalBillboards
    .filter((item) => item.status === "active")
    .map((item, index) =>
      mapExternalBillboardToBillboard(item, settings.id, {
        sortOrder: index + 1,
        published: true,
      })
    );
}

export async function resolveAdminBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[],
  users: AdminUser[] = [],
  ownerUserId?: string | null
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter(isManualBillboard)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let resolved: Billboard[];

  if (!hasExternalBillboardConnection(settings)) {
    resolved = manualBillboards;
  } else {
    try {
      const liveBillboards = excludePersistedLiveBillboards(
        await fetchLiveBillboards(settings, users),
        dbBillboards
      );
      resolved = [
        ...manualBillboards,
        ...liveBillboards.map((billboard, index) => ({
          ...billboard,
          sortOrder: manualBillboards.length + index + 1,
        })),
      ];
    } catch (error) {
      console.error("Admin billboard API fetch failed:", error);
      resolved = manualBillboards;
    }
  }

  // undefined = admin/client (unscoped). null/string = contributor scope.
  if (ownerUserId !== undefined) {
    return filterBillboardsByOwnerUser(resolved, ownerUserId);
  }

  return resolved;
}

export async function resolvePublicBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[],
  users: AdminUser[] = []
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter(isManualBillboard)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!hasExternalBillboardConnection(settings)) {
    return manualBillboards;
  }

  try {
    const liveBillboards = excludePersistedLiveBillboards(
      await fetchLiveBillboards(settings, users),
      dbBillboards
    );
    return [
      ...manualBillboards,
      ...liveBillboards.map((billboard, index) => ({
        ...billboard,
        sortOrder: manualBillboards.length + index + 1,
        published: true,
      })),
    ];
  } catch (error) {
    console.error("Live billboard fetch failed:", error);
    return manualBillboards;
  }
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
