export type CampaignStatus = "live" | "completed" | "draft";
export type ItemStatus = "draft" | "published" | "final" | "revised" | "pending" | "approved" | "rejected" | "completed";
export type MediaCategoryType = "poster" | "video";
export type VersionStatus = "draft" | "revised" | "final";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type TrafficSource = "instagram" | "telegram" | "direct" | "google" | "referral" | "other";
export type DeviceType = "mobile" | "desktop" | "tablet";
export type AdminRole = "admin" | "contributor";
export type SocialPlatform = "instagram" | "x" | "telegram" | "linkedin" | "youtube" | "aparat" | "rubika" | "eitaa" | "bale" | "other";
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
export type SocialContentType = "image" | "text" | "video" | "carousel" | "story" | "reel";
export type SessionRole = "admin" | "contributor";

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
  submissions: boolean;
  files: boolean;
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
  meetingsViewPasswordHash?: string | null;
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
  ownerProvince?: string | null;
  ownerCity?: string | null;
}

export interface Billboard extends Ownable {
  id: string;
  campaignId: string;
  title: string;
  description?: string | null;
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
  status: ItemStatus;
  tags: string[];
  notes?: string | null;
  published: boolean;
  sortOrder: number;
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
  createdAt: string;
  updatedAt: string;
}

import type { ContributorPermissions } from "@/lib/contributor-permissions";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  province?: string | null;
  city?: string | null;
  campaignIds: string[];
  campaignPermissions: Record<string, ContributorPermissions>;
  createdAt: string;
}

export interface AuthSession {
  type: "env_admin" | "db_user";
  userId: string | null;
  role: SessionRole;
  email?: string;
  name?: string;
}

export interface SocialPlatformStat {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  platform: SocialPlatform;
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

export interface SocialMediaPost {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
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
  statusBreakdown?: BroadcastStatusRow[];
  cityBreakdown?: BroadcastCityRow[];
  billboards?: BroadcastBillboardRow[];
  parsedAt?: string;
  parseError?: string;
}

export interface BroadcastReport {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
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

export interface CampaignActivity {
  id: string;
  campaignId: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  title: string;
  activityType: ActivityType;
  activityDate: string;
  location: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  description?: string | null;
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
  totalParticipants: number;
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
  submissions: boolean;
  files: boolean;
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
  submissions: CampaignSubmission[];
  submissionGroups: DataOwnerGroup<CampaignSubmission>[];
  submissionSummary: SubmissionSummary;
  files: CampaignFile[];
  fileGroups: DataOwnerGroup<CampaignFile>[];
  lastUpdated: string;
}
