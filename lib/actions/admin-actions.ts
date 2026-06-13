"use server";

import { revalidatePath } from "next/cache";
import {
  deleteAnalyticsMetric,
  deleteBillboard,
  deleteCampaign,
  deleteMediaCategory,
  deletePoster,
  deletePosterVersion,
  deleteSubmission,
  deleteVideo,
  deleteVideoVersion,
  saveAnalyticsMetric,
  saveBillboard,
  saveCampaign,
  saveMediaCategory,
  savePoster,
  savePosterVersion,
  saveVideo,
  saveVideoVersion,
  updateCampaignSettings,
  updateSubmission,
} from "@/lib/data-access/admin";
import type {
  AnalyticsMetric,
  Billboard,
  CampaignSettings,
  MediaCategory,
  Poster,
  PosterVersion,
  Video,
  VideoVersion,
} from "@/lib/types";

async function revalidateAll(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/billboards");
  revalidatePath("/admin/posters");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin/settings");
  if (slug) revalidatePath(`/campaign/${slug}`);
}

export async function saveCampaignAction(data: Partial<CampaignSettings> & { id?: string }) {
  const result = await saveCampaign(data);
  await revalidateAll(data.slug);
  return result;
}

export async function deleteCampaignAction(id: string) {
  try {
    const result = await deleteCampaign(id);
    await revalidateAll();
    return result;
  } catch (error) {
    console.error("deleteCampaignAction failed:", error);
    return { success: false, error: "حذف کمپین با خطا مواجه شد" };
  }
}

export async function updateSettingsAction(data: Partial<CampaignSettings>) {
  const result = await updateCampaignSettings(data);
  await revalidateAll(data.slug);
  return result;
}

export async function saveBillboardAction(data: Partial<Billboard> & { id?: string }) {
  const result = await saveBillboard(data);
  await revalidateAll();
  return result;
}

export async function deleteBillboardAction(id: string) {
  const result = await deleteBillboard(id);
  await revalidateAll();
  return result;
}

export async function saveCategoryAction(data: Partial<MediaCategory> & { id?: string }) {
  const result = await saveMediaCategory(data);
  await revalidateAll();
  return result;
}

export async function deleteCategoryAction(id: string, type: "poster" | "video") {
  const result = await deleteMediaCategory(id, type);
  await revalidateAll();
  return result;
}

export async function savePosterAction(data: Partial<Poster> & { id?: string }) {
  const result = await savePoster(data);
  await revalidateAll();
  return result;
}

export async function deletePosterAction(id: string) {
  const result = await deletePoster(id);
  await revalidateAll();
  return result;
}

export async function savePosterVersionAction(
  data: Partial<PosterVersion> & { id?: string; posterId: string }
) {
  const result = await savePosterVersion(data);
  await revalidateAll();
  return result;
}

export async function deletePosterVersionAction(id: string) {
  const result = await deletePosterVersion(id);
  await revalidateAll();
  return result;
}

export async function saveVideoAction(data: Partial<Video> & { id?: string }) {
  const result = await saveVideo(data);
  await revalidateAll();
  return result;
}

export async function deleteVideoAction(id: string) {
  const result = await deleteVideo(id);
  await revalidateAll();
  return result;
}

export async function saveVideoVersionAction(
  data: Partial<VideoVersion> & { id?: string; videoId: string }
) {
  const result = await saveVideoVersion(data);
  await revalidateAll();
  return result;
}

export async function deleteVideoVersionAction(id: string) {
  const result = await deleteVideoVersion(id);
  await revalidateAll();
  return result;
}

export async function saveAnalyticsAction(data: Partial<AnalyticsMetric> & { id?: string }) {
  const result = await saveAnalyticsMetric(data);
  await revalidateAll();
  return result;
}

export async function deleteAnalyticsAction(id: string) {
  const result = await deleteAnalyticsMetric(id);
  await revalidateAll();
  return result;
}

export async function updateSubmissionAction(
  id: string,
  data: { status?: "pending" | "approved" | "rejected"; published?: boolean }
) {
  const result = await updateSubmission(id, data);
  await revalidateAll();
  return result;
}

export async function deleteSubmissionAction(id: string) {
  const result = await deleteSubmission(id);
  await revalidateAll();
  return result;
}
