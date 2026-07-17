import { splitSocialPosts } from "@/lib/social-posts";
import type {
  Billboard,
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  CampaignMeeting,
  Poster,
  PosterVersion,
  RawMediaUpload,
  SocialMediaPost,
  Video,
  VideoVersion,
} from "@/lib/types";

export type EditSuggestionContentType =
  | "poster"
  | "video"
  | "socialPost"
  | "sitePublication"
  | "billboard"
  | "file"
  | "rawMedia"
  | "broadcast"
  | "meeting"
  | "activity";

export type EditSuggestionMissingField =
  | "title"
  | "description"
  | "media"
  | "link"
  | "location"
  | "file"
  | "city"
  | "discussion"
  | "date";

export type CategoryCompletenessStatus = "empty" | "complete" | "partial" | "incomplete";

export interface EditSuggestionItem {
  id: string;
  contentType: EditSuggestionContentType;
  title: string;
  ownerName?: string | null;
  missingFields: EditSuggestionMissingField[];
  editHref: string;
}

export interface CategoryCompletenessSummary {
  contentType: EditSuggestionContentType;
  label: string;
  href: string;
  totalItems: number;
  completeItems: number;
  incompleteItems: number;
  status: CategoryCompletenessStatus;
  errorMessages: string[];
  suggestions: EditSuggestionItem[];
}

interface CheckedField {
  key: EditSuggestionMissingField;
  ok: boolean;
}

const MISSING_FIELD_VALUES = new Set<EditSuggestionMissingField>([
  "title",
  "description",
  "media",
  "link",
  "location",
  "file",
  "city",
  "discussion",
  "date",
]);

const CONTENT_TYPE_PATH: Record<EditSuggestionContentType, string> = {
  poster: "/admin/posters",
  video: "/admin/videos",
  socialPost: "/admin/social-posts",
  sitePublication: "/admin/site-publications",
  billboard: "/admin/billboards",
  file: "/admin/files",
  rawMedia: "/admin/raw-media",
  broadcast: "/admin/broadcast",
  meeting: "/admin/meetings",
  activity: "/admin/activities",
};

export const editSuggestionFieldLabels: Record<EditSuggestionMissingField, string> = {
  title: "عنوان",
  description: "توضیحات",
  media: "رسانه",
  link: "لینک",
  location: "موقعیت",
  file: "فایل",
  city: "شهر",
  discussion: "خلاصه بحث",
  date: "تاریخ",
};

export const editSuggestionContentTypeLabels: Record<EditSuggestionContentType, string> = {
  poster: "پوستر",
  video: "ویدیو",
  socialPost: "شبکه اجتماعی",
  sitePublication: "انتشار در سایت",
  billboard: "تبلیغات محیطی",
  file: "فایل",
  rawMedia: "راش تصویر",
  broadcast: "پخش صدا و سیما",
  meeting: "جلسه",
  activity: "اقدام",
};

const DEFAULT_POSTER_TITLE_PATTERN = /^پوستر\s+\d+$/;
const DEFAULT_VIDEO_TITLE_PATTERN = /^ویدیو\s+\d+$/;
const DEFAULT_FILE_TITLE_PATTERN = /^فایل\s+\d+$/;
const DEFAULT_ACTIVITY_TITLE_PATTERN = /^اقدام\s+\d+$/;
const DEFAULT_MEETING_TITLE_PATTERN = /^جلسه\s+\d+$/;
const DEFAULT_BILLBOARD_TITLE_PATTERN = /^(بیلبورد|تبلیغ)\s+\d+$/;

export function isDefaultPosterTitle(title: string): boolean {
  return DEFAULT_POSTER_TITLE_PATTERN.test(title.trim());
}

export function isDefaultVideoTitle(title: string): boolean {
  return DEFAULT_VIDEO_TITLE_PATTERN.test(title.trim());
}

function isBlank(value?: string | null): boolean {
  return !value?.trim();
}

function isWeakTitle(title: string, defaultPattern?: RegExp): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (defaultPattern?.test(trimmed)) return true;
  return false;
}

function isPlaceholderImage(url?: string | null): boolean {
  const value = url?.trim() ?? "";
  if (!value) return true;
  return value.includes("placeholder") || value === "/images/billboard-placeholder.svg";
}

export function buildEditSuggestionHref(
  contentType: EditSuggestionContentType,
  campaignId: string,
  id: string,
  missingFields: EditSuggestionMissingField[]
): string {
  const params = new URLSearchParams({
    campaign: campaignId,
    edit: id,
  });
  if (missingFields.length > 0) {
    params.set("missing", missingFields.join(","));
  }
  return `${CONTENT_TYPE_PATH[contentType]}?${params.toString()}`;
}

export function parseEditSuggestionMissingFields(
  value: string | null | undefined
): EditSuggestionMissingField[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is EditSuggestionMissingField =>
      MISSING_FIELD_VALUES.has(part as EditSuggestionMissingField)
    );
}

function missingFromChecks(checks: CheckedField[]): EditSuggestionMissingField[] {
  return checks.filter((check) => !check.ok).map((check) => check.key);
}

function groupVersionsByContentId<T>(
  versions: T[],
  getContentId: (version: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const version of versions) {
    const contentId = getContentId(version);
    const list = map.get(contentId) ?? [];
    list.push(version);
    map.set(contentId, list);
  }
  return map;
}

function hasPosterMedia(versions: PosterVersion[]): boolean {
  return versions.some((version) => Boolean(version.imageUrl?.trim()));
}

function hasVideoMedia(versions: VideoVersion[]): boolean {
  return versions.some((version) => Boolean(version.videoUrl?.trim()));
}

function getPosterChecks(poster: Poster, versions: PosterVersion[]): CheckedField[] {
  return [
    { key: "title", ok: !isWeakTitle(poster.title, DEFAULT_POSTER_TITLE_PATTERN) },
    { key: "description", ok: !isBlank(poster.description) },
    { key: "media", ok: hasPosterMedia(versions) },
  ];
}

function getVideoChecks(video: Video, versions: VideoVersion[]): CheckedField[] {
  return [
    { key: "title", ok: !isWeakTitle(video.title, DEFAULT_VIDEO_TITLE_PATTERN) },
    { key: "description", ok: !isBlank(video.description) },
    { key: "media", ok: hasVideoMedia(versions) },
  ];
}

function getSocialChecks(post: SocialMediaPost): CheckedField[] {
  return [
    { key: "title", ok: !isBlank(post.title) },
    { key: "link", ok: !isBlank(post.link) },
    {
      key: "media",
      ok: Boolean(post.coverImageUrl?.trim() || post.mediaUrl?.trim()),
    },
    { key: "description", ok: !isBlank(post.description) },
  ];
}

function getBillboardChecks(billboard: Billboard): CheckedField[] {
  const image = billboard.imageUrl?.trim() || billboard.thumbnailUrl?.trim() || "";
  return [
    { key: "title", ok: !isWeakTitle(billboard.title, DEFAULT_BILLBOARD_TITLE_PATTERN) },
    { key: "city", ok: !isBlank(billboard.city) },
    { key: "location", ok: !isBlank(billboard.location) },
    { key: "media", ok: !isPlaceholderImage(image) },
    { key: "description", ok: !isBlank(billboard.description) },
  ];
}

function getFileChecks(file: CampaignFile): CheckedField[] {
  return [
    { key: "title", ok: !isWeakTitle(file.title, DEFAULT_FILE_TITLE_PATTERN) },
    { key: "file", ok: !isBlank(file.fileUrl) },
    { key: "description", ok: !isBlank(file.description) },
  ];
}

function getRawMediaChecks(item: RawMediaUpload): CheckedField[] {
  return [
    { key: "title", ok: !isBlank(item.title) },
    { key: "file", ok: !isBlank(item.fileUrl) },
    { key: "description", ok: !isBlank(item.description) },
  ];
}

function getBroadcastChecks(report: BroadcastReport): CheckedField[] {
  return [
    { key: "title", ok: !isBlank(report.title) },
    { key: "date", ok: !isBlank(report.reportDate) },
    { key: "file", ok: !isBlank(report.pdfUrl) },
  ];
}

function getMeetingChecks(meeting: CampaignMeeting): CheckedField[] {
  return [
    { key: "title", ok: !isWeakTitle(meeting.title, DEFAULT_MEETING_TITLE_PATTERN) },
    { key: "date", ok: !isBlank(meeting.meetingDate) },
    { key: "location", ok: !isBlank(meeting.location) },
    { key: "media", ok: !isBlank(meeting.imageUrl) },
    { key: "discussion", ok: !isBlank(meeting.discussionSummary) },
  ];
}

function getActivityChecks(activity: CampaignActivity): CheckedField[] {
  const hasMedia =
    Boolean(activity.imageUrl?.trim() || activity.videoUrl?.trim()) ||
    Boolean(activity.mediaItems?.some((item) => item.url.trim()));

  return [
    { key: "title", ok: !isWeakTitle(activity.title, DEFAULT_ACTIVITY_TITLE_PATTERN) },
    { key: "date", ok: !isBlank(activity.activityDate) },
    { key: "location", ok: !isBlank(activity.location) },
    { key: "media", ok: hasMedia },
    { key: "description", ok: !isBlank(activity.description) },
  ];
}

function toSuggestion(
  contentType: EditSuggestionContentType,
  campaignId: string,
  item: { id: string; title: string; ownerName?: string | null },
  checks: CheckedField[]
): EditSuggestionItem | null {
  const missingFields = missingFromChecks(checks);
  if (missingFields.length === 0) return null;
  return {
    id: item.id,
    contentType,
    title: item.title.trim() || editSuggestionContentTypeLabels[contentType],
    ownerName: item.ownerName,
    missingFields,
    editHref: buildEditSuggestionHref(contentType, campaignId, item.id, missingFields),
  };
}

function scopedByOwner<T extends { ownerUserId?: string | null }>(
  items: T[],
  ownerUserId?: string | null
): T[] {
  if (!ownerUserId) return items;
  return items.filter((item) => item.ownerUserId === ownerUserId);
}

function buildErrorMessages(suggestions: EditSuggestionItem[]): string[] {
  const counts = new Map<EditSuggestionMissingField, number>();
  for (const suggestion of suggestions) {
    for (const field of suggestion.missingFields) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => `${count} مورد بدون ${editSuggestionFieldLabels[field]}`);
}

function summarizeCategory(
  contentType: EditSuggestionContentType,
  totalItems: number,
  suggestions: EditSuggestionItem[]
): CategoryCompletenessSummary {
  const incompleteItems = suggestions.length;
  const completeItems = Math.max(totalItems - incompleteItems, 0);
  let status: CategoryCompletenessStatus = "empty";
  if (totalItems === 0) status = "empty";
  else if (incompleteItems === 0) status = "complete";
  else if (completeItems === 0) status = "incomplete";
  else status = "partial";

  return {
    contentType,
    label: editSuggestionContentTypeLabels[contentType],
    href: CONTENT_TYPE_PATH[contentType],
    totalItems,
    completeItems,
    incompleteItems,
    status,
    errorMessages: buildErrorMessages(suggestions),
    suggestions,
  };
}

export interface BuildEditSuggestionsInput {
  campaignId: string;
  /** When set, only that owner's items are evaluated. When omitted, all items are included. */
  ownerUserId?: string | null;
  posters?: Poster[];
  posterVersions?: PosterVersion[];
  videos?: Video[];
  videoVersions?: VideoVersion[];
  socialPosts?: SocialMediaPost[];
  billboards?: Billboard[];
  files?: CampaignFile[];
  rawMedia?: RawMediaUpload[];
  broadcastReports?: BroadcastReport[];
  meetings?: CampaignMeeting[];
  activities?: CampaignActivity[];
}

export function buildEditSuggestions(input: BuildEditSuggestionsInput): EditSuggestionItem[] {
  return buildCategoryCompleteness(input)
    .flatMap((category) => category.suggestions)
    .sort((a, b) => a.contentType.localeCompare(b.contentType) || a.title.localeCompare(b.title, "fa"));
}

export function buildCategoryCompleteness(
  input: BuildEditSuggestionsInput
): CategoryCompletenessSummary[] {
  const {
    campaignId,
    ownerUserId,
    posters = [],
    posterVersions = [],
    videos = [],
    videoVersions = [],
    socialPosts = [],
    billboards = [],
    files = [],
    rawMedia = [],
    broadcastReports = [],
    meetings = [],
    activities = [],
  } = input;

  const posterVersionsByPosterId = groupVersionsByContentId(
    posterVersions,
    (version) => version.posterId
  );
  const videoVersionsByVideoId = groupVersionsByContentId(videoVersions, (version) => version.videoId);
  const ownedPosters = scopedByOwner(posters, ownerUserId);
  const ownedVideos = scopedByOwner(videos, ownerUserId);
  const split = splitSocialPosts(scopedByOwner(socialPosts, ownerUserId));
  const ownedBillboards = scopedByOwner(billboards, ownerUserId);
  const ownedFiles = scopedByOwner(files, ownerUserId);
  const ownedRawMedia = scopedByOwner(rawMedia, ownerUserId);
  const ownedBroadcasts = scopedByOwner(broadcastReports, ownerUserId);
  const ownedMeetings = scopedByOwner(meetings, ownerUserId);
  const ownedActivities = scopedByOwner(activities, ownerUserId);

  const posterSuggestions = ownedPosters
    .map((poster) =>
      toSuggestion(
        "poster",
        campaignId,
        poster,
        getPosterChecks(poster, posterVersionsByPosterId.get(poster.id) ?? [])
      )
    )
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const videoSuggestions = ownedVideos
    .map((video) =>
      toSuggestion(
        "video",
        campaignId,
        video,
        getVideoChecks(video, videoVersionsByVideoId.get(video.id) ?? [])
      )
    )
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const socialSuggestions = split.socialPosts
    .map((post) => toSuggestion("socialPost", campaignId, post, getSocialChecks(post)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const siteSuggestions = split.sitePublications
    .map((post) => toSuggestion("sitePublication", campaignId, post, getSocialChecks(post)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const billboardSuggestions = ownedBillboards
    .map((billboard) =>
      toSuggestion("billboard", campaignId, billboard, getBillboardChecks(billboard))
    )
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const fileSuggestions = ownedFiles
    .map((file) => toSuggestion("file", campaignId, file, getFileChecks(file)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const rawMediaSuggestions = ownedRawMedia
    .map((item) => toSuggestion("rawMedia", campaignId, item, getRawMediaChecks(item)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const broadcastSuggestions = ownedBroadcasts
    .map((report) => toSuggestion("broadcast", campaignId, report, getBroadcastChecks(report)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const meetingSuggestions = ownedMeetings
    .map((meeting) => toSuggestion("meeting", campaignId, meeting, getMeetingChecks(meeting)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  const activitySuggestions = ownedActivities
    .map((activity) => toSuggestion("activity", campaignId, activity, getActivityChecks(activity)))
    .filter((item): item is EditSuggestionItem => Boolean(item));

  return [
    summarizeCategory("billboard", ownedBillboards.length, billboardSuggestions),
    summarizeCategory("poster", ownedPosters.length, posterSuggestions),
    summarizeCategory("video", ownedVideos.length, videoSuggestions),
    summarizeCategory("file", ownedFiles.length, fileSuggestions),
    summarizeCategory("rawMedia", ownedRawMedia.length, rawMediaSuggestions),
    summarizeCategory("sitePublication", split.sitePublications.length, siteSuggestions),
    summarizeCategory("socialPost", split.socialPosts.length, socialSuggestions),
    summarizeCategory("broadcast", ownedBroadcasts.length, broadcastSuggestions),
    summarizeCategory("meeting", ownedMeetings.length, meetingSuggestions),
    summarizeCategory("activity", ownedActivities.length, activitySuggestions),
  ];
}

export function getCompletenessCardClass(status: CategoryCompletenessStatus): string {
  switch (status) {
    case "complete":
      return "border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-card text-emerald-950 dark:text-emerald-50";
    case "partial":
      return "border-amber-500/40 bg-gradient-to-br from-amber-400/30 via-amber-300/10 to-card text-amber-950 dark:text-amber-50";
    case "incomplete":
      return "border-destructive/40 bg-gradient-to-br from-red-500/30 via-red-400/10 to-card text-red-950 dark:text-red-50";
    case "empty":
    default:
      return "border-border bg-gradient-to-br from-muted/70 via-card to-card";
  }
}

export function getCompletenessStatusLabel(status: CategoryCompletenessStatus): string {
  switch (status) {
    case "complete":
      return "کامل";
    case "partial":
      return "ناقص جزئی";
    case "incomplete":
      return "ناقص";
    case "empty":
    default:
      return "بدون مورد";
  }
}
