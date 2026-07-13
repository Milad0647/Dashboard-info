import { getMockStore, getMockStoreForCampaign, updateMockStore } from "@/lib/mock-data";
import { getAuthSession, getOwnerFilter } from "@/lib/auth/get-session";
import * as pg from "@/lib/db/repository";
import type { ParsedSubmissionRow } from "@/lib/services/submissions-excel-parser";
import * as pgExt from "@/lib/db/repository-extended";
import type {
  AnalyticsMetric,
  Billboard,
  CampaignFile,
  CampaignSettings,
  CampaignSubmission,
  MediaCategory,
  Poster,
  PosterVersion,
  RawMediaUpload,
  Video,
  VideoVersion,
} from "@/lib/types";
import { generateId, isPostgresConfigured, isSupabaseConfigured, slugify } from "@/lib/utils";
import { compareMeetingsByDateDesc } from "@/lib/meeting-tasks";
import { createClient } from "@/lib/supabase/server";

export async function getAllUsers() {
  if (!isPostgresConfigured()) return [];
  return pgExt.pgGetAllUsers();
}

export async function getAllCampaigns(): Promise<CampaignSettings[]> {
  if (isPostgresConfigured()) {
    return pg.pgGetAllCampaigns();
  }
  if (!isSupabaseConfigured()) {
    return getMockStore().campaigns;
  }
  const supabase = await createClient();
  if (!supabase) return getMockStore().campaigns;
  try {
    const { data } = await supabase.from("campaign_settings").select("*").order("updated_at", { ascending: false });
    return (data ?? []) as CampaignSettings[];
  } catch {
    return getMockStore().campaigns;
  }
}

export async function getAdminData(campaignId: string) {
  const session = await getAuthSession();
  const ownerFilter = session ? getOwnerFilter(session) : undefined;

  const filterByOwner = <T extends { ownerUserId?: string | null }>(items: T[]) =>
    ownerFilter === undefined
      ? items
      : items.filter((item) => (item.ownerUserId ?? null) === ownerFilter);

  if (isPostgresConfigured()) {
    return pg.pgGetAdminData(campaignId, ownerFilter);
  }
  if (!isSupabaseConfigured()) {
    const store = getMockStoreForCampaign(campaignId);

    return {
      settings: store.settings ?? null,
      campaigns: getMockStore().campaigns,
      billboards: filterByOwner([...store.billboards]).sort((a, b) => a.sortOrder - b.sortOrder),
      posterCategories: [...store.posterCategories].sort((a, b) => a.sortOrder - b.sortOrder),
      posters: filterByOwner([...store.posters]).sort((a, b) => a.sortOrder - b.sortOrder),
      posterVersions: [...store.posterVersions],
      videoCategories: [...store.videoCategories].sort((a, b) => a.sortOrder - b.sortOrder),
      videos: filterByOwner([...store.videos]).sort((a, b) => a.sortOrder - b.sortOrder),
      videoVersions: [...store.videoVersions],
      analytics: filterByOwner([...store.analytics]),
      submissions: filterByOwner([...store.submissions]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      files: filterByOwner([...(store.files ?? [])]).sort((a, b) => a.sortOrder - b.sortOrder),
      socialPosts: filterByOwner([...(store.socialPosts ?? [])]).sort((a, b) => a.sortOrder - b.sortOrder),
      broadcastReports: filterByOwner([...(store.broadcastReports ?? [])]).sort((a, b) => a.sortOrder - b.sortOrder),
      socialPlatformStats: filterByOwner([...(store.socialPlatformStats ?? [])]).sort((a, b) => a.sortOrder - b.sortOrder),
      meetings: filterByOwner([...(store.meetings ?? [])]).sort(compareMeetingsByDateDesc),
      activities: filterByOwner([...(store.activities ?? [])]).sort(
        (a, b) => b.activityDate.localeCompare(a.activityDate) || a.sortOrder - b.sortOrder
      ),
      rawMedia: filterByOwner([...((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? [])]).sort(
        (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt)
      ),
    };
  }

  const supabase = await createClient();
  if (!supabase) return getAdminDataMock(campaignId);

  try {
    const [campaigns, settings, billboards, posterCategories, posters, posterVersions, videoCategories, videos, videoVersions, analytics, submissions] =
      await Promise.all([
        supabase.from("campaign_settings").select("*").order("updated_at", { ascending: false }),
        supabase.from("campaign_settings").select("*").eq("id", campaignId).single(),
        supabase.from("billboards").select("*").eq("campaign_id", campaignId).order("sort_order"),
        supabase.from("media_categories").select("*").eq("campaign_id", campaignId).eq("type", "poster").order("sort_order"),
        supabase.from("posters").select("*").eq("campaign_id", campaignId).order("sort_order"),
        supabase.from("poster_versions").select("*"),
        supabase.from("media_categories").select("*").eq("campaign_id", campaignId).eq("type", "video").order("sort_order"),
        supabase.from("videos").select("*").eq("campaign_id", campaignId).order("sort_order"),
        supabase.from("video_versions").select("*"),
        supabase.from("analytics_metrics").select("*").eq("campaign_id", campaignId).order("date", { ascending: false }),
        supabase.from("campaign_submissions").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
      ]);

    return {
      settings: settings.data,
      campaigns: campaigns.data ?? [],
      billboards: filterByOwner(billboards.data ?? []),
      posterCategories: posterCategories.data ?? [],
      posters: filterByOwner(posters.data ?? []),
      posterVersions: posterVersions.data ?? [],
      videoCategories: videoCategories.data ?? [],
      videos: filterByOwner(videos.data ?? []),
      videoVersions: videoVersions.data ?? [],
      analytics: filterByOwner(analytics.data ?? []),
      submissions: filterByOwner(submissions.data ?? []),
      files: [],
      socialPosts: [],
      broadcastReports: [],
      socialPlatformStats: [],
      meetings: [],
      activities: [],
      rawMedia: [],
    };
  } catch {
    const mock = getAdminDataMock(campaignId);
    if (ownerFilter === undefined) return mock;
    return {
      ...mock,
      billboards: filterByOwner(mock.billboards),
      posters: filterByOwner(mock.posters),
      videos: filterByOwner(mock.videos),
      analytics: filterByOwner(mock.analytics),
      submissions: filterByOwner(mock.submissions),
      files: filterByOwner(mock.files ?? []),
      socialPosts: filterByOwner(mock.socialPosts ?? []),
      broadcastReports: filterByOwner(mock.broadcastReports ?? []),
      socialPlatformStats: filterByOwner(mock.socialPlatformStats ?? []),
      meetings: filterByOwner(mock.meetings ?? []),
      activities: filterByOwner(mock.activities ?? []),
      rawMedia: filterByOwner(mock.rawMedia ?? []),
    };
  }
}

function getAdminDataMock(campaignId: string) {
  const store = getMockStoreForCampaign(campaignId);
  return {
    settings: store.settings ?? null,
    campaigns: getMockStore().campaigns,
    billboards: [...store.billboards].sort((a, b) => a.sortOrder - b.sortOrder),
    posterCategories: [...store.posterCategories].sort((a, b) => a.sortOrder - b.sortOrder),
    posters: [...store.posters].sort((a, b) => a.sortOrder - b.sortOrder),
    posterVersions: [...store.posterVersions],
    videoCategories: [...store.videoCategories].sort((a, b) => a.sortOrder - b.sortOrder),
    videos: [...store.videos].sort((a, b) => a.sortOrder - b.sortOrder),
    videoVersions: [...store.videoVersions],
    analytics: [...store.analytics],
    submissions: [...store.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    files: [...(store.files ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    socialPosts: [...(store.socialPosts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    broadcastReports: [...(store.broadcastReports ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    socialPlatformStats: [...(store.socialPlatformStats ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    meetings: [...(store.meetings ?? [])].sort(compareMeetingsByDateDesc),
    activities: [...(store.activities ?? [])].sort(
      (a, b) => b.activityDate.localeCompare(a.activityDate) || a.sortOrder - b.sortOrder
    ),
    rawMedia: [...((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt)
    ),
  };
}

export async function saveCampaign(data: Partial<CampaignSettings> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveCampaign(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      if (data.id) {
        return {
          ...store,
          campaigns: store.campaigns.map((c) =>
            c.id === data.id ? { ...c, ...data, updatedAt: now } as CampaignSettings : c
          ),
        };
      }
      const id = generateId();
      const newCampaign: CampaignSettings = {
        id,
        slug: data.slug ?? slugify(data.title ?? id),
        title: data.title ?? "",
        description: data.description ?? "",
        status: data.status ?? "draft",
        startDate: data.startDate ?? now.split("T")[0],
        endDate: data.endDate ?? now.split("T")[0],
        coverImageUrl: data.coverImageUrl,
        published: data.published ?? false,
        features: data.features ?? {
          billboards: true,
          posters: true,
          videos: false,
          analytics: false,
          socialAnalytics: false,
          socialPosts: false,
          sitePublications: false,
          broadcastReports: false,
          meetings: false,
          activities: false,
          pressPublications: false,
          submissions: false,
          files: false,
          rawMedia: false,
        },
        analyticsConfig: data.analyticsConfig ?? {
          site: { source: "manual", metabase: null },
          social: { source: "manual", metabase: null },
        },
        billboardConfig: data.billboardConfig ?? {},
        updatedAt: now,
      };
      return { ...store, campaigns: [...store.campaigns, newCampaign] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteCampaign(id: string): Promise<{ success: boolean; error?: string }> {
  if (isPostgresConfigured()) {
    try {
      return await pg.pgDeleteCampaign(id);
    } catch {
      return { success: false, error: "شناسه کمپین نامعتبر است یا حذف ممکن نیست" };
    }
  }
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      campaigns: store.campaigns.filter((c) => c.id !== id),
      billboards: store.billboards.filter((b) => b.campaignId !== id),
      posterCategories: store.posterCategories.filter((c) => c.campaignId !== id),
      posters: store.posters.filter((p) => p.campaignId !== id),
      videoCategories: store.videoCategories.filter((c) => c.campaignId !== id),
      videos: store.videos.filter((v) => v.campaignId !== id),
      analytics: store.analytics.filter((a) => a.campaignId !== id),
      submissions: store.submissions.filter((s) => s.campaignId !== id),
      files: (store.files ?? []).filter((file) => file.campaignId !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function updateCampaignSettings(data: Partial<CampaignSettings>) {
  if (isPostgresConfigured()) return pg.pgUpdateCampaignSettings(data);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      campaigns: store.campaigns.map((c) =>
        c.id === data.id ? { ...c, ...data, updatedAt: new Date().toISOString() } as CampaignSettings : c
      ),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveBillboard(data: Partial<Billboard> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveBillboard(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      if (data.id) {
        return {
          ...store,
          billboards: store.billboards.map((b) =>
            b.id === data.id ? { ...b, ...data, updatedAt: now } as Billboard : b
          ),
        };
      }
      const campaignBillboards = store.billboards.filter((b) => b.campaignId === data.campaignId);
      const newItem: Billboard = {
        id: generateId(),
        campaignId: data.campaignId ?? "",
        title: data.title ?? "",
        description: data.description,
        city: data.city ?? "",
        location: data.location ?? "",
        date: data.date ?? now.split("T")[0],
        thumbnailUrl: data.thumbnailUrl ?? "",
        externalUrl: data.externalUrl ?? "",
        status: data.status ?? "draft",
        tags: data.tags ?? [],
        notes: data.notes,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? campaignBillboards.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      return { ...store, billboards: [...store.billboards, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteBillboard(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteBillboard(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      billboards: store.billboards.filter((b) => b.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveMediaCategory(data: Partial<MediaCategory> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveMediaCategory(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      const key = data.type === "video" ? "videoCategories" : "posterCategories";
      const list = store[key].filter((c) => c.campaignId === data.campaignId);
      if (data.id) {
        return {
          ...store,
          [key]: list.map((c) => (c.id === data.id ? { ...c, ...data } as MediaCategory : c)),
        };
      }
      const newItem: MediaCategory = {
        id: generateId(),
        campaignId: data.campaignId ?? "",
        type: data.type ?? "poster",
        title: data.title ?? "",
        description: data.description,
        sortOrder: data.sortOrder ?? list.length + 1,
        published: data.published ?? false,
        createdAt: now,
      };
      return { ...store, [key]: [...list, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteMediaCategory(id: string, type: "poster" | "video") {
  if (isPostgresConfigured()) return pg.pgDeleteMediaCategory(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      const key = type === "video" ? "videoCategories" : "posterCategories";
      return { ...store, [key]: store[key].filter((c) => c.id !== id) };
    });
    return { success: true };
  }
  return { success: true };
}

export async function savePoster(data: Partial<Poster> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSavePoster(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      if (data.id) {
        return {
          ...store,
          posters: store.posters.map((p) =>
            p.id === data.id ? { ...p, ...data, updatedAt: now } as Poster : p
          ),
        };
      }
      const campaignPosters = store.posters.filter((p) => p.campaignId === data.campaignId);
      const newItem: Poster = {
        id: data.id ?? generateId(),
        campaignId: data.campaignId ?? "",
        categoryId: data.categoryId ?? "",
        title: data.title ?? "",
        description: data.description,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? campaignPosters.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      return { ...store, posters: [...store.posters, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deletePoster(id: string) {
  if (isPostgresConfigured()) return pg.pgDeletePoster(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      posters: store.posters.filter((p) => p.id !== id),
      posterVersions: store.posterVersions.filter((v) => v.posterId !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function savePosterVersion(data: Partial<PosterVersion> & { id?: string; posterId: string }) {
  if (isPostgresConfigured()) return pg.pgSavePosterVersion(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      let versions = [...store.posterVersions];
      if (data.isFinal) {
        versions = versions.map((v) =>
          v.posterId === data.posterId
            ? {
                ...v,
                isFinal: false,
                status: v.status === "final" ? "revised" : v.status,
              }
            : v
        );
      }
      if (data.id) {
        return {
          ...store,
          posterVersions: versions.map((v) =>
            v.id === data.id ? { ...v, ...data } as PosterVersion : v
          ),
        };
      }
      const posterVersions = versions.filter((v) => v.posterId === data.posterId);
      const nextVersionNumber = data.versionNumber ?? posterVersions.length + 1;
      const newItem: PosterVersion = {
        id: generateId(),
        posterId: data.posterId,
        versionNumber: nextVersionNumber,
        imageUrl: data.imageUrl ?? "",
        thumbnailUrl: data.thumbnailUrl ?? data.imageUrl ?? "",
        notes: data.notes,
        status: data.isFinal ? "final" : (data.status ?? "draft"),
        isFinal: Boolean(data.isFinal),
        date: data.date ?? now.split("T")[0],
        createdAt: now,
      };
      return { ...store, posterVersions: [...versions, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deletePosterVersion(id: string) {
  if (isPostgresConfigured()) return pg.pgDeletePosterVersion(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      posterVersions: store.posterVersions.filter((v) => v.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveVideo(data: Partial<Video> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveVideo(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      if (data.id) {
        return {
          ...store,
          videos: store.videos.map((v) =>
            v.id === data.id ? { ...v, ...data, updatedAt: now } as Video : v
          ),
        };
      }
      const campaignVideos = store.videos.filter((v) => v.campaignId === data.campaignId);
      const newItem: Video = {
        id: generateId(),
        campaignId: data.campaignId ?? "",
        categoryId: data.categoryId ?? "",
        title: data.title ?? "",
        description: data.description,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? campaignVideos.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      return { ...store, videos: [...store.videos, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteVideo(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteVideo(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      videos: store.videos.filter((v) => v.id !== id),
      videoVersions: store.videoVersions.filter((vv) => vv.videoId !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveVideoVersion(data: Partial<VideoVersion> & { id?: string; videoId: string }) {
  if (isPostgresConfigured()) return pg.pgSaveVideoVersion(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      let versions = [...store.videoVersions];
      if (data.isFinal) {
        versions = versions.map((v) =>
          v.videoId === data.videoId
            ? {
                ...v,
                isFinal: false,
                status: v.status === "final" ? "revised" : v.status,
              }
            : v
        );
      }
      if (data.id) {
        return {
          ...store,
          videoVersions: versions.map((v) =>
            v.id === data.id ? { ...v, ...data } as VideoVersion : v
          ),
        };
      }
      const videoVersions = versions.filter((v) => v.videoId === data.videoId);
      const nextVersionNumber = data.versionNumber ?? videoVersions.length + 1;
      const newItem: VideoVersion = {
        id: generateId(),
        videoId: data.videoId,
        versionNumber: nextVersionNumber,
        videoUrl: data.videoUrl ?? "",
        thumbnailUrl: data.thumbnailUrl ?? "",
        duration: data.duration,
        notes: data.notes,
        status: data.isFinal ? "final" : (data.status ?? "draft"),
        isFinal: Boolean(data.isFinal),
        date: data.date ?? now.split("T")[0],
        createdAt: now,
      };
      return { ...store, videoVersions: [...versions, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteVideoVersion(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteVideoVersion(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      videoVersions: store.videoVersions.filter((v) => v.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveAnalyticsMetric(data: Partial<AnalyticsMetric> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveAnalyticsMetric(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => {
      if (data.id) {
        return {
          ...store,
          analytics: store.analytics.map((a) =>
            a.id === data.id ? { ...a, ...data } as AnalyticsMetric : a
          ),
        };
      }
      const newItem: AnalyticsMetric = {
        id: generateId(),
        campaignId: data.campaignId ?? "",
        channel: data.channel ?? "site",
        date: data.date ?? now.split("T")[0],
        visitors: data.visitors ?? 0,
        uniqueVisitors: data.uniqueVisitors ?? 0,
        pageViews: data.pageViews ?? 0,
        avgSessionDuration: data.avgSessionDuration ?? 0,
        source: data.source,
        device: data.device,
        page: data.page,
        city: data.city,
        createdAt: now,
      };
      return { ...store, analytics: [...store.analytics, newItem] };
    });
    return { success: true };
  }
  return { success: true };
}

export async function deleteAnalyticsMetric(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteAnalyticsMetric(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      analytics: store.analytics.filter((a) => a.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function updateSubmission(
  id: string,
  data: Partial<CampaignSubmission>
) {
  if (isPostgresConfigured()) return pg.pgUpdateSubmission(id, data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      submissions: store.submissions.map((s) =>
        s.id === id ? { ...s, ...data, updatedAt: now } as CampaignSubmission : s
      ),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function deleteSubmission(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteSubmission(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      submissions: store.submissions.filter((s) => s.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function importSubmissionsFromExcel(
  campaignId: string,
  rows: ParsedSubmissionRow[],
  ownerUserId?: string | null
) {
  if (isPostgresConfigured()) {
    return pg.pgBulkImportSubmissions(campaignId, rows, ownerUserId);
  }

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;

    updateMockStore((store) => {
      const nextSubmissions = [...store.submissions];

      for (const row of rows) {
        const existingIndex = nextSubmissions.findIndex(
          (item) => item.campaignId === campaignId && item.externalUuid === row.externalUuid
        );

        const payload: CampaignSubmission = {
          id: existingIndex >= 0 ? nextSubmissions[existingIndex].id : generateId(),
          campaignId,
          externalUuid: row.externalUuid,
          submissionType: row.submissionType,
          participantName: row.participantName,
          participantPhone: row.participantPhone ?? null,
          participantEmail: null,
          title: row.title,
          text: row.text,
          mediaUrl: row.mediaUrl ?? null,
          status: row.status,
          published: row.published,
          ownerUserId: ownerUserId ?? null,
          createdAt: row.createdAt,
          updatedAt: now,
        };

        if (existingIndex >= 0) {
          nextSubmissions[existingIndex] = payload;
          updated += 1;
        } else {
          nextSubmissions.push(payload);
          created += 1;
        }
      }

      return { ...store, submissions: nextSubmissions };
    });

    return { created, updated, total: rows.length };
  }

  return { created: 0, updated: 0, total: rows.length };
}

export async function saveCampaignFile(data: Partial<CampaignFile> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveCampaignFile(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const newId = data.id ?? generateId();
    updateMockStore((store) => {
      const campaignFiles = (store.files ?? []).filter((file) => file.campaignId === data.campaignId);
      if (data.id) {
        return {
          ...store,
          files: (store.files ?? []).map((file) =>
            file.id === data.id ? { ...file, ...data, updatedAt: now } as CampaignFile : file
          ),
        };
      }
      const newItem: CampaignFile = {
        id: newId,
        campaignId: data.campaignId ?? "",
        title: data.title ?? "",
        description: data.description,
        fileUrl: data.fileUrl ?? "",
        fileName: data.fileName ?? "",
        mimeType: data.mimeType ?? "application/octet-stream",
        fileSize: data.fileSize ?? 0,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? campaignFiles.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      return { ...store, files: [...(store.files ?? []), newItem] };
    });
    return { success: true, id: newId };
  }
  return { success: true };
}

export async function deleteCampaignFile(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteCampaignFile(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      files: (store.files ?? []).filter((file) => file.id !== id),
    }));
    return { success: true };
  }
  return { success: true };
}

export async function saveRawMediaUpload(data: Partial<RawMediaUpload> & { id?: string }) {
  if (isPostgresConfigured()) return pg.pgSaveRawMediaUpload(data);
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const newId = data.id ?? generateId();
    updateMockStore((store) => {
      const campaignItems = ((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? []).filter(
        (item) => item.campaignId === data.campaignId
      );
      if (data.id) {
        return {
          ...store,
          rawMedia: ((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? []).map((item) =>
            item.id === data.id ? ({ ...item, ...data, updatedAt: now } as RawMediaUpload) : item
          ),
        };
      }
      const newItem: RawMediaUpload = {
        id: newId,
        campaignId: data.campaignId ?? "",
        title: data.title ?? "",
        description: data.description,
        mediaKind: data.mediaKind ?? "image",
        fileUrl: data.fileUrl ?? "",
        fileName: data.fileName ?? "",
        mimeType: data.mimeType ?? "application/octet-stream",
        fileSize: data.fileSize ?? 0,
        published: data.published ?? true,
        sortOrder: data.sortOrder ?? campaignItems.length + 1,
        planLabel: data.planLabel ?? null,
        ownerUserId: data.ownerUserId ?? null,
        ownerName: data.ownerName ?? null,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...store,
        rawMedia: [...((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? []), newItem],
      };
    });
    return { success: true, id: newId };
  }
  return { success: true };
}

export async function deleteRawMediaUpload(id: string) {
  if (isPostgresConfigured()) return pg.pgDeleteRawMediaUpload(id);
  if (!isSupabaseConfigured()) {
    updateMockStore((store) => ({
      ...store,
      rawMedia: ((store as { rawMedia?: RawMediaUpload[] }).rawMedia ?? []).filter(
        (item) => item.id !== id
      ),
    }));
    return { success: true };
  }
  return { success: true };
}
