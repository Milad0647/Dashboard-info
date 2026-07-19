"use server";

import { revalidatePath } from "next/cache";
import { canTransferContentOwnership } from "@/lib/auth/access";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import { hasContributorPermission, type ContributorPermissionKey } from "@/lib/contributor-permissions";
import { normalizePlanLabels } from "@/lib/content-topics";
import { getSql } from "@/lib/db/client";
import { pgGetUserById, pgGetUserPermissionsForCampaign } from "@/lib/db/repository-extended";
import { updateMockStore } from "@/lib/mock-data";
import { PRESS_ACTIVITY_TYPES } from "@/lib/press-publications";
import type { ActivityType, ItemStatus, Ownable } from "@/lib/types";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/utils";

export type BulkEditableContentType =
  | "billboard"
  | "poster"
  | "video"
  | "file"
  | "raw_media"
  | "social_post"
  | "site_publication"
  | "activity"
  | "press";

export interface BulkContentPatch {
  /** When provided, replaces plan labels (empty array clears). */
  planLabels?: string[];
  published?: boolean;
  category?: string | null;
  status?: ItemStatus;
  categoryId?: string;
  activityType?: ActivityType;
  /** Admin / کارفرما: transfer content ownership (null clears owner). */
  ownerUserId?: string | null;
}

const PERMISSION_BY_TYPE: Record<BulkEditableContentType, ContributorPermissionKey> = {
  billboard: "billboards",
  poster: "posters",
  video: "videos",
  file: "files",
  raw_media: "rawMedia",
  social_post: "socialPosts",
  site_publication: "sitePublications",
  activity: "activities",
  press: "activities",
};

function resolvePlanColumns(planLabelsInput: string[]) {
  const planLabels = normalizePlanLabels(planLabelsInput);
  return {
    planLabel: planLabels[0] ?? null,
    planLabels,
  };
}

function applyOwnablePatch<T extends Ownable & { published?: boolean }>(
  item: T,
  patch: BulkContentPatch
): T {
  const next = { ...item };
  if (patch.planLabels !== undefined) {
    const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
    next.planLabel = planLabel;
    next.planLabels = planLabels;
  }
  if (patch.published !== undefined) {
    next.published = patch.published;
  }
  if (patch.ownerUserId !== undefined) {
    next.ownerUserId = patch.ownerUserId;
  }
  return next;
}

async function assertCanBulkEdit(
  campaignId: string,
  contentType: BulkEditableContentType
): Promise<{ ok: true; ownerUserId?: string | null } | { ok: false; error: string }> {
  const session = await getAuthSession();
  if (!session) return { ok: false, error: "ورود لازم است" };

  if (isFullAdmin(session)) {
    return { ok: true };
  }

  if (isPostgresConfigured() && session.userId) {
    const permissions = await pgGetUserPermissionsForCampaign(session.userId, campaignId);
    if (!hasContributorPermission(permissions, PERMISSION_BY_TYPE[contentType])) {
      return { ok: false, error: "دسترسی به این بخش را ندارید" };
    }
  }

  return { ok: true, ownerUserId: getOwnerFilter(session) };
}

function hasAnyPatch(patch: BulkContentPatch): boolean {
  return (
    patch.planLabels !== undefined ||
    patch.published !== undefined ||
    patch.category !== undefined ||
    patch.status !== undefined ||
    patch.categoryId !== undefined ||
    patch.activityType !== undefined ||
    patch.ownerUserId !== undefined
  );
}

export async function bulkUpdateContentAction(input: {
  campaignId: string;
  contentType: BulkEditableContentType;
  ids: string[];
  patch: BulkContentPatch;
}): Promise<{ success: boolean; updated: number; error?: string }> {
  const ids = [...new Set(input.ids.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { success: false, updated: 0, error: "هیچ موردی انتخاب نشده است" };
  }
  if (!hasAnyPatch(input.patch)) {
    return { success: false, updated: 0, error: "هیچ تغییری برای اعمال انتخاب نشده است" };
  }

  const session = await getAuthSession();
  if (!session) return { success: false, updated: 0, error: "ورود لازم است" };

  if (input.patch.ownerUserId !== undefined && !canTransferContentOwnership(session)) {
    return { success: false, updated: 0, error: "فقط مدیر یا کارفرما می‌تواند مالک محتوا را تغییر دهد" };
  }

  if (input.patch.ownerUserId) {
    if (isPostgresConfigured()) {
      const user = await pgGetUserById(input.patch.ownerUserId);
      if (!user) {
        return { success: false, updated: 0, error: "کاربر مقصد یافت نشد" };
      }
    }
  }

  const access = await assertCanBulkEdit(input.campaignId, input.contentType);
  if (!access.ok) return { success: false, updated: 0, error: access.error };

  if (isPostgresConfigured()) {
    await bulkUpdatePostgres(input.campaignId, input.contentType, ids, input.patch, access.ownerUserId);
    revalidatePath("/admin");
    revalidatePath("/campaign");
    return { success: true, updated: ids.length };
  }

  if (!isSupabaseConfigured()) {
    const updated = bulkUpdateMock(
      input.campaignId,
      input.contentType,
      ids,
      input.patch,
      access.ownerUserId
    );
    revalidatePath("/admin");
    revalidatePath("/campaign");
    return { success: true, updated };
  }

  return { success: false, updated: 0, error: "ویرایش گروهی فقط روی دیتابیس فعال است" };
}

async function bulkUpdatePostgres(
  campaignId: string,
  contentType: BulkEditableContentType,
  ids: string[],
  patch: BulkContentPatch,
  ownerUserId?: string | null
): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();
  const ownerFilter = ownerUserId ?? null;

  const applyOwnerTransfer = async () => {
    if (patch.ownerUserId === undefined) return;
    const nextOwnerId = patch.ownerUserId;

    if (contentType === "billboard") {
      await sql`
        UPDATE billboards
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
      `;
      return;
    }
    if (contentType === "poster") {
      await sql`
        UPDATE posters
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
      `;
      return;
    }
    if (contentType === "video") {
      await sql`
        UPDATE videos
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
      `;
      return;
    }
    if (contentType === "file") {
      await sql`
        UPDATE campaign_files
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
      `;
      return;
    }
    if (contentType === "raw_media") {
      await sql`
        UPDATE raw_media_uploads
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
      `;
      return;
    }
    if (contentType === "social_post" || contentType === "site_publication") {
      const isSite = contentType === "site_publication";
      await sql`
        UPDATE social_media_posts
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isSite} = true AND platform = 'site')
            OR (${isSite} = false AND platform <> 'site')
          )
      `;
      return;
    }
    if (contentType === "activity" || contentType === "press") {
      const pressTypes = PRESS_ACTIVITY_TYPES;
      const isPress = contentType === "press";
      await sql`
        UPDATE campaign_activities
        SET owner_user_id = ${nextOwnerId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isPress} = true AND activity_type = ANY(${sql.array(pressTypes)}))
            OR (${isPress} = false AND NOT (activity_type = ANY(${sql.array(pressTypes)})))
          )
      `;
    }
  };

  if (contentType === "billboard") {
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE billboards
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE billboards
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.category !== undefined) {
      await sql`
        UPDATE billboards
        SET category = ${patch.category}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.status !== undefined) {
      await sql`
        UPDATE billboards
        SET status = ${patch.status}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "poster") {
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE posters
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE posters
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.categoryId !== undefined) {
      await sql`
        UPDATE posters
        SET category_id = ${patch.categoryId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "video") {
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE videos
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE videos
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.categoryId !== undefined) {
      await sql`
        UPDATE videos
        SET category_id = ${patch.categoryId}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "file") {
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE campaign_files
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE campaign_files
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "raw_media") {
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE raw_media_uploads
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE raw_media_uploads
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "social_post" || contentType === "site_publication") {
    const isSite = contentType === "site_publication";
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE social_media_posts
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isSite} = true AND platform = 'site')
            OR (${isSite} = false AND platform <> 'site')
          )
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE social_media_posts
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isSite} = true AND platform = 'site')
            OR (${isSite} = false AND platform <> 'site')
          )
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
    return;
  }

  if (contentType === "activity" || contentType === "press") {
    const pressTypes = PRESS_ACTIVITY_TYPES;
    const isPress = contentType === "press";
    if (patch.planLabels !== undefined) {
      const { planLabel, planLabels } = resolvePlanColumns(patch.planLabels);
      await sql`
        UPDATE campaign_activities
        SET plan_label = ${planLabel}, plan_labels = ${sql.json(planLabels)}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isPress} = true AND activity_type = ANY(${sql.array(pressTypes)}))
            OR (${isPress} = false AND NOT (activity_type = ANY(${sql.array(pressTypes)})))
          )
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.published !== undefined) {
      await sql`
        UPDATE campaign_activities
        SET published = ${patch.published}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isPress} = true AND activity_type = ANY(${sql.array(pressTypes)}))
            OR (${isPress} = false AND NOT (activity_type = ANY(${sql.array(pressTypes)})))
          )
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    if (patch.activityType !== undefined) {
      await sql`
        UPDATE campaign_activities
        SET activity_type = ${patch.activityType}, updated_at = ${now}
        WHERE campaign_id = ${campaignId} AND id IN ${sql(ids)}
          AND (
            (${isPress} = true AND activity_type = ANY(${sql.array(pressTypes)}))
            OR (${isPress} = false AND NOT (activity_type = ANY(${sql.array(pressTypes)})))
          )
          AND (${ownerFilter}::text IS NULL OR owner_user_id = ${ownerFilter})
      `;
    }
    await applyOwnerTransfer();
  }
}

function bulkUpdateMock(
  campaignId: string,
  contentType: BulkEditableContentType,
  ids: string[],
  patch: BulkContentPatch,
  ownerUserId?: string | null
): number {
  const idSet = new Set(ids);
  let updated = 0;

  const matchesOwner = (item: Ownable) =>
    ownerUserId == null || (item.ownerUserId ?? null) === ownerUserId;

  updateMockStore((store) => {
    const next = { ...store };

    const patchList = <T extends Ownable & { id: string; campaignId: string; published?: boolean }>(
      list: T[],
      extra?: (item: T) => T
    ): T[] =>
      list.map((item) => {
        if (item.campaignId !== campaignId || !idSet.has(item.id) || !matchesOwner(item)) {
          return item;
        }
        updated += 1;
        let result = applyOwnablePatch(item, patch);
        if (extra) result = extra(result);
        return result;
      });

    if (contentType === "billboard") {
      next.billboards = patchList(store.billboards, (item) => ({
        ...item,
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      }));
    } else if (contentType === "poster") {
      next.posters = patchList(store.posters, (item) => ({
        ...item,
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      }));
    } else if (contentType === "video") {
      next.videos = patchList(store.videos, (item) => ({
        ...item,
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      }));
    } else if (contentType === "file") {
      next.files = patchList(store.files ?? []);
    } else if (contentType === "raw_media") {
      // Mock store does not persist raw media uploads.
    } else if (contentType === "social_post" || contentType === "site_publication") {
      next.socialPosts = (store.socialPosts ?? []).map((item) => {
        const isSite = item.platform === "site";
        const matchesType = contentType === "site_publication" ? isSite : !isSite;
        if (item.campaignId !== campaignId || !idSet.has(item.id) || !matchesOwner(item) || !matchesType) {
          return item;
        }
        updated += 1;
        return applyOwnablePatch(item, patch);
      });
    } else if (contentType === "activity" || contentType === "press") {
      const pressSet = new Set<string>(PRESS_ACTIVITY_TYPES);
      next.activities = (store.activities ?? []).map((item) => {
        const isPress = pressSet.has(item.activityType);
        const matchesType = contentType === "press" ? isPress : !isPress;
        if (item.campaignId !== campaignId || !idSet.has(item.id) || !matchesOwner(item) || !matchesType) {
          return item;
        }
        updated += 1;
        let result = applyOwnablePatch(item, patch);
        if (patch.activityType !== undefined) {
          result = { ...result, activityType: patch.activityType };
        }
        return result;
      });
    }

    return next;
  });

  return updated;
}
