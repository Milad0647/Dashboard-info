"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { canManageDirectives } from "@/lib/auth/access";
import * as pgExt from "@/lib/db/repository-extended";
import * as pgDirectives from "@/lib/db/repository-directives";
import { getContentTitleValidationError } from "@/lib/content-constraints";
import {
  buildDirectiveSmsText,
  sendSms,
} from "@/lib/sms/provider";
import { pgGetSmsProviderSettings } from "@/lib/db/system-settings";
import type {
  CampaignDirective,
  DirectiveActionType,
  DirectiveAudienceType,
  DirectivePriority,
  DirectiveRecipient,
  DirectiveSystemAction,
} from "@/lib/types";
import type { UserRegion } from "@/lib/user-regions";
import { isPostgresConfigured } from "@/lib/utils";
import { stripFileAccessTokensDeep } from "@/lib/uploads";
import {
  isDirectiveSystemAction,
  normalizeDirectiveActionUrl,
} from "@/lib/directive-cta";

async function assertDirectivesAccess(campaignId: string) {
  const session = await getAuthSession();
  if (!session) return { session: null, error: "Unauthorized" as const };

  if (isFullAdmin(session)) {
    return { session, error: null };
  }

  if (!session.userId || !isPostgresConfigured()) {
    return { session: null, error: "Unauthorized" as const };
  }

  // Any campaign membership is enough to view/confirm directives.
  const permissions = await pgExt.pgGetUserPermissionsForCampaign(session.userId, campaignId);
  if (!permissions) {
    return { session: null, error: "دسترسی ندارید" as const };
  }

  return { session, error: null };
}

function revalidateDirectives(campaignId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/directives");
  if (campaignId) {
    revalidatePath(`/admin?campaign=${campaignId}`);
    revalidatePath(`/admin/directives?campaign=${campaignId}`);
  }
}

export async function listDirectivesAction(campaignId: string): Promise<{
  success: boolean;
  canManage: boolean;
  directives: CampaignDirective[];
  error?: string;
}> {
  const access = await assertDirectivesAccess(campaignId);
  if (access.error || !access.session) {
    return { success: false, canManage: false, directives: [], error: access.error ?? "Unauthorized" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, canManage: false, directives: [], error: "Database required" };
  }

  const canManage = canManageDirectives(access.session);

  if (canManage) {
    const directives = await pgDirectives.pgListDirectivesForCampaign(campaignId);
    return { success: true, canManage: true, directives };
  }

  if (!access.session.userId) {
    return { success: true, canManage: false, directives: [] };
  }

  const directives = await pgDirectives.pgListDirectivesForUserInbox(
    campaignId,
    access.session.userId
  );
  return { success: true, canManage: false, directives };
}

export async function listCampaignDirectiveUsersAction(campaignId: string) {
  const access = await assertDirectivesAccess(campaignId);
  if (access.error || !access.session) {
    return { success: false as const, users: [], error: access.error ?? "Unauthorized" };
  }
  if (!canManageDirectives(access.session)) {
    return { success: false as const, users: [], error: "دسترسی ندارید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, users: [], error: "Database required" };
  }

  const users = await pgDirectives.pgListCampaignUsersForDirectives(campaignId);
  return { success: true as const, users };
}

export async function getDirectiveRecipientsAction(directiveId: string): Promise<{
  success: boolean;
  recipients: DirectiveRecipient[];
  error?: string;
}> {
  const session = await getAuthSession();
  if (!session || !canManageDirectives(session)) {
    return { success: false, recipients: [], error: "Unauthorized" };
  }
  if (!isPostgresConfigured()) {
    return { success: false, recipients: [], error: "Database required" };
  }

  const directive = await pgDirectives.pgGetDirectiveById(directiveId);
  if (!directive) {
    return { success: false, recipients: [], error: "یافت نشد" };
  }

  const access = await assertDirectivesAccess(directive.campaignId);
  if (access.error) {
    return { success: false, recipients: [], error: access.error };
  }

  const recipients = await pgDirectives.pgListDirectiveRecipients(directiveId);
  return { success: true, recipients };
}

export async function saveDirectiveAction(input: {
  id?: string;
  campaignId: string;
  title: string;
  body: string;
  priority: DirectivePriority;
  startDate?: string | null;
  endDate?: string | null;
  letterFileUrl?: string | null;
  letterFileName?: string | null;
  letterMimeType?: string | null;
  letterFileSize?: number;
  audienceType: DirectiveAudienceType;
  audienceRegion?: UserRegion | null;
  actionType?: DirectiveActionType;
  actionLabel?: string | null;
  actionUrl?: string | null;
  systemAction?: DirectiveSystemAction | null;
  selectedUserIds?: string[];
  attachments?: Array<{
    id?: string;
    title: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
  sendSmsOnPublish?: boolean;
}) {
  const titleError = getContentTitleValidationError(input.title);
  if (titleError) return { success: false as const, error: titleError };

  if (!input.startDate?.trim()) {
    return { success: false as const, error: "تاریخ شروع الزامی است" };
  }
  if (!input.endDate?.trim()) {
    return { success: false as const, error: "تاریخ پایان الزامی است" };
  }
  if (input.startDate.trim() > input.endDate.trim()) {
    return { success: false as const, error: "تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد" };
  }

  if (!input.letterFileUrl?.trim()) {
    return { success: false as const, error: "آپلود نامه رسمی (PDF یا تصویر) الزامی است" };
  }

  for (const attachment of input.attachments ?? []) {
    const attachmentTitleError = getContentTitleValidationError(attachment.title);
    if (attachmentTitleError) {
      return {
        success: false as const,
        error: `عنوان پیوست: ${attachmentTitleError}`,
      };
    }
    if (!attachment.fileUrl?.trim()) {
      return { success: false as const, error: "برای هر پیوست باید فایل آپلود شود" };
    }
  }

  const actionType: DirectiveActionType = input.actionType ?? "none";
  let actionLabel: string | null = input.actionLabel?.trim() || null;
  let actionUrl: string | null = null;
  let systemAction: DirectiveSystemAction | null = null;

  if (actionType === "custom_url") {
    const normalized = normalizeDirectiveActionUrl(input.actionUrl ?? "");
    if (!normalized) {
      return { success: false as const, error: "لینک دکمه اقدام معتبر نیست" };
    }
    actionUrl = normalized;
    if (!actionLabel) actionLabel = "مشاهده لینک";
  } else if (actionType === "system") {
    if (!isDirectiveSystemAction(input.systemAction)) {
      return { success: false as const, error: "مقصد سیستمی را انتخاب کنید" };
    }
    systemAction = input.systemAction;
  } else {
    actionLabel = null;
  }

  const access = await assertDirectivesAccess(input.campaignId);
  if (access.error || !access.session) {
    return { success: false as const, error: access.error ?? "Unauthorized" };
  }
  if (!canManageDirectives(access.session)) {
    return { success: false as const, error: "فقط مدیر و کارفرما می‌توانند دستورکار ثبت کنند" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  if (input.audienceType === "region" && !input.audienceRegion) {
    return { success: false as const, error: "منطقه مخاطب را انتخاب کنید" };
  }
  if (input.audienceType === "users" && !(input.selectedUserIds?.length)) {
    return { success: false as const, error: "حداقل یک کاربر را انتخاب کنید" };
  }

  const cleaned = stripFileAccessTokensDeep({
    ...input,
    body: input.body?.trim() ?? "",
    attachments: input.attachments ?? [],
    actionType,
    actionLabel,
    actionUrl,
    systemAction,
  });

  const isUpdate = Boolean(cleaned.id);
  const previous = cleaned.id ? await pgDirectives.pgGetDirectiveById(cleaned.id) : null;
  const wasAlreadyPublished = Boolean(previous?.publishedAt);

  const result = await pgDirectives.pgSaveDirective({
    id: cleaned.id,
    campaignId: cleaned.campaignId,
    createdByUserId: access.session.userId,
    title: cleaned.title.trim(),
    body: cleaned.body,
    priority: cleaned.priority,
    startDate: cleaned.startDate,
    endDate: cleaned.endDate,
    letterFileUrl: cleaned.letterFileUrl,
    letterFileName: cleaned.letterFileName,
    letterMimeType: cleaned.letterMimeType,
    letterFileSize: cleaned.letterFileSize,
    audienceType: cleaned.audienceType,
    audienceRegion: cleaned.audienceRegion,
    actionType: cleaned.actionType,
    actionLabel: cleaned.actionLabel,
    actionUrl: cleaned.actionUrl,
    systemAction: cleaned.systemAction,
    published: true,
    attachments: cleaned.attachments,
    selectedUserIds: cleaned.selectedUserIds,
  });

  const shouldSendSms =
    (cleaned.sendSmsOnPublish ?? true) && (!isUpdate || !wasAlreadyPublished);

  if (shouldSendSms) {
    await dispatchDirectiveSms(result.id, cleaned.title.trim(), cleaned.campaignId);
  }

  revalidateDirectives(cleaned.campaignId);
  return { success: true as const, id: result.id };
}

async function dispatchDirectiveSms(
  directiveId: string,
  title: string,
  campaignId: string
) {
  const pending = await pgDirectives.pgGetPendingSmsRecipients(directiveId);
  const smsSettings = await pgGetSmsProviderSettings();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const path = `/admin/directives?campaign=${encodeURIComponent(campaignId)}`;
  const link = baseUrl ? `${baseUrl}${path}` : path;
  const message = buildDirectiveSmsText(title, link);

  for (const recipient of pending) {
    const smsResult = await sendSms(recipient.phone, message, smsSettings);

    if (!recipient.phone) {
      await pgDirectives.pgUpdateRecipientSmsStatus({
        directiveId,
        userId: recipient.userId,
        smsStatus: "no_phone",
        smsError: "شماره موبایل ثبت نشده",
      });
      continue;
    }

    if (smsResult.ok) {
      await pgDirectives.pgUpdateRecipientSmsStatus({
        directiveId,
        userId: recipient.userId,
        smsStatus: "sent",
      });
      continue;
    }

    await pgDirectives.pgUpdateRecipientSmsStatus({
      directiveId,
      userId: recipient.userId,
      smsStatus: smsResult.skipped ? "skipped" : "failed",
      smsError: smsResult.error,
    });
  }
}

export async function deleteDirectiveAction(id: string, campaignId: string) {
  const access = await assertDirectivesAccess(campaignId);
  if (access.error || !access.session) {
    return { success: false as const, error: access.error ?? "Unauthorized" };
  }
  if (!canManageDirectives(access.session)) {
    return { success: false as const, error: "دسترسی ندارید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  await pgDirectives.pgDeleteDirective(id);
  revalidateDirectives(campaignId);
  return { success: true as const };
}

export async function confirmDirectiveSeenAction(directiveId: string, campaignId: string) {
  const access = await assertDirectivesAccess(campaignId);
  if (access.error || !access.session) {
    return { success: false as const, error: access.error ?? "Unauthorized" };
  }
  if (!access.session.userId) {
    return { success: false as const, error: "برای تأیید مشاهده باید با حساب کاربری وارد شوید" };
  }
  if (!isPostgresConfigured()) {
    return { success: false as const, error: "Database required" };
  }

  const ok = await pgDirectives.pgConfirmDirectiveSeen(directiveId, access.session.userId);
  if (!ok) {
    return { success: false as const, error: "این دستورکار برای شما ثبت نشده است" };
  }

  revalidateDirectives(campaignId);
  return { success: true as const };
}
