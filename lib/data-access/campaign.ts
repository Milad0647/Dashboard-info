import { getMockStore, getMockStoreForCampaign } from "@/lib/mock-data";
import { resolvePublicBillboards } from "@/lib/billboards";
import { getAllUsers } from "@/lib/data-access/admin";
import type {
  AnalyticsChannel,
  AnalyticsMetric,
  AnalyticsSummary,
  CampaignKPIs,
  CampaignListItem,
  CampaignSettings,
  CampaignActivity,
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
import { compareMeetingsByDateDesc } from "@/lib/meeting-tasks";
import { groupByOwner, resolveAdminOwnerLabel } from "@/lib/owner-groups";
import { splitSocialPosts } from "@/lib/social-posts";
import { splitPressActivities } from "@/lib/press-publications";
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

function toMeetingPreview(
  meeting: MeetingWithTasks,
  meetingsHasPassword: boolean
): MeetingPublicPreview {
  return {
    id: meeting.id,
    campaignId: meeting.campaignId,
    ownerUserId: meeting.ownerUserId,
    ownerName: meeting.ownerName,
    title: meeting.title,
    meetingDate: meeting.meetingDate,
    imageUrl: meeting.imageUrl,
    summaryPreview: truncateMeetingSummary(meeting.discussionSummary),
    hasPassword: meetingsHasPassword,
    sortOrder: meeting.sortOrder,
  };
}

function normalizeMeetingPreviews(
  items: (MeetingPublicPreview | MeetingWithTasks)[],
  meetingsHasPassword = false
): MeetingPublicPreview[] {
  return items.map((item) =>
    "summaryPreview" in item ? { ...item, hasPassword: meetingsHasPassword } : toMeetingPreview(item, meetingsHasPassword)
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
    sitePublications: unknown[];
    broadcastReports: unknown[];
    meetings: unknown[];
    activities: unknown[];
    pressPublications: unknown[];
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
    sitePublications: (features.sitePublications ?? true) && data.sitePublications.length > 0,
    broadcastReports: (features.broadcastReports ?? true) && data.broadcastReports.length > 0,
    meetings: (features.meetings ?? true) && data.meetings.length > 0,
    activities: (features.activities ?? true) && data.activities.length > 0,
    pressPublications: (features.pressPublications ?? true) && data.pressPublications.length > 0,
    submissions: features.submissions && data.submissions.length > 0,
    files: features.files && data.files.length > 0,
  };
}

function buildKpiVisibility(features: CampaignSettings["features"]): SectionVisibility {
  return {
    billboards: features.billboards,
    posters: features.posters,
    videos: features.videos,
    analytics: features.analytics,
    socialAnalytics: features.socialAnalytics,
    socialPosts: features.socialPosts ?? true,
    sitePublications: features.sitePublications ?? true,
    broadcastReports: features.broadcastReports ?? true,
    meetings: features.meetings ?? true,
    activities: features.activities ?? true,
    pressPublications: features.pressPublications ?? true,
    submissions: features.submissions,
    files: features.files,
  };
}

function buildKPIs(
  features: CampaignSettings["features"],
  data: {
    billboards: unknown[];
    posters: unknown[];
    videos: unknown[];
    analytics: AnalyticsSummary;
    socialAnalytics: SocialAnalyticsSummary;
    socialPosts: unknown[];
    sitePublications: unknown[];
    broadcastReports: unknown[];
    meetings: unknown[];
    activities: unknown[];
    pressPublications: unknown[];
    submissions: { participantName: string }[];
    files: unknown[];
  }
): CampaignKPIs {
  const visibility = buildKpiVisibility(features);

  return {
    totalBillboards: visibility.billboards ? data.billboards.length : 0,
    totalPosters: visibility.posters ? data.posters.length : 0,
    totalVideos: visibility.videos ? data.videos.length : 0,
    totalSiteVisitors: visibility.analytics ? data.analytics.totalVisitors : 0,
    totalSocialFollowers: visibility.socialAnalytics ? data.socialAnalytics.totalFollowers : 0,
    totalSocialPosts: visibility.socialPosts ? data.socialPosts.length : 0,
    totalSitePublications: visibility.sitePublications ? data.sitePublications.length : 0,
    totalBroadcastReports: visibility.broadcastReports ? data.broadcastReports.length : 0,
    totalMeetings: visibility.meetings ? data.meetings.length : 0,
    totalActivities: visibility.activities ? data.activities.length : 0,
    totalPressPublications: visibility.pressPublications ? data.pressPublications.length : 0,
    totalParticipants: visibility.submissions
      ? new Set(data.submissions.map((s) => s.participantName)).size
      : 0,
    totalFiles: visibility.files ? data.files.length : 0,
  };
}

type CampaignPublicStore = Omit<ReturnType<typeof getMockStoreForCampaign>, "meetings"> & {
  meetings?: (MeetingPublicPreview | MeetingWithTasks)[];
  socialPlatformStats?: SocialPlatformStat[];
  activities?: CampaignActivity[];
};

function assemblePublicData(
  settings: CampaignSettings,
  store: CampaignPublicStore,
  billboards: ReturnType<typeof getMockStoreForCampaign>["billboards"]
): PublicCampaignData {
  const posterCategories = store.posterCategories
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const posters = store.posters
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
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const videos = store.videos
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
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allSocialPosts = (store.socialPosts ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder || b.publishedDate.localeCompare(a.publishedDate));

  const { sitePublications, socialPosts } = splitSocialPosts(allSocialPosts);

  const broadcastReports = (store.broadcastReports ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const meetingsHasPassword = Boolean(settings.meetingsViewPasswordHash);

  const allActivities = (store.activities ?? [])
    .sort(
      (a, b) =>
        b.activityDate.localeCompare(a.activityDate) || a.sortOrder - b.sortOrder
    );

  const { pressPublications, fieldActivities: activities } = splitPressActivities(allActivities);

  const meetings = normalizeMeetingPreviews(
    (store.meetings ?? [])
      .sort(compareMeetingsByDateDesc),
    meetingsHasPassword
  );

  const submissionSummary = buildSubmissionSummary(store.submissions);

  const sections = buildSectionVisibility(settings.features, {
    billboards,
    posters,
    videos,
    analytics,
    socialAnalytics,
    socialPosts,
    sitePublications,
    broadcastReports,
    meetings,
    activities,
    pressPublications,
    submissions,
    files,
  });

  const kpis = buildKPIs(settings.features, {
    billboards,
    posters,
    videos,
    analytics,
    socialAnalytics,
    socialPosts,
    sitePublications,
    broadcastReports,
    meetings,
    activities,
    pressPublications,
    submissions,
    files,
  });

  const adminOwnerLabel = resolveAdminOwnerLabel(settings.adminOwnerLabel);

  return {
    settings,
    kpis,
    sections,
    billboards,
    billboardGroups: groupByOwner(billboards, adminOwnerLabel),
    posterCategories,
    posters,
    posterGroups: groupByOwner(posters, adminOwnerLabel),
    videoCategories,
    videos,
    videoGroups: groupByOwner(videos, adminOwnerLabel),
    analytics,
    socialAnalytics,
    socialPosts,
    socialPostGroups: groupByOwner(socialPosts, adminOwnerLabel),
    sitePublications,
    sitePublicationGroups: groupByOwner(sitePublications, adminOwnerLabel),
    broadcastReports,
    broadcastReportGroups: groupByOwner(broadcastReports, adminOwnerLabel),
    meetings,
    meetingGroups: groupByOwner(meetings, adminOwnerLabel),
    meetingsHasPassword,
    activities,
    activityGroups: groupByOwner(activities, adminOwnerLabel),
    pressPublications,
    pressPublicationGroups: groupByOwner(pressPublications, adminOwnerLabel),
    submissions,
    submissionGroups: groupByOwner(submissions, adminOwnerLabel),
    submissionSummary,
    files,
    fileGroups: groupByOwner(files, adminOwnerLabel),
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
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return assemblePublicData(campaignStore.settings, campaignStore, billboards);
}

export async function getCampaignList(): Promise<CampaignListItem[]> {
  if (isPostgresConfigured()) {
    try {
      return await pg.pgGetCampaignList();
    } catch (error) {
      console.error("getCampaignList failed:", error);
      return [];
    }
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
    try {
      const settings = await pg.pgGetPublishedCampaignBySlug(slug);
      if (!settings) return null;
      const campaignStore = await pg.pgGetPublicCampaignData(settings.id);
      const [siteMetrics, users] = await Promise.all([
        resolveChannelAnalyticsMetrics(
          settings,
          campaignStore.analytics,
          "site",
          settings.analyticsConfig.site
        ),
        getAllUsers(),
      ]);
      const billboards = await resolvePublicBillboards(
        settings,
        campaignStore.billboards,
        users
      );
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
    } catch (error) {
      console.error("getPublicCampaignData failed:", error);
      return null;
    }
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
      activities: [],
      socialPlatformStats: [],
    };

    return assemblePublicData(
      settings,
      campaignStore,
      await resolvePublicBillboards(settings, campaignStore.billboards, await getAllUsers())
    );
  } catch {
    return getMockPublicDataBySlug(slug);
  }
}

export { buildAnalyticsSummary, buildSubmissionSummary, buildSectionVisibility };
