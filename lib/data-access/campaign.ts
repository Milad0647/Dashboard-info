import { getMockStore, getMockStoreForCampaign } from "@/lib/mock-data";
import { resolvePublicBillboards } from "@/lib/billboards";
import type {
  AnalyticsChannel,
  AnalyticsMetric,
  AnalyticsSummary,
  CampaignKPIs,
  CampaignListItem,
  CampaignSettings,
  ChannelAnalyticsConfig,
  PublicCampaignData,
  SectionVisibility,
  SocialAnalyticsSummary,
  SocialPlatformStat,
  SubmissionSummary,
  MeetingPublicPreview,
  MeetingWithTasks,
} from "@/lib/types";
import { truncateMeetingSummary } from "@/lib/meeting-preview";
import { groupByOwner } from "@/lib/owner-groups";
import { buildSocialAnalyticsSummary } from "@/lib/social-analytics";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/utils";
import * as pg from "@/lib/db/repository";
import { fetchMetabaseMetrics, resolveChannelMetabaseEmbedUrl } from "@/lib/services/metabase";
import {
  mapAnalyticsFromDb,
  mapBillboardFromDb,
  mapCategoryFromDb,
  mapPosterFromDb,
  mapPosterVersionFromDb,
  mapSettingsFromDb,
  mapSubmissionFromDb,
  mapVideoFromDb,
  mapVideoVersionFromDb,
} from "@/lib/db/mappers";
import { createClient } from "@/lib/supabase/server";

async function resolveChannelAnalyticsMetrics(
  settings: CampaignSettings,
  dbMetrics: AnalyticsMetric[],
  channel: AnalyticsChannel,
  channelConfig: ChannelAnalyticsConfig
): Promise<AnalyticsMetric[]> {
  const channelMetrics = dbMetrics.filter((metric) => (metric.channel ?? "site") === channel);
  const metabase = channelConfig.metabase;
  const useMetabase =
    (channelConfig.source === "metabase" || channelConfig.source === "hybrid") &&
    Boolean(metabase?.url && metabase?.questionId);

  if (!useMetabase || !metabase) {
    return channelMetrics;
  }

  try {
    const liveMetrics = await fetchMetabaseMetrics(settings.id, metabase, channel);
    if (channelConfig.source === "hybrid") {
      return [...channelMetrics, ...liveMetrics];
    }
    return liveMetrics;
  } catch (error) {
    console.error(`Metabase analytics fetch failed (${channel}):`, error);
    return channelMetrics;
  }
}

function buildAnalyticsSummary(
  metrics: { visitors: number; uniqueVisitors: number; pageViews: number; avgSessionDuration: number; source?: string | null; device?: string | null; page?: string | null; city?: string | null; date: string }[]
): AnalyticsSummary {
  if (metrics.length === 0) {
    return {
      totalVisitors: 0,
      uniqueVisitors: 0,
      pageViews: 0,
      avgSessionDuration: 0,
      trafficSources: [],
      deviceSplit: [],
      topPages: [],
      visitorLocations: [],
      visitsOverTime: [],
      hasData: false,
    };
  }

  const totalVisitors = metrics.reduce((s, m) => s + m.visitors, 0);
  const uniqueVisitors = metrics.reduce((s, m) => s + m.uniqueVisitors, 0);
  const pageViews = metrics.reduce((s, m) => s + m.pageViews, 0);
  const avgSessionDuration = Math.round(
    metrics.reduce((s, m) => s + m.avgSessionDuration, 0) / metrics.length
  );

  const sourceMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const pageMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const dateMap = new Map<string, { visitors: number; pageViews: number }>();

  metrics.forEach((m) => {
    if (m.source && !["instagram", "telegram"].includes(m.source)) {
      sourceMap.set(m.source, (sourceMap.get(m.source) ?? 0) + m.visitors);
    }
    if (m.device) deviceMap.set(m.device, (deviceMap.get(m.device) ?? 0) + m.visitors);
    if (m.page) pageMap.set(m.page, (pageMap.get(m.page) ?? 0) + m.pageViews);
    if (m.city) cityMap.set(m.city, (cityMap.get(m.city) ?? 0) + m.visitors);
    const existing = dateMap.get(m.date) ?? { visitors: 0, pageViews: 0 };
    dateMap.set(m.date, {
      visitors: existing.visitors + m.visitors,
      pageViews: existing.pageViews + m.pageViews,
    });
  });

  return {
    totalVisitors,
    uniqueVisitors,
    pageViews,
    avgSessionDuration,
    trafficSources: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    deviceSplit: Array.from(deviceMap.entries()).map(([device, count]) => ({ device, count })),
    topPages: Array.from(pageMap.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5),
    visitorLocations: Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count),
    visitsOverTime: Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    hasData: totalVisitors > 0,
  };
}

function withMetabaseEmbed(
  summary: AnalyticsSummary,
  channelConfig: ChannelAnalyticsConfig
): AnalyticsSummary {
  const metabaseEmbedUrl = resolveChannelMetabaseEmbedUrl(channelConfig);
  return {
    ...summary,
    metabaseEmbedUrl,
    hasData: summary.hasData || Boolean(metabaseEmbedUrl),
  };
}

function buildSubmissionSummary(
  submissions: { participantName: string; status: string; createdAt: string }[]
): SubmissionSummary {
  if (submissions.length === 0) {
    return {
      totalParticipants: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      pendingSubmissions: 0,
      rejectedSubmissions: 0,
      participationByDate: [],
      hasData: false,
    };
  }

  const approved = submissions.filter((s) => s.status === "approved");
  const pending = submissions.filter((s) => s.status === "pending");
  const rejected = submissions.filter((s) => s.status === "rejected");
  const dateMap = new Map<string, number>();

  submissions.forEach((s) => {
    const date = s.createdAt.split("T")[0];
    dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
  });

  return {
    totalParticipants: new Set(submissions.map((s) => s.participantName)).size,
    totalSubmissions: submissions.length,
    approvedSubmissions: approved.length,
    pendingSubmissions: pending.length,
    rejectedSubmissions: rejected.length,
    participationByDate: Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    hasData: approved.length > 0,
  };
}

function toMeetingPreview(meeting: MeetingWithTasks): MeetingPublicPreview {
  return {
    id: meeting.id,
    campaignId: meeting.campaignId,
    ownerUserId: meeting.ownerUserId,
    ownerName: meeting.ownerName,
    title: meeting.title,
    meetingDate: meeting.meetingDate,
    imageUrl: meeting.imageUrl,
    summaryPreview: truncateMeetingSummary(meeting.discussionSummary),
    hasPassword: Boolean(meeting.viewPasswordHash),
    sortOrder: meeting.sortOrder,
  };
}

function normalizeMeetingPreviews(
  items: (MeetingPublicPreview | MeetingWithTasks)[]
): MeetingPublicPreview[] {
  return items.map((item) =>
    "summaryPreview" in item ? item : toMeetingPreview(item)
  );
}

function buildSectionVisibility(
  features: CampaignSettings["features"],
  data: {
    billboards: unknown[];
    posters: unknown[];
    videos: unknown[];
    analytics: AnalyticsSummary;
    socialAnalytics: SocialAnalyticsSummary;
    socialPosts: unknown[];
    broadcastReports: unknown[];
    meetings: unknown[];
    submissions: unknown[];
    files: unknown[];
  }
): SectionVisibility {
  return {
    billboards: features.billboards && data.billboards.length > 0,
    posters: features.posters && data.posters.length > 0,
    videos: features.videos && data.videos.length > 0,
    analytics:
      features.analytics &&
      (data.analytics.hasData || Boolean(data.analytics.metabaseEmbedUrl)),
    socialAnalytics:
      features.socialAnalytics && data.socialAnalytics.hasData,
    socialPosts: (features.socialPosts ?? true) && data.socialPosts.length > 0,
    broadcastReports: (features.broadcastReports ?? true) && data.broadcastReports.length > 0,
    meetings: (features.meetings ?? true) && data.meetings.length > 0,
    submissions: features.submissions && data.submissions.length > 0,
    files: features.files && data.files.length > 0,
  };
}

function buildKPIs(
  sections: SectionVisibility,
  data: {
    billboards: unknown[];
    posters: unknown[];
    videos: unknown[];
    analytics: AnalyticsSummary;
    socialAnalytics: SocialAnalyticsSummary;
    submissions: { participantName: string }[];
  }
): CampaignKPIs {
  return {
    totalBillboards: sections.billboards ? data.billboards.length : 0,
    totalPosters: sections.posters ? data.posters.length : 0,
    totalVideos: sections.videos ? data.videos.length : 0,
    totalSiteVisitors: sections.analytics ? data.analytics.totalVisitors : 0,
    totalSocialFollowers: sections.socialAnalytics ? data.socialAnalytics.totalFollowers : 0,
    totalParticipants: sections.submissions
      ? new Set(data.submissions.map((s) => s.participantName)).size
      : 0,
  };
}

type CampaignPublicStore = Omit<ReturnType<typeof getMockStoreForCampaign>, "meetings"> & {
  meetings?: (MeetingPublicPreview | MeetingWithTasks)[];
  socialPlatformStats?: SocialPlatformStat[];
};

function assemblePublicData(
  settings: CampaignSettings,
  store: CampaignPublicStore,
  billboards: ReturnType<typeof getMockStoreForCampaign>["billboards"]
): PublicCampaignData {
  const posterCategories = store.posterCategories
    .filter((c) => c.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const posters = store.posters
    .filter((p) => p.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((poster) => ({
      ...poster,
      versions: store.posterVersions
        .filter((v) => v.posterId === poster.id)
        .sort((a, b) => a.versionNumber - b.versionNumber),
      category: posterCategories.find((c) => c.id === poster.categoryId),
    }))
    .filter((p) => p.versions.length > 0);

  const videoCategories = store.videoCategories
    .filter((c) => c.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const videos = store.videos
    .filter((v) => v.published)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((video) => ({
      ...video,
      versions: store.videoVersions
        .filter((vv) => vv.videoId === video.id)
        .sort((a, b) => a.versionNumber - b.versionNumber),
      category: videoCategories.find((c) => c.id === video.categoryId),
    }))
    .filter((v) => v.versions.length > 0);

  const siteMetrics = store.analytics.filter((metric) => (metric.channel ?? "site") === "site");
  const analytics = withMetabaseEmbed(
    buildAnalyticsSummary(siteMetrics),
    settings.analyticsConfig.site
  );
  const socialAnalytics = buildSocialAnalyticsSummary(store.socialPlatformStats ?? []);
  const submissions = store.submissions
    .filter((s) => s.published && s.status === "approved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const files = (store.files ?? [])
    .filter((file) => file.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const socialPosts = (store.socialPosts ?? [])
    .filter((post) => post.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const broadcastReports = (store.broadcastReports ?? [])
    .filter((report) => report.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const meetings = normalizeMeetingPreviews(
    (store.meetings ?? [])
      .filter((meeting) => ("published" in meeting ? meeting.published : true))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );

  const submissionSummary = buildSubmissionSummary(store.submissions);

  const sections = buildSectionVisibility(settings.features, {
    billboards,
    posters,
    videos,
    analytics,
    socialAnalytics,
    socialPosts,
    broadcastReports,
    meetings,
    submissions,
    files,
  });

  const kpis = buildKPIs(sections, {
    billboards,
    posters,
    videos,
    analytics,
    socialAnalytics,
    submissions,
  });

  return {
    settings,
    kpis,
    sections,
    billboards,
    billboardGroups: groupByOwner(billboards),
    posterCategories,
    posters,
    posterGroups: groupByOwner(posters),
    videoCategories,
    videos,
    videoGroups: groupByOwner(videos),
    analytics,
    socialAnalytics,
    socialPosts,
    socialPostGroups: groupByOwner(socialPosts),
    broadcastReports,
    broadcastReportGroups: groupByOwner(broadcastReports),
    meetings,
    meetingGroups: groupByOwner(meetings),
    submissions,
    submissionGroups: groupByOwner(submissions),
    submissionSummary,
    files,
    fileGroups: groupByOwner(files),
    lastUpdated: new Date().toISOString(),
  };
}

function getMockPublicDataBySlug(slug: string): PublicCampaignData | null {
  const store = getMockStore();
  const settings = store.campaigns.find((c) => c.slug === slug && c.published);
  if (!settings) return null;
  const campaignStore = getMockStoreForCampaign(settings.id);
  if (!campaignStore.settings) return null;
  const billboards = campaignStore.billboards
    .filter((b) => b.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return assemblePublicData(campaignStore.settings, campaignStore, billboards);
}

export async function getCampaignList(): Promise<CampaignListItem[]> {
  if (isPostgresConfigured()) {
    return pg.pgGetCampaignList();
  }
  if (!isSupabaseConfigured()) {
    return getMockStore()
      .campaigns.filter((c) => c.published)
      .map(({ id, slug, title, description, status, startDate, endDate, coverImageUrl }) => ({
        id,
        slug,
        title,
        description,
        status,
        startDate,
        endDate,
        coverImageUrl,
      }));
  }

  const supabase = await createClient();
  if (!supabase) return [];

  try {
    const { data } = await supabase
      .from("campaign_settings")
      .select("id, slug, title, description, status, start_date, end_date, cover_image_url")
      .eq("published", true)
      .order("updated_at", { ascending: false });

    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      coverImageUrl: row.cover_image_url,
    }));
  } catch {
    return getMockStore()
      .campaigns.filter((c) => c.published)
      .map(({ id, slug, title, description, status, startDate, endDate, coverImageUrl }) => ({
        id,
        slug,
        title,
        description,
        status,
        startDate,
        endDate,
        coverImageUrl,
      }));
  }
}

export async function getPublicCampaignData(slug: string): Promise<PublicCampaignData | null> {
  if (isPostgresConfigured()) {
    const settings = await pg.pgGetPublishedCampaignBySlug(slug);
    if (!settings) return null;
    const campaignStore = await pg.pgGetPublicCampaignData(settings.id);
    const [siteMetrics, billboards] = await Promise.all([
      resolveChannelAnalyticsMetrics(
        settings,
        campaignStore.analytics,
        "site",
        settings.analyticsConfig.site
      ),
      resolvePublicBillboards(settings, campaignStore.billboards),
    ]);
    return assemblePublicData(
      settings,
      {
        settings,
        ...campaignStore,
        analytics: siteMetrics,
        socialPlatformStats: campaignStore.socialPlatformStats ?? [],
      } as CampaignPublicStore,
      billboards
    );
  }
  if (!isSupabaseConfigured()) {
    return getMockPublicDataBySlug(slug);
  }

  const supabase = await createClient();
  if (!supabase) return getMockPublicDataBySlug(slug);

  try {
    const { data: settingsRow } = await supabase
      .from("campaign_settings")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (!settingsRow) return getMockPublicDataBySlug(slug);

    const campaignId = settingsRow.id;
    const settings = mapSettingsFromDb(settingsRow);

    const [
      billboardsRes,
      posterCategoriesRes,
      postersRes,
      posterVersionsRes,
      videoCategoriesRes,
      videosRes,
      videoVersionsRes,
      analyticsRes,
      submissionsRes,
    ] = await Promise.all([
      supabase.from("billboards").select("*").eq("campaign_id", campaignId).eq("published", true).order("sort_order"),
      supabase.from("media_categories").select("*").eq("campaign_id", campaignId).eq("type", "poster").eq("published", true).order("sort_order"),
      supabase.from("posters").select("*").eq("campaign_id", campaignId).eq("published", true).order("sort_order"),
      supabase.from("poster_versions").select("*").order("version_number"),
      supabase.from("media_categories").select("*").eq("campaign_id", campaignId).eq("type", "video").eq("published", true).order("sort_order"),
      supabase.from("videos").select("*").eq("campaign_id", campaignId).eq("published", true).order("sort_order"),
      supabase.from("video_versions").select("*").order("version_number"),
      supabase.from("analytics_metrics").select("*").eq("campaign_id", campaignId).order("date"),
      supabase.from("campaign_submissions").select("*").eq("campaign_id", campaignId).eq("published", true).eq("status", "approved"),
    ]);

    const posterIds = (postersRes.data ?? []).map((p) => p.id);
    const videoIds = (videosRes.data ?? []).map((v) => v.id);

    const campaignStore = {
      campaigns: [settings],
      settings,
      billboards: (billboardsRes.data ?? []).map(mapBillboardFromDb),
      posterCategories: (posterCategoriesRes.data ?? []).map(mapCategoryFromDb),
      posters: (postersRes.data ?? []).map(mapPosterFromDb),
      posterVersions: (posterVersionsRes.data ?? [])
        .filter((v) => posterIds.includes(v.poster_id))
        .map(mapPosterVersionFromDb),
      videoCategories: (videoCategoriesRes.data ?? []).map(mapCategoryFromDb),
      videos: (videosRes.data ?? []).map(mapVideoFromDb),
      videoVersions: (videoVersionsRes.data ?? [])
        .filter((v) => videoIds.includes(v.video_id))
        .map(mapVideoVersionFromDb),
      analytics: (analyticsRes.data ?? []).map(mapAnalyticsFromDb),
      submissions: (submissionsRes.data ?? []).map(mapSubmissionFromDb),
      files: [],
      socialPosts: [],
      broadcastReports: [],
      meetings: [],
      socialPlatformStats: [],
    };

    return assemblePublicData(
      settings,
      campaignStore,
      await resolvePublicBillboards(settings, campaignStore.billboards)
    );
  } catch {
    return getMockPublicDataBySlug(slug);
  }
}

export { buildAnalyticsSummary, buildSubmissionSummary, buildSectionVisibility };
