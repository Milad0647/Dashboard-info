"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import {
  defaultContributorPermissions,
  hasContributorPermission,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { hashPassword } from "@/lib/auth/password";
import * as pgExt from "@/lib/db/repository-extended";
import type { MeetingDecisionPayload, MeetingTaskPayload } from "@/lib/db/repository-extended";
import type { BroadcastReport, CampaignMeeting, SocialMediaPost, SocialPlatformStat } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

async function revalidateExtended(slug?: string) {
  revalidatePath("/admin/social-posts");
  revalidatePath("/admin/broadcast");
  revalidatePath("/admin/meetings");
  revalidatePath("/admin/users");
  revalidatePath("/admin/analytics");
  if (slug) revalidatePath(`/campaign/${slug}`);
}

export async function saveSocialPostAction(data: Partial<SocialMediaPost> & { id?: string }) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "socialPosts")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const ownerUserId = isFullAdmin(session) ? (data.ownerUserId ?? null) : session.userId;
  const payload = { ...data, ownerUserId };

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const result = await pgExt.pgSaveSocialPost(payload);
  await revalidateExtended();
  return result;
}

export async function deleteSocialPostAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgDeleteSocialPost(id);
  await revalidateExtended();
  return { success: true };
}

export async function saveSocialPlatformStatAction(data: Partial<SocialPlatformStat> & { id?: string }) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "socialPosts")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const ownerUserId = isFullAdmin(session) ? (data.ownerUserId ?? null) : session.userId;
  const payload = { ...data, ownerUserId };

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const result = await pgExt.pgSaveSocialPlatformStat(payload);
  await revalidateExtended();
  return result;
}

export async function deleteSocialPlatformStatAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgDeleteSocialPlatformStat(id);
  await revalidateExtended();
  return { success: true };
}

export async function saveBroadcastReportAction(data: Partial<BroadcastReport> & { id?: string }) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "broadcast")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const ownerUserId = isFullAdmin(session) ? (data.ownerUserId ?? null) : session.userId;
  const payload = { ...data, ownerUserId };

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const result = await pgExt.pgSaveBroadcastReport(payload);
  await revalidateExtended();
  return result;
}

export async function deleteBroadcastReportAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgDeleteBroadcastReport(id);
  await revalidateExtended();
  return { success: true };
}

export async function saveMeetingAction(
  data: Partial<CampaignMeeting> & { id?: string },
  tasks: MeetingTaskPayload[],
  decisions: MeetingDecisionPayload[] = []
) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!isFullAdmin(session) && data.campaignId) {
    const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId!, data.campaignId);
    if (!hasContributorPermission(permissions, "meetings")) {
      return { success: false, error: "دسترسی ندارید" };
    }
  }

  const ownerUserId = isFullAdmin(session) ? (data.ownerUserId ?? null) : session.userId;
  const payload = { ...data, ownerUserId };

  if (!isPostgresConfigured()) {
    return { success: false, error: "Database required" };
  }

  const result = await pgExt.pgSaveMeetingWithTasks(payload, tasks, decisions);
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

export async function deleteMeetingAction(id: string) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgDeleteMeeting(id);
  await revalidateExtended();
  return { success: true };
}

export async function toggleMeetingTaskAction(taskId: string, completed: boolean) {
  const session = await getAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  await pgExt.pgToggleMeetingTask(taskId, completed);
  await revalidateExtended();
  return { success: true };
}

export async function saveUserAction(data: {
  id?: string;
  email: string;
  name: string;
  role: "admin" | "contributor";
  password?: string;
  province?: string | null;
  city?: string | null;
  campaignIds?: string[];
  campaignPermissions?: Record<string, ContributorPermissions>;
}) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) return { success: false, error: "Database required" };
  const result = await pgExt.pgSaveUser(data);
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
