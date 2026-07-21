"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  assertCanMutateOwnedContent,
  assertCanMutateOwnedContentIfExists,
} from "@/lib/auth/assert-content-ownership";
import { assertTutorialForPossibleCreate } from "@/lib/auth/require-tutorial-completion";
import {
  deleteAnalyticsMetric,
  deleteBillboard,
  deleteCampaign,
  deleteCampaignFile,
  deleteMediaCategory,
  deletePoster,
  deletePosterVersion,
  deleteRawMediaUpload,
  deleteSubmission,
  deleteVideo,
  deleteVideoVersion,
  saveAnalyticsMetric,
  saveBillboard,
  saveCampaign,
  saveCampaignFile,
  saveMediaCategory,
  savePoster,
  savePosterVersion,
  saveRawMediaUpload,
  saveVideo,
  saveVideoVersion,
  updateCampaignSettings,
  updateSubmission,
  resubmitSubmission,
} from "@/lib/data-access/admin";
import type {
  AnalyticsMetric,
  AuthSession,
  Billboard,
  CampaignFile,
  CampaignSettings,
  MediaCategory,
  Poster,
  PosterVersion,
  RawMediaUpload,
  Video,
  VideoVersion,
} from "@/lib/types";
import { resolveSaveOwnerUserId } from "@/lib/admin-content-owner";
import { auditContentChange, auditContentDelete, logAuditFromCurrentSession } from "@/lib/audit/log-event";
import { getContentTitleValidationError } from "@/lib/content-constraints";
import { stripFileAccessTokensDeep } from "@/lib/uploads";

const UNAUTHORIZED = { success: false as const, error: "Unauthorized" };

function validateTitlePayload(data: { title?: unknown }) {
  const error = getContentTitleValidationError(data.title);
  return error ? { success: false as const, error } : null;
}

async function requireSession(): Promise<
  AuthSession | { success: false; error: string }
> {
  const session = await getAuthSession();
  if (!session) return UNAUTHORIZED;
  return session;
}

async function requireFullAdmin(): Promise<
  AuthSession | { success: false; error: string }
> {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return UNAUTHORIZED;
  return session;
}

function isAuthError(
  value: AuthSession | { success: false; error: string }
): value is { success: false; error: string } {
  return "success" in value && value.success === false;
}

async function revalidateAll(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/billboards");
  revalidatePath("/admin/posters");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/social-posts");
  revalidatePath("/admin/social-analytics");
  revalidatePath("/admin/broadcast");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/files");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
  revalidatePath("/campaign");
  if (slug) revalidatePath(`/campaign/${slug}`);
}

async function withOwnerScope<T extends { id?: string; ownerUserId?: string | null; published?: boolean }>(
  session: AuthSession,
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
      // Contributor uploads must be public on the campaign page.
      published: true,
    };
  }

  return {
    ...cleaned,
    ownerUserId,
  };
}

async function assertContributorOwnsBillboard(
  session: AuthSession,
  billboardId: string
): Promise<{ success: false; error: string } | null> {
  return assertCanMutateOwnedContent(session, "billboards", billboardId);
}

async function assertContributorOwnsBillboardIfExists(
  session: AuthSession,
  billboardId: string
): Promise<{ success: false; error: string } | null> {
  return assertCanMutateOwnedContentIfExists(session, "billboards", billboardId);
}

export async function saveCampaignAction(data: Partial<CampaignSettings> & { id?: string }) {
  const auth = await requireFullAdmin();
  if (isAuthError(auth)) return auth;
  const cleaned = stripFileAccessTokensDeep(data);
  const validationError = validateTitlePayload(cleaned);
  if (validationError) return validationError;
  const result = await saveCampaign(cleaned);
  await auditContentChange({
    isUpdate: Boolean(cleaned.id),
    entityType: "campaign",
    entityId: cleaned.id,
    label: cleaned.title,
  });
  await revalidateAll(cleaned.slug);
  return result;
}

export async function deleteCampaignAction(id: string) {
  const auth = await requireFullAdmin();
  if (isAuthError(auth)) return auth;
  try {
    const result = await deleteCampaign(id);
    await auditContentDelete({ entityType: "campaign", entityId: id });
    await revalidateAll();
    return result;
  } catch (error) {
    console.error("deleteCampaignAction failed:", error);
    return { success: false, error: "حذف کمپین با خطا مواجه شد" };
  }
}

export async function updateSettingsAction(data: Partial<CampaignSettings>) {
  const auth = await requireFullAdmin();
  if (isAuthError(auth)) return auth;
  const cleaned = stripFileAccessTokensDeep(data);
  const validationError = validateTitlePayload(cleaned);
  if (validationError) return validationError;
  const result = await updateCampaignSettings(cleaned);
  await logAuditFromCurrentSession({
    category: "admin",
    action: "admin.settings_update",
    entityType: "campaign",
    entityId: cleaned.id,
    label: cleaned.title ?? "به‌روزرسانی تنظیمات کمپین",
  });
  await revalidateAll(cleaned.slug);
  return result;
}

export async function saveBillboardAction(data: Partial<Billboard> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertContributorOwnsBillboardIfExists(auth, data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "billboards",
    "billboards",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveBillboard(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "billboard",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteBillboardAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertContributorOwnsBillboard(auth, id);
  if (denied) return denied;
  const result = await deleteBillboard(id);
  await auditContentDelete({ entityType: "billboard", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveCategoryAction(data: Partial<MediaCategory> & { id?: string }) {
  const auth = await requireFullAdmin();
  if (isAuthError(auth)) return auth;
  const cleaned = stripFileAccessTokensDeep(data);
  const validationError = validateTitlePayload(cleaned);
  if (validationError) return validationError;
  const result = await saveMediaCategory(cleaned);
  await auditContentChange({
    isUpdate: Boolean(cleaned.id),
    entityType: "media_category",
    entityId: cleaned.id,
    campaignId: cleaned.campaignId,
    label: cleaned.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteCategoryAction(id: string, type: "poster" | "video") {
  const auth = await requireFullAdmin();
  if (isAuthError(auth)) return auth;
  const result = await deleteMediaCategory(id, type);
  await auditContentDelete({
    entityType: "media_category",
    entityId: id,
    metadata: { type },
  });
  await revalidateAll();
  return result;
}

export async function savePosterAction(data: Partial<Poster> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(auth, "posters", data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate("posters", "posters", data.id);
  if (tutorialDenied) return tutorialDenied;
  const result = await savePoster(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "poster",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deletePosterAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "posters", id);
  if (denied) return denied;
  const result = await deletePoster(id);
  await auditContentDelete({ entityType: "poster", entityId: id });
  await revalidateAll();
  return result;
}

export async function savePosterVersionAction(
  data: Partial<PosterVersion> & { id?: string; posterId: string }
) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const cleaned = stripFileAccessTokensDeep(data);
  if (cleaned.id) {
    const denied = await assertCanMutateOwnedContent(auth, "poster_versions", cleaned.id);
    if (denied) return denied;
  } else {
    const denied = await assertCanMutateOwnedContent(auth, "posters", cleaned.posterId);
    if (denied) return denied;
  }
  const result = await savePosterVersion(cleaned);
  await auditContentChange({
    isUpdate: Boolean(cleaned.id),
    entityType: "poster_version",
    entityId: cleaned.id,
    label: cleaned.notes ?? `نسخه پوستر ${cleaned.posterId}`,
    metadata: { posterId: cleaned.posterId },
  });
  await revalidateAll();
  return result;
}

export async function deletePosterVersionAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "poster_versions", id);
  if (denied) return denied;
  const result = await deletePosterVersion(id);
  await auditContentDelete({ entityType: "poster_version", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveVideoAction(data: Partial<Video> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(auth, "videos", data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate("videos", "videos", data.id);
  if (tutorialDenied) return tutorialDenied;
  const result = await saveVideo(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "video",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteVideoAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "videos", id);
  if (denied) return denied;
  const result = await deleteVideo(id);
  await auditContentDelete({ entityType: "video", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveVideoVersionAction(
  data: Partial<VideoVersion> & { id?: string; videoId: string }
) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const cleaned = stripFileAccessTokensDeep(data);
  if (cleaned.id) {
    const denied = await assertCanMutateOwnedContent(auth, "video_versions", cleaned.id);
    if (denied) return denied;
  } else {
    const denied = await assertCanMutateOwnedContent(auth, "videos", cleaned.videoId);
    if (denied) return denied;
  }
  const result = await saveVideoVersion(cleaned);
  await auditContentChange({
    isUpdate: Boolean(cleaned.id),
    entityType: "video_version",
    entityId: cleaned.id,
    label: cleaned.notes ?? `نسخه ویدیو ${cleaned.videoId}`,
    metadata: { videoId: cleaned.videoId },
  });
  await revalidateAll();
  return result;
}

export async function deleteVideoVersionAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "video_versions", id);
  if (denied) return denied;
  const result = await deleteVideoVersion(id);
  await auditContentDelete({ entityType: "video_version", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveAnalyticsAction(data: Partial<AnalyticsMetric> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(auth, "analytics_metrics", data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "analytics",
    "analytics_metrics",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveAnalyticsMetric(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "analytics_metric",
    entityId: data.id,
    campaignId: data.campaignId,
    label: "آمار سایت",
  });
  await revalidateAll();
  return result;
}

export async function deleteAnalyticsAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "analytics_metrics", id);
  if (denied) return denied;
  const result = await deleteAnalyticsMetric(id);
  await auditContentDelete({ entityType: "analytics_metric", entityId: id });
  await revalidateAll();
  return result;
}

export async function updateSubmissionAction(
  id: string,
  data: {
    status?: "pending" | "approved" | "rejected";
    published?: boolean;
    rejectionReason?: string | null;
  }
) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "campaign_submissions", id);
  if (denied) return denied;

  if (data.status === "rejected") {
    const reason = data.rejectionReason?.trim() ?? "";
    if (!reason) {
      return { success: false as const, error: "دلیل رد الزامی است" };
    }
    data = { ...data, rejectionReason: reason, published: false };
  }

  if (data.status === "approved") {
    data = { ...data, rejectionReason: null, published: data.published ?? true };
  }

  const result = await updateSubmission(id, data);
  await logAuditFromCurrentSession({
    category: "content",
    action: "content.update",
    entityType: "submission",
    entityId: id,
    label: "به‌روزرسانی مشارکت",
    metadata: { ...data },
  });
  await revalidateAll();
  return result;
}

export async function resubmitSubmissionAction(
  id: string,
  data: { title: string; text: string; mediaUrl?: string | null }
) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "campaign_submissions", id);
  if (denied) return denied;

  const titleError = getContentTitleValidationError(data.title);
  if (titleError) return { success: false as const, error: titleError };

  const result = await resubmitSubmission(id, {
    title: data.title.trim(),
    text: data.text.trim(),
    mediaUrl: data.mediaUrl?.trim() || null,
  });
  if (!result.success) return result;

  await logAuditFromCurrentSession({
    category: "content",
    action: "content.update",
    entityType: "submission",
    entityId: id,
    label: "ارسال مجدد مشارکت برای بررسی",
    metadata: { status: "pending" },
  });
  await revalidateAll();
  return result;
}

export async function deleteSubmissionAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "campaign_submissions", id);
  if (denied) return denied;
  const result = await deleteSubmission(id);
  await auditContentDelete({ entityType: "submission", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveCampaignFileAction(data: Partial<CampaignFile> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(auth, "campaign_files", data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "files",
    "campaign_files",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveCampaignFile(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "file",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteCampaignFileAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "campaign_files", id);
  if (denied) return denied;
  const result = await deleteCampaignFile(id);
  await auditContentDelete({ entityType: "file", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveRawMediaUploadAction(data: Partial<RawMediaUpload> & { id?: string }) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertCanMutateOwnedContentIfExists(auth, "raw_media_uploads", data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "rawMedia",
    "raw_media_uploads",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveRawMediaUpload(await withOwnerScope(auth, data));
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "raw_media",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteRawMediaUploadAction(id: string) {
  const auth = await requireSession();
  if (isAuthError(auth)) return auth;
  const denied = await assertCanMutateOwnedContent(auth, "raw_media_uploads", id);
  if (denied) return denied;
  const result = await deleteRawMediaUpload(id);
  await auditContentDelete({ entityType: "raw_media", entityId: id });
  await revalidateAll();
  return result;
}
