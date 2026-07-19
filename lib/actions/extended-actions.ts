"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import {
  assertCanMutateOwnedContent,
  assertCanMutateOwnedContentIfExists,
} from "@/lib/auth/assert-content-ownership";
import { canScoreContent, isClientUser } from "@/lib/auth/access";
import {
  assertTutorialForPossibleCreate,
} from "@/lib/auth/require-tutorial-completion";
import {
  defaultContributorPermissions,
  hasContributorPermission,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { hashPassword } from "@/lib/auth/password";
import { generateAccessCodePassword } from "@/lib/auth/generate-access-code";
import * as pgExt from "@/lib/db/repository-extended";
import type { MeetingDecisionPayload, MeetingTaskPayload } from "@/lib/db/repository-extended";
import type { BroadcastReport, CampaignActivity, CampaignMeeting, SocialMediaPost, SocialPlatformStat } from "@/lib/types";
import { isSitePublication } from "@/lib/social-posts";
import { isPostgresConfigured } from "@/lib/utils";
import { resolveSaveOwnerUserId } from "@/lib/admin-content-owner";
import { stripFileAccessTokensDeep } from "@/lib/uploads";
import {
  auditContentChange,
  auditContentDelete,
  logAuditForSession,
} from "@/lib/audit/log-event";
import { getContentTitleValidationError } from "@/lib/content-constraints";
import type { TutorialSectionKey } from "@/lib/section-tutorials";

function validateTitlePayload(data: { title?: unknown }) {
  const error = getContentTitleValidationError(data.title);
  return error ? { success: false as const, error } : null;
}

function activityTutorialKey(
  activityType: CampaignActivity["activityType"] | undefined
): TutorialSectionKey {
  if (activityType === "magazine" || activityType === "newspaper") {
    return "pressPublications";
  }
  return "activities";
}

async function revalidateExtended(slug?: string) {
  revalidatePath("/admin/social-posts");
  revalidatePath("/admin/social-analytics");
  revalidatePath("/admin/site-publications");
  revalidatePath("/admin/activities");
  revalidatePath("/admin/broadcast");
  revalidatePath("/admin/meetings");
  revalidatePath("/admin/users");
  revalidatePath("/admin/profile");
  revalidatePath("/admin/analytics");
  revalidatePath("/campaign");
  if (slug) revalidatePath(`/campaign/${slug}`);
}

async function withSaveOwnerScope<T extends { id?: string; ownerUserId?: string | null; published?: boolean }>(
  session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>,
  data: T
): Promise<T> {
  const cleaned = stripFileAccessTokensDeep(data);
  const ownerUserId = await resolveSaveOwnerUserId({
    session,
    explicitOwnerUserId: cleaned.ownerUserId,
    contentId: cleaned.id,
  });

  if (!isFullAdmin(session)) {
    return {
      ...cleaned,
      ownerUserId,
      published: true,
    };
  }

  return {
    ...cleaned,
    ownerUserId,
  };
}

export async function saveSocialPostAction(data: Partial<SocialMediaPost> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "socialPosts")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const payload = await withSaveOwnerScope(session, data);

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(session, "social_media_posts", data.id);
    if (denied) return denied;
  }

  const tutorialKey = isSitePublication({ platform: data.platform ?? "other" })
    ? "sitePublications"
    : "socialPosts";
  const tutorialDenied = await assertTutorialForPossibleCreate(
    tutorialKey,
    "social_media_posts",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;

  const result = await pgExt.pgSaveSocialPost(payload);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "social_post",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title ?? data.platform,
  });
  await revalidateExtended();
  return result;
}

export async function deleteSocialPostAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  const denied = await assertCanMutateOwnedContent(session, "social_media_posts", id);
  if (denied) return denied;
  await pgExt.pgDeleteSocialPost(id);
  await auditContentDelete({ entityType: "social_post", entityId: id });
  await revalidateExtended();
  return { success: true };
}

export async function fetchSocialLinkMetricsAction(input: {
  url: string;
  platform?: string | null;
}) {
  const session = await getAuthSession();
  if (!session) return { success: false as const, error: "Unauthorized" };

  const { fetchSocialLinkMetrics } = await import("@/lib/services/link-metrics");
  const metrics = await fetchSocialLinkMetrics(input.url, input.platform);

  if (metrics.error || metrics.supported === false) {
    return {
      success: false as const,
      error: metrics.error ?? "واکشی از این لینک پشتیبانی نمی‌شود",
      platform: metrics.platform,
    };
  }

  return {
    success: true as const,
    platform: metrics.platform,
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    title: metrics.title ?? null,
    description: metrics.description ?? null,
    coverImageUrl: metrics.coverImageUrl ?? null,
    publishedDate: metrics.publishedDate ?? null,
  };
}

export async function refreshSocialPostMetricsAction(postId: string) {
  const session = await getAuthSession();
  if (!session) return { success: false as const, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false as const, error: "Database required" };

  const denied = await assertCanMutateOwnedContent(session, "social_media_posts", postId);
  if (denied) return { success: false as const, error: denied.error };

  const existing = await pgExt.pgGetSocialPostById(postId);
  if (!existing) return { success: false as const, error: "پست یافت نشد" };

  if (!isFullAdmin(session) && existing.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, existing.campaignId);
    if (!hasContributorPermission(permissions, "socialPosts")) {
      return { success: false as const, error: "دسترسی ندارید" };
    }
  }

  const { fetchSocialLinkMetrics } = await import("@/lib/services/link-metrics");
  const metrics = await fetchSocialLinkMetrics(existing.link, existing.platform);

  if (metrics.error || metrics.supported === false) {
    return {
      success: false as const,
      error: metrics.error ?? "واکشی از این لینک پشتیبانی نمی‌شود",
      platform: metrics.platform,
    };
  }

  const nextTitle =
    existing.title?.trim() || metrics.title?.trim() || existing.title || "";
  const nextDescription = existing.description?.trim()
    ? existing.description
    : metrics.description ?? existing.description;
  const nextCover = existing.coverImageUrl?.trim()
    ? existing.coverImageUrl
    : metrics.coverImageUrl ?? existing.coverImageUrl;
  const nextPublishedDate = existing.publishedDate || metrics.publishedDate || existing.publishedDate;

  const result = await pgExt.pgSaveSocialPost({
    ...existing,
    title: nextTitle,
    description: nextDescription,
    coverImageUrl: nextCover,
    publishedDate: nextPublishedDate,
    views: metrics.views ?? existing.views,
    likes: metrics.likes ?? existing.likes,
    comments: metrics.comments ?? existing.comments,
    shares: metrics.shares ?? existing.shares,
  });

  await auditContentChange({
    isUpdate: true,
    entityType: "social_post",
    entityId: postId,
    campaignId: existing.campaignId,
    label: nextTitle || existing.platform,
  });
  await revalidateExtended();

  return {
    success: true as const,
    id: result.id,
    views: metrics.views ?? existing.views,
    likes: metrics.likes ?? existing.likes,
    comments: metrics.comments ?? existing.comments,
    shares: metrics.shares ?? existing.shares,
    title: nextTitle,
    description: nextDescription ?? null,
    coverImageUrl: nextCover ?? null,
    publishedDate: nextPublishedDate,
  };
}

export async function saveSocialPlatformStatAction(data: Partial<SocialPlatformStat> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "socialPosts")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  if (data.id && !isFullAdmin(session)) {
    const existing = await pgExt.pgGetSocialPlatformStatById(data.id);
    if (!existing) {
      return { success: false, error: "رکورد یافت نشد" };
    }
    if (existing.ownerUserId !== session.userId) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const tutorialDenied = await assertTutorialForPossibleCreate(
    "socialAnalytics",
    "social_platform_stats",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;

  const payload = await withSaveOwnerScope(session, data);

  const result = await pgExt.pgSaveSocialPlatformStat(payload);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "social_platform_stat",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title ?? data.platform,
  });
  await revalidateExtended();
  return result;
}

export async function deleteSocialPlatformStatAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };

  if (!isFullAdmin(session)) {
    const existing = await pgExt.pgGetSocialPlatformStatById(id);
    if (!existing) {
      return { success: false, error: "رکورد یافت نشد" };
    }
    if (existing.ownerUserId !== session.userId) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  await pgExt.pgDeleteSocialPlatformStat(id);
  await auditContentDelete({ entityType: "social_platform_stat", entityId: id });
  await revalidateExtended();
  return { success: true };
}

export async function saveBroadcastReportAction(data: Partial<BroadcastReport> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "broadcast")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const payload = await withSaveOwnerScope(session, data);

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const tutorialDenied = await assertTutorialForPossibleCreate(
    "broadcast",
    "broadcast_reports",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;

  const result = await pgExt.pgSaveBroadcastReport(payload);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "broadcast_report",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateExtended();
  return result;
}

export async function deleteBroadcastReportAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  const denied = await assertCanMutateOwnedContent(session, "broadcast_reports", id);
  if (denied) return denied;
  await pgExt.pgDeleteBroadcastReport(id);
  await auditContentDelete({ entityType: "broadcast_report", entityId: id });
  await revalidateExtended();
  return { success: true };
}

export async function saveCampaignActivityAction(data: Partial<CampaignActivity> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "activities")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const payload = await withSaveOwnerScope(session, data);

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const tutorialDenied = await assertTutorialForPossibleCreate(
    activityTutorialKey(data.activityType),
    "campaign_activities",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;

  const result = await pgExt.pgSaveCampaignActivity(payload);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "activity",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
    metadata: { activityType: data.activityType },
  });
  await revalidateExtended();
  return result;
}

export async function deleteCampaignActivityAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  const denied = await assertCanMutateOwnedContent(session, "campaign_activities", id);
  if (denied) return denied;
  await pgExt.pgDeleteCampaignActivity(id);
  await auditContentDelete({ entityType: "activity", entityId: id });
  await revalidateExtended();
  return { success: true };
}

export async function saveMeetingAction(
  data: Partial<CampaignMeeting> & { id?: string },
  tasks: MeetingTaskPayload[],
  decisions: MeetingDecisionPayload[] = []
) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "meetings")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const payload = await withSaveOwnerScope(session, data);

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const tutorialDenied = await assertTutorialForPossibleCreate(
    "meetings",
    "campaign_meetings",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;

  const result = await pgExt.pgSaveMeetingWithTasks(payload, tasks, decisions);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "meeting",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
    metadata: { taskCount: tasks.length, decisionCount: decisions.length },
  });
  await revalidateExtended();
  return result;
}

export async function saveMeetingsViewPasswordAction(
  campaignId: string,
  options: { password?: string; removePassword?: boolean }
) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session)) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, campaignId);
    if (!hasContributorPermission(permissions, "meetings")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  if (options.removePassword) {
    await pgExt.pgUpdateMeetingsViewPassword(campaignId, null);
    await revalidateExtended();
    return { success: true };
  }

  const password = options.password?.trim();
  if (!password) {
    return { success: false, error: "رمز الزامی است" };
  }

  const passwordHash = await hashPassword(password);
  await pgExt.pgUpdateMeetingsViewPassword(campaignId, passwordHash);
  await revalidateExtended();
  return { success: true };
}

export async function saveCampaignPagePasswordAction(
  campaignId: string,
  options: { password?: string; removePassword?: boolean }
) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  if (options.removePassword) {
    await pgExt.pgUpdatePageViewPassword(campaignId, null);
    await revalidateExtended();
    revalidatePath("/campaign");
    return { success: true };
  }

  const password = options.password?.trim();
  if (!password) {
    return { success: false, error: "رمز الزامی است" };
  }
  if (password.length < 4) {
    return { success: false, error: "رمز باید حداقل ۴ کاراکتر باشد" };
  }

  const passwordHash = await hashPassword(password);
  await pgExt.pgUpdatePageViewPassword(campaignId, passwordHash);
  await revalidateExtended();
  revalidatePath("/campaign");
  return { success: true };
}

function endOfDayIso(isoDate: string): string {
  // Store expiry as end of the selected calendar day (UTC).
  return `${isoDate}T23:59:59.999Z`;
}

export async function listCampaignPageAccessCodesAction(campaignId: string) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  try {
    const codes = await pgExt.pgListCampaignPageAccessCodes(campaignId);
    return { success: true as const, codes };
  } catch {
    return { success: false as const, error: "بارگذاری کدهای دسترسی ناموفق بود" };
  }
}

export async function generateCampaignPageAccessCodesAction(
  campaignId: string,
  options: {
    titleBase: string;
    count: number;
    expiresAt?: string | null;
    maxUnlocks?: number | null;
  }
) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  const titleBase = options.titleBase?.trim();
  if (!titleBase) {
    return { success: false as const, error: "عنوان الزامی است" };
  }
  if (titleBase.length > 120) {
    return { success: false as const, error: "عنوان خیلی بلند است" };
  }

  const count = Math.floor(Number(options.count));
  if (!Number.isFinite(count) || count < 1 || count > 20) {
    return { success: false as const, error: "تعداد باید بین ۱ تا ۲۰ باشد" };
  }

  let expiresAt: string | null = null;
  const expiresRaw = options.expiresAt?.trim();
  if (expiresRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresRaw)) {
      return { success: false as const, error: "تاریخ انقضا نامعتبر است" };
    }
    expiresAt = endOfDayIso(expiresRaw);
  }

  let maxUnlocks: number | null = null;
  if (options.maxUnlocks != null && options.maxUnlocks !== undefined) {
    const raw = Number(options.maxUnlocks);
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 1) {
      return { success: false as const, error: "سقف ورود باید عدد صحیح مثبت باشد" };
    }
    if (raw > 10000) {
      return { success: false as const, error: "سقف ورود خیلی بزرگ است" };
    }
    maxUnlocks = raw;
  }

  try {
    const plaintexts: string[] = [];
    const items: Array<{
      title: string;
      passwordHash: string;
      expiresAt: string | null;
      maxUnlocks: number | null;
    }> = [];

    for (let i = 0; i < count; i += 1) {
      const title = count === 1 ? titleBase : `${titleBase} ${i + 1}`;
      const plaintext = generateAccessCodePassword(10);
      plaintexts.push(plaintext);
      items.push({
        title,
        passwordHash: await hashPassword(plaintext),
        expiresAt,
        maxUnlocks,
      });
    }

    const created = await pgExt.pgCreateCampaignPageAccessCodes(campaignId, items);
    await revalidateExtended();
    revalidatePath("/campaign");

    return {
      success: true as const,
      codes: created.map((row, index) => ({
        id: row.id,
        title: row.title,
        password: plaintexts[index]!,
        expiresAt,
        maxUnlocks,
      })),
    };
  } catch {
    return { success: false as const, error: "ساخت کد دسترسی ناموفق بود. دوباره تلاش کنید." };
  }
}

export async function revokeCampaignPageAccessCodeAction(campaignId: string, codeId: string) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  try {
    const revoked = await pgExt.pgRevokeCampaignPageAccessCode(campaignId, codeId);
    if (!revoked) {
      return { success: false as const, error: "کد یافت نشد یا قبلاً لغو شده" };
    }

    await revalidateExtended();
    revalidatePath("/campaign");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "لغو کد ناموفق بود" };
  }
}

export async function deleteMeetingAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };

  const meeting = await pgExt.pgGetMeetingById(id);
  if (!meeting) return { success: false, error: "جلسه یافت نشد" };

  if (!isFullAdmin(session)) {
    if (!session.userId || meeting.ownerUserId !== session.userId) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  await pgExt.pgDeleteMeeting(id);
  await auditContentDelete({ entityType: "meeting", entityId: id });
  await revalidateExtended();
  return { success: true };
}

export async function toggleMeetingTaskAction(taskId: string, completed: boolean) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };

  const meeting = await pgExt.pgGetMeetingTaskOwner(taskId);
  if (!meeting) return { success: false, error: "وظیفه یافت نشد" };

  if (!isFullAdmin(session)) {
    if (meeting.ownerUserId !== session.userId) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  await pgExt.pgToggleMeetingTask(taskId, completed);
  await revalidateExtended();
  return { success: true };
}

export async function saveProfileAction(data: {
  name: string;
  province?: string | null;
  city?: string | null;
  accountManagerName?: string | null;
  phone?: string | null;
}) {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const user = await pgExt.pgGetUserById(session.userId);
  if (!user) {
    return { success: false, error: "کاربر یافت نشد" };
  }

  const result = await pgExt.pgSaveUser({
    id: session.userId,
    email: user.email,
    name: data.name,
    role: user.role,
    province: data.province,
    city: data.city,
    region: user.region,
    phone: data.phone?.trim() || null,
    accountManagerName: data.accountManagerName,
    campaignIds: user.campaignIds,
    campaignPermissions: user.campaignPermissions,
  });
  await logAuditForSession(session, {
    category: "admin",
    action: "profile.update",
    entityType: "user",
    entityId: session.userId,
    label: "به‌روزرسانی پروفایل",
  });
  await revalidateExtended();
  return result;
}

export async function saveUserAction(data: {
  id?: string;
  email: string;
  name: string;
  role: "admin" | "contributor" | "client";
  password?: string;
  province?: string | null;
  city?: string | null;
  region?: string | null;
  phone?: string | null;
  accountManagerName?: string | null;
  campaignIds?: string[];
  campaignPermissions?: Record<string, ContributorPermissions>;
}) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };

  let accountManagerName = data.accountManagerName;
  let phone = data.phone;
  if (data.id) {
    const existing = await pgExt.pgGetUserById(data.id);
    // Preserve profile-owned field unless explicitly provided
    if (accountManagerName === undefined) {
      accountManagerName = existing?.accountManagerName ?? null;
    }
    if (phone === undefined) {
      phone = existing?.phone ?? null;
    }
  }

  const result = await pgExt.pgSaveUser({
    ...data,
    accountManagerName,
    phone,
  });
  await logAuditForSession(session, {
    category: "admin",
    action: data.id ? "user.update" : "user.create",
    entityType: "user",
    entityId: data.id,
    label: data.name,
    metadata: { role: data.role, email: data.email },
  });
  await revalidateExtended();
  return result;
}

export async function saveUserRegionAction(data: {
  userId: string;
  region: string | null;
}) {
  const session = await getAuthSession();
  if (!session || (!isFullAdmin(session) && !isClientUser(session))) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };

  const result = await pgExt.pgUpdateUserRegion(data.userId, data.region);
  await revalidateExtended();
  return result;
}

export async function deleteUserAction(id: string) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgDeleteUser(id);
  await logAuditForSession(session, {
    category: "admin",
    action: "user.delete",
    entityType: "user",
    entityId: id,
    label: "حذف کاربر",
  });
  await revalidateExtended();
  return { success: true };
}

export async function deleteUsersAction(ids: string[]) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  if (ids.length === 0) return { success: true, deleted: 0 };

  const result = await pgExt.pgDeleteUsers(ids);
  await logAuditForSession(session, {
    category: "admin",
    action: "user.delete",
    entityType: "user",
    label: "حذف گروهی کاربران",
    metadata: { count: ids.length, ids },
  });
  await revalidateExtended();
  return result;
}

export async function getSessionContextAction(campaignId?: string) {
  const session = await getAuthSession();
  if (!session) return null;

  if (session.type === "db_user" && session.userId) {
    const user = await pgExt.pgGetUserById(session.userId);
    const permissions =
      session.role === "admin" || !campaignId
        ? null
        : (user?.campaignPermissions[campaignId] ?? defaultContributorPermissions());

    return {
      ...session,
      email: user?.email,
      name: user?.name,
      campaignIds: user?.campaignIds ?? [],
      campaignPermissions: user?.campaignPermissions ?? {},
      permissions,
    };
  }

  return {
    ...session,
    email: process.env.ADMIN_EMAIL ?? "admin",
    name: "مدیر سیستم",
    campaignIds: [] as string[],
    campaignPermissions: {} as Record<string, ContributorPermissions>,
    permissions: null,
  };
}

export { getOwnerFilter, isFullAdmin };
