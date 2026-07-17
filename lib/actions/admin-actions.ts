"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { assertTutorialForPossibleCreate } from "@/lib/auth/require-tutorial-completion";
import * as pg from "@/lib/db/repository";
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
} from "@/lib/data-access/admin";
import type {
  AnalyticsMetric,
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
import { isPostgresConfigured } from "@/lib/utils";
import { resolveSaveOwnerUserId } from "@/lib/admin-content-owner";
import { auditContentChange, auditContentDelete, logAuditFromCurrentSession } from "@/lib/audit/log-event";
import { getContentTitleValidationError } from "@/lib/content-constraints";

function validateTitlePayload(data: { title?: unknown }) {
  const error = getContentTitleValidationError(data.title);
  return error ? { success: false as const, error } : null;
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
  data: T
): Promise<T> {
  const session = await getAuthSession();
  if (!session) return data;

  const ownerUserId = await resolveSaveOwnerUserId({
    session,
    explicitOwnerUserId: data.ownerUserId,
    contentId: data.id,
  });

  if (!isFullAdmin(session)) {
    return {
      ...data,
      ownerUserId,
      // Contributor uploads must be public on the campaign page.
      published: true,
    };
  }

  return {
    ...data,
    ownerUserId,
  };
}

async function assertContributorOwnsBillboard(
  billboardId: string
): Promise<{ success: false; error: string } | null> {
  const session = await getAuthSession();
  if (!session || isFullAdmin(session)) return null;
  if (!isPostgresConfigured()) return null;

  const billboard = await pg.pgGetBillboardById(billboardId);
  if (!billboard) return { success: false, error: "بیلبورد یافت نشد" };
  if (billboard.ownerUserId !== session.userId) {
    return { success: false, error: "دسترسی ندارید" };
  }
  return null;
}

export async function saveCampaignAction(data: Partial<CampaignSettings> & { id?: string }) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const result = await saveCampaign(data);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "campaign",
    entityId: data.id,
    label: data.title,
  });
  await revalidateAll(data.slug);
  return result;
}

export async function deleteCampaignAction(id: string) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
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
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const result = await updateCampaignSettings(data);
  await logAuditFromCurrentSession({
    category: "admin",
    action: "admin.settings_update",
    entityType: "campaign",
    entityId: data.id,
    label: data.title ?? "به‌روزرسانی تنظیمات کمپین",
  });
  await revalidateAll(data.slug);
  return result;
}

export async function saveBillboardAction(data: Partial<Billboard> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  if (data.id) {
    const denied = await assertContributorOwnsBillboard(data.id);
    if (denied) return denied;
  }
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "billboards",
    "billboards",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveBillboard(await withOwnerScope(data));
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
  const denied = await assertContributorOwnsBillboard(id);
  if (denied) return denied;
  const result = await deleteBillboard(id);
  await auditContentDelete({ entityType: "billboard", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveCategoryAction(data: Partial<MediaCategory> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const result = await saveMediaCategory(data);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "media_category",
    entityId: data.id,
    campaignId: data.campaignId,
    label: data.title,
  });
  await revalidateAll();
  return result;
}

export async function deleteCategoryAction(id: string, type: "poster" | "video") {
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
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const tutorialDenied = await assertTutorialForPossibleCreate("posters", "posters", data.id);
  if (tutorialDenied) return tutorialDenied;
  const result = await savePoster(await withOwnerScope(data));
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
  const result = await deletePoster(id);
  await auditContentDelete({ entityType: "poster", entityId: id });
  await revalidateAll();
  return result;
}

export async function savePosterVersionAction(
  data: Partial<PosterVersion> & { id?: string; posterId: string }
) {
  const result = await savePosterVersion(data);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "poster_version",
    entityId: data.id,
    label: data.notes ?? `نسخه پوستر ${data.posterId}`,
    metadata: { posterId: data.posterId },
  });
  await revalidateAll();
  return result;
}

export async function deletePosterVersionAction(id: string) {
  const result = await deletePosterVersion(id);
  await auditContentDelete({ entityType: "poster_version", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveVideoAction(data: Partial<Video> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const tutorialDenied = await assertTutorialForPossibleCreate("videos", "videos", data.id);
  if (tutorialDenied) return tutorialDenied;
  const result = await saveVideo(await withOwnerScope(data));
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
  const result = await deleteVideo(id);
  await auditContentDelete({ entityType: "video", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveVideoVersionAction(
  data: Partial<VideoVersion> & { id?: string; videoId: string }
) {
  const result = await saveVideoVersion(data);
  await auditContentChange({
    isUpdate: Boolean(data.id),
    entityType: "video_version",
    entityId: data.id,
    label: data.notes ?? `نسخه ویدیو ${data.videoId}`,
    metadata: { videoId: data.videoId },
  });
  await revalidateAll();
  return result;
}

export async function deleteVideoVersionAction(id: string) {
  const result = await deleteVideoVersion(id);
  await auditContentDelete({ entityType: "video_version", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveAnalyticsAction(data: Partial<AnalyticsMetric> & { id?: string }) {
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "analytics",
    "analytics_metrics",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveAnalyticsMetric(await withOwnerScope(data));
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
  const result = await deleteAnalyticsMetric(id);
  await auditContentDelete({ entityType: "analytics_metric", entityId: id });
  await revalidateAll();
  return result;
}

export async function updateSubmissionAction(
  id: string,
  data: { status?: "pending" | "approved" | "rejected"; published?: boolean }
) {
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

export async function deleteSubmissionAction(id: string) {
  const result = await deleteSubmission(id);
  await auditContentDelete({ entityType: "submission", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveCampaignFileAction(data: Partial<CampaignFile> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "files",
    "campaign_files",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveCampaignFile(await withOwnerScope(data));
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
  const result = await deleteCampaignFile(id);
  await auditContentDelete({ entityType: "file", entityId: id });
  await revalidateAll();
  return result;
}

export async function saveRawMediaUploadAction(data: Partial<RawMediaUpload> & { id?: string }) {
  const validationError = validateTitlePayload(data);
  if (validationError) return validationError;
  const tutorialDenied = await assertTutorialForPossibleCreate(
    "rawMedia",
    "raw_media_uploads",
    data.id
  );
  if (tutorialDenied) return tutorialDenied;
  const result = await saveRawMediaUpload(await withOwnerScope(data));
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
  const result = await deleteRawMediaUpload(id);
  await auditContentDelete({ entityType: "raw_media", entityId: id });
  await revalidateAll();
  return result;
}
