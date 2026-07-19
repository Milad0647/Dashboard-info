export type CampaignStatus = "live" | "completed" | "draft";
export type ItemStatus = "draft" | "published" | "final" | "revised" | "pending" | "approved" | "rejected" | "completed";
export type MediaCategoryType = "poster" | "video";
export type VersionStatus = "draft" | "revised" | "final";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type TrafficSource = "instagram" | "telegram" | "direct" | "google" | "referral" | "other";
export type DeviceType = "mobile" | "desktop" | "tablet";
export type AdminRole = "admin" | "contributor" | "client";
export type SocialPlatform = "instagram" | "x" | "telegram" | "linkedin" | "youtube" | "aparat" | "rubika" | "eitaa" | "soroush" | "bale" | "other";
export type SocialPostPlatform = SocialPlatform | "site";
export type ActivityType =
  | "magazine"
  | "newspaper"
  | "tract"
  | "booth"
  | "field"
  | "poetry"
  | "painting"
  | "exhibition"
  | "other";
export type SocialContentType = "image" | "text" | "video" | "carousel" | "story" | "reel" | "audio";
export type SessionRole = "admin" | "contributor" | "client";

export interface CampaignFeatures {
  billboards: boolean;
  posters: boolean;
  videos: boolean;
  analytics: boolean;
  socialAnalytics: boolean;
  socialPosts: boolean;
  sitePublications: boolean;
  broadcastReports: boolean;
  meetings: boolean;
  activities: boolean;
  pressPublications: boolean;
  submissions: boolean;
  files: boolean;
  rawMedia: boolean;
}

export type AnalyticsSource = "manual" | "metabase" | "hybrid";
export type AnalyticsChannel = "site" | "social";
export type BillboardSource = "manual" | "api";

export interface MetabaseConfig {
  url: string;
  username: string;
  password: string;
  questionId?: number;
  dashboardId?: number;
  embedSecret?: string;
}

export interface ChannelAnalyticsConfig {
  source: AnalyticsSource;
  metabase?: MetabaseConfig | null;
}

export interface AnalyticsConfig {
  site: ChannelAnalyticsConfig;
  social: ChannelAnalyticsConfig;
}

export interface BillboardConfig {
  externalCampaignId?: string | null;
  externalCampaignSlug?: string | null;
}

export interface MapBilboardApiSettings {
  baseUrl?: string | null;
  email?: string | null;
  password?: string | null;
  token?: string | null;
}

export interface MapBilboardApiSettingsPublic {
  baseUrl: string;
  email: string;
  hasPassword: boolean;
  hasToken: boolean;
  configured: boolean;
}

export type SmsProviderId = "none" | "kavenegar" | "melipayamak" | "custom";

export interface SmsProviderSettings {
  enabled: boolean;
  provider: SmsProviderId;
  apiKey?: string | null;
  sender?: string | null;
}

export interface SmsProviderSettingsPublic {
  enabled: boolean;
  provider: SmsProviderId;
  sender: string;
  hasApiKey: boolean;
  configured: boolean;
}

export interface CampaignSettings {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  coverImageUrl?: string | null;
  published: boolean;
  features: CampaignFeatures;
  analyticsConfig: AnalyticsConfig;
  billboardConfig: BillboardConfig;
  /** Campaign content plan names configured by admin (e.g. مهتاب، سامان). Legacy flat list. */
  contentPlans?: string[];
  /** Hierarchical topics with optional subtopics (موضوع / زیرموضوع). */
  contentTopics?: import("./content-topics").ContentTopic[];
  /** Public label for admin-owned content groups (no contributor user). */
  adminOwnerLabel?: string | null;
  meetingsViewPasswordHash?: string | null;
  /** Public campaign page password (bcrypt hash). Never expose to clients. */
  pageViewPasswordHash?: string | null;
  updatedAt: string;
}

export interface CampaignListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  coverImageUrl?: string | null;
}

export interface Ownable {
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerProvince?: string | null;
  ownerCity?: string | null;
  /** Legacy single topic — prefer planLabels. */
  planLabel?: string | null;
  /** Multiple topic/subtopic tokens (e.g. "مهتاب" or "مهتاب|هفته اول"). */
  planLabels?: string[];
  /** Numeric score set by admin/client. */
  score?: number | null;
}

export type ScoreableContentType =
  | "billboard"
  | "poster"
  | "video"
  | "file"
  | "raw_media"
  | "social_post"
  | "site_publication"
  | "activity"
  | "broadcast"
  | "meeting";

export interface BillboardDisplayPeriod {
  id: string;
  billboardId: string;
  title?: string | null;
  startDate: string;
  endDate: string;
  billboardImageUrl: string;
  confirmationImageUrl?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Billboard extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  description?: string | null;
  province?: string | null;
  city: string;
  location: string;
  date: string;
  thumbnailUrl: string;
  imageUrl?: string | null;
  externalUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  source?: BillboardSource;
  externalId?: string | null;
  category?: string | null;
  areaSqm?: number | null;
  status: ItemStatus;
  tags: string[];
  notes?: string | null;
  published: boolean;
  sortOrder: number;
  displayPeriods?: BillboardDisplayPeriod[];
  code?: string | null;
  displayDateRange?: string | null;
  providerName?: string | null;
  qualityTierLabel?: string | null;
  billboardTypeLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaCategory {
  id: string;
  campaignId: string;
  type: MediaCategoryType;
  title: string;
  description?: string | null;
  sortOrder: number;
  published: boolean;
  createdAt: string;
}

export interface Poster extends Ownable {
  id: string;
  campaignId: string;
  categoryId: string;
  title: string;
  description?: string | null;
  published: boolean;
  sortOrder: number;
  planLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PosterVersion {
  id: string;
  posterId: string;
  versionNumber: number;
  imageUrl: string;
  thumbnailUrl: string;
  notes?: string | null;
  status: VersionStatus;
  isFinal: boolean;
  date: string;
  createdAt: string;
}

export interface Video extends Ownable {
  id: string;
  campaignId: string;
  categoryId: string;
  title: string;
  description?: string | null;
  published: boolean;
  sortOrder: number;
  planLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoVersion {
  id: string;
  videoId: string;
  versionNumber: number;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  notes?: string | null;
  status: VersionStatus;
  isFinal: boolean;
  date: string;
  createdAt: string;
}

export interface AnalyticsMetric extends Ownable {
  id: string;
  campaignId: string;
  channel: AnalyticsChannel;
  date: string;
  visitors: number;
  uniqueVisitors: number;
  pageViews: number;
  avgSessionDuration: number;
  source?: TrafficSource | null;
  device?: DeviceType | null;
  page?: string | null;
  city?: string | null;
  createdAt: string;
}

export interface CampaignSubmission extends Ownable {
  id: string;
  campaignId: string;
  externalUuid?: string | null;
  submissionType: string;
  participantName: string;
  participantPhone?: string | null;
  participantEmail?: string | null;
  title: string;
  text: string;
  mediaUrl?: string | null;
  status: SubmissionStatus;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignFile extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  published: boolean;
  sortOrder: number;
  planLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RawMediaKind = "image" | "video";

export interface RawMediaUpload extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  description?: string | null;
  mediaKind: RawMediaKind;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  published: boolean;
  sortOrder: number;
  planLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RawMediaStorageSummary {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  fileCount: number;
  percentUsed: number;
}

import type { ContributorPermissions } from "@/lib/contributor-permissions";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  province?: string | null;
  city?: string | null;
  /** Geographic zone set by admin/client: north/south/east/west. */
  region?: import("./user-regions").UserRegion | null;
  /** Mobile phone for SMS (optional until SMS provider is configured). */
  phone?: string | null;
  /** Account manager name set by the user in their profile. */
  accountManagerName?: string | null;
  campaignIds: string[];
  campaignPermissions: Record<string, ContributorPermissions>;
  createdAt: string;
}

export type DirectivePriority = "normal" | "urgent";
export type DirectiveAudienceType = "all" | "region" | "users";
export type DirectiveSmsStatus = "pending" | "sent" | "failed" | "no_phone" | "skipped";
export type DirectiveActionType = "none" | "custom_url" | "system";
export type DirectiveSystemAction =
  | "profile"
  | "posters"
  | "videos"
  | "files"
  | "raw_media"
  | "billboards"
  | "activities"
  | "submissions"
  | "social_posts"
  | "meetings"
  | "broadcast"
  | "problem_reports";

export interface DirectiveAttachment {
  id: string;
  directiveId: string;
  /** Display title for this attachment (required for clarity in broad directives). */
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  createdAt: string;
}

export interface DirectiveRecipient {
  directiveId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: AdminRole;
  userPhone?: string | null;
  smsStatus: DirectiveSmsStatus;
  smsError?: string | null;
  smsSentAt?: string | null;
  seenAt?: string | null;
  confirmed: boolean;
}

export interface CampaignDirective {
  id: string;
  campaignId: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
  title: string;
  body: string;
  priority: DirectivePriority;
  /** @deprecated Prefer endDate. Kept for older rows. */
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Official letter (PDF or image) for this directive. */
  letterFileUrl?: string | null;
  letterFileName?: string | null;
  letterMimeType?: string | null;
  letterFileSize?: number;
  audienceType: DirectiveAudienceType;
  audienceRegion?: import("./user-regions").UserRegion | null;
  /** CTA button: none, external URL, or in-app system destination. */
  actionType: DirectiveActionType;
  /** Optional custom button label; falls back to system/default labels. */
  actionLabel?: string | null;
  /** External http(s) URL when actionType is custom_url. */
  actionUrl?: string | null;
  /** In-app destination when actionType is system. */
  systemAction?: DirectiveSystemAction | null;
  published: boolean;
  publishedAt?: string | null;
  /** When set, directive is archived (never hard-deleted). */
  archivedAt?: string | null;
  sortOrder: number;
  attachments: DirectiveAttachment[];
  /** Present for managers; optional summary counts. */
  seenCount?: number;
  unseenCount?: number;
  recipientCount?: number;
  /** Present when loading the current user's inbox row. */
  confirmed?: boolean;
  seenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  type: "env_admin" | "db_user";
  userId: string | null;
  role: SessionRole;
  email?: string;
  name?: string;
  /** Bumped on logout so previous cookies become invalid. */
  sessionVersion: number;
}

export interface SocialPlatformStat extends Ownable {
  id: string;
  campaignId: string;
  platform: SocialPlatform;
  /** Optional display name to distinguish multiple channels on the same platform. */
  title?: string | null;
  followers: number;
  posts: number;
  profileUrl?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAnalyticsSummary {
  platforms: SocialPlatformStat[];
  totalFollowers: number;
  totalPosts: number;
  hasData: boolean;
}

export interface SocialMediaPost extends Ownable {
  id: string;
  campaignId: string;
  platform: SocialPostPlatform;
  title: string;
  coverImageUrl?: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  link: string;
  contentType: SocialContentType;
  mediaUrl?: string | null;
  description?: string | null;
  publishedDate: string;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastStatusRow {
  label: string;
  count: number;
  rawLabel?: string;
}

export interface BroadcastCityRow {
  name: string;
  count: number;
  rawName?: string;
}

export interface BroadcastBillboardRow {
  location: string;
  quality: string;
  rawLocation?: string;
  rawQuality?: string;
}

export interface BroadcastReportSummary {
  totalBillboards?: number;
  totalCities?: number;
  temporaryCount?: number;
  clientName?: string;
  reportDateTime?: string;
  notes?: string;
  /** pdf (default) or video — stored in JSON to avoid schema migration */
  mediaType?: "pdf" | "video";
  /** Optional auto/custom cover when mediaType is video */
  coverImageUrl?: string;
  statusBreakdown?: BroadcastStatusRow[];
  cityBreakdown?: BroadcastCityRow[];
  billboards?: BroadcastBillboardRow[];
  parsedAt?: string;
  parseError?: string;
}

export interface BroadcastReport extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  reportDate: string;
  pdfUrl: string;
  fileName: string;
  summaryData: BroadcastReportSummary;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMediaItem {
  id: string;
  type: "image" | "video" | "audio";
  url: string;
}

/** Downloadable document attached to a field activity (title + file). */
export interface ActivityAttachment {
  id: string;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface CampaignActivity extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  activityType: ActivityType;
  activityDate: string;
  location: string;
  link?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  mediaItems: ActivityMediaItem[];
  attachments: ActivityAttachment[];
  description?: string | null;
  /** Marked as a creative field activity for review/filtering. */
  isCreative: boolean;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingTask {
  id: string;
  meetingId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingDecision {
  id: string;
  meetingId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMeeting {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerProvince?: string | null;
  ownerCity?: string | null;
  title: string;
  meetingDate: string;
  location: string;
  imageUrl?: string | null;
  discussionSummary: string;
  attendees: string[];
  audioUrl?: string | null;
  viewPasswordHash?: string | null;
  published: boolean;
  sortOrder: number;
  planLabel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingWithTasks extends CampaignMeeting {
  tasks: MeetingTask[];
  decisions: MeetingDecision[];
}

export interface MeetingPublicPreview {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  title: string;
  meetingDate: string;
  imageUrl?: string | null;
  summaryPreview: string;
  hasPassword: boolean;
  sortOrder: number;
}

export interface MeetingPublicDetail {
  id: string;
  title: string;
  meetingDate: string;
  location: string;
  imageUrl?: string | null;
  discussionSummary: string;
  attendees: string[];
  audioUrl?: string | null;
  tasks: Pick<MeetingTask, "id" | "title" | "completed" | "sortOrder">[];
  decisions: Pick<MeetingDecision, "id" | "title" | "sortOrder">[];
}

export interface DataOwnerGroup<T> {
  ownerKey: string;
  ownerLabel: string;
  ownerUserId: string | null;
  ownerProvince?: string | null;
  ownerCity?: string | null;
  items: T[];
}

export interface PosterWithVersions extends Poster {
  versions: PosterVersion[];
  category?: MediaCategory;
}

export interface VideoWithVersions extends Video {
  versions: VideoVersion[];
  category?: MediaCategory;
}

export interface CampaignKPIs {
  totalBillboards: number;
  totalPosters: number;
  totalVideos: number;
  totalSiteVisitors: number;
  totalSocialFollowers: number;
  totalSocialPosts: number;
  totalSocialPostViews: number;
  totalSitePublications: number;
  totalBroadcastReports: number;
  totalMeetings: number;
  totalActivities: number;
  totalPressPublications: number;
  totalParticipants: number;
  totalFiles: number;
}

export interface AnalyticsSummary {
  totalVisitors: number;
  uniqueVisitors: number;
  pageViews: number;
  avgSessionDuration: number;
  trafficSources: { source: string; count: number }[];
  deviceSplit: { device: string; count: number }[];
  topPages: { page: string; views: number }[];
  visitorLocations: { city: string; count: number }[];
  visitsOverTime: { date: string; visitors: number; pageViews: number }[];
  metabaseEmbedUrl?: string | null;
  hasData: boolean;
}

export interface SubmissionSummary {
  totalParticipants: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  participationByDate: { date: string; count: number }[];
  hasData: boolean;
}

export interface SectionVisibility {
  billboards: boolean;
  posters: boolean;
  videos: boolean;
  analytics: boolean;
  socialAnalytics: boolean;
  socialPosts: boolean;
  sitePublications: boolean;
  broadcastReports: boolean;
  meetings: boolean;
  activities: boolean;
  pressPublications: boolean;
  submissions: boolean;
  files: boolean;
  rawMedia: boolean;
}

export interface PublicCampaignData {
  settings: CampaignSettings;
  kpis: CampaignKPIs;
  sections: SectionVisibility;
  billboards: Billboard[];
  billboardGroups: DataOwnerGroup<Billboard>[];
  posterCategories: MediaCategory[];
  posters: PosterWithVersions[];
  posterGroups: DataOwnerGroup<PosterWithVersions>[];
  videoCategories: MediaCategory[];
  videos: VideoWithVersions[];
  videoGroups: DataOwnerGroup<VideoWithVersions>[];
  analytics: AnalyticsSummary;
  socialAnalytics: SocialAnalyticsSummary;
  socialPosts: SocialMediaPost[];
  socialPostGroups: DataOwnerGroup<SocialMediaPost>[];
  sitePublications: SocialMediaPost[];
  sitePublicationGroups: DataOwnerGroup<SocialMediaPost>[];
  broadcastReports: BroadcastReport[];
  broadcastReportGroups: DataOwnerGroup<BroadcastReport>[];
  meetings: MeetingPublicPreview[];
  meetingGroups: DataOwnerGroup<MeetingPublicPreview>[];
  meetingsHasPassword: boolean;
  activities: CampaignActivity[];
  activityGroups: DataOwnerGroup<CampaignActivity>[];
  pressPublications: CampaignActivity[];
  pressPublicationGroups: DataOwnerGroup<CampaignActivity>[];
  submissions: CampaignSubmission[];
  submissionGroups: DataOwnerGroup<CampaignSubmission>[];
  submissionSummary: SubmissionSummary;
  files: CampaignFile[];
  fileGroups: DataOwnerGroup<CampaignFile>[];
  rawMedia: RawMediaUpload[];
  rawMediaGroups: DataOwnerGroup<RawMediaUpload>[];
  rawMediaStorage: RawMediaStorageSummary;
  lastUpdated: string;
}
