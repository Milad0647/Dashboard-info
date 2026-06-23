export type CampaignStatus = "live" | "completed" | "draft";
export type ItemStatus = "draft" | "published" | "final" | "revised" | "pending" | "approved" | "rejected" | "completed";
export type MediaCategoryType = "poster" | "video";
export type VersionStatus = "draft" | "revised" | "final";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type TrafficSource = "instagram" | "telegram" | "direct" | "google" | "referral" | "other";
export type DeviceType = "mobile" | "desktop" | "tablet";
export type AdminRole = "admin" | "editor";

export interface CampaignFeatures {
  billboards: boolean;
  posters: boolean;
  videos: boolean;
  analytics: boolean;
  socialAnalytics: boolean;
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

export interface Billboard {
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

export interface Poster {
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

export interface Video {
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

export interface AnalyticsMetric {
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

export interface CampaignSubmission {
  id: string;
  campaignId: string;
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

export interface CampaignFile {
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

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
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
  totalSocialReach: number;
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
  submissions: boolean;
  files: boolean;
}

export interface PublicCampaignData {
  settings: CampaignSettings;
  kpis: CampaignKPIs;
  sections: SectionVisibility;
  billboards: Billboard[];
  posterCategories: MediaCategory[];
  posters: PosterWithVersions[];
  videoCategories: MediaCategory[];
  videos: VideoWithVersions[];
  analytics: AnalyticsSummary;
  socialAnalytics: AnalyticsSummary;
  submissions: CampaignSubmission[];
  submissionSummary: SubmissionSummary;
  files: CampaignFile[];
  lastUpdated: string;
}
