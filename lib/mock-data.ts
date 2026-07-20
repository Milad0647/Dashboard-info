import type {
  AnalyticsMetric,
  Billboard,
  CampaignSettings,
  CampaignSubmission,
  MediaCategory,
  Poster,
  PosterVersion,
  Video,
  VideoVersion,
} from "./types";

const now = new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

const fullFeatures = {
  billboards: true,
  posters: true,
  videos: true,
  analytics: true,
  socialAnalytics: true,
  socialPosts: true,
  sitePublications: true,
  broadcastReports: true,
  meetings: true,
  activities: true,
  pressPublications: true,
  submissions: true,
  files: true,
  rawMedia: true,
};

const defaultAnalyticsConfig = {
  site: { source: "manual" as const, metabase: null },
  social: { source: "manual" as const, metabase: null },
};

export const mockCampaigns: CampaignSettings[] = [
  {
    id: "campaign-1",
    slug: "summer-1404",
    title: "کمپین تابستانی ۱۴۰۴",
    description:
      "گزارش زنده پیشرفت کمپین تبلیغاتی تابستانی شامل بیلبورد، پوستر، ویدیو، آمار سایت و مشارکت کاربران.",
    status: "live",
    startDate: "2025-03-21",
    endDate: "2025-06-21",
    coverImageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop",
    published: true,
    features: fullFeatures,
    analyticsConfig: defaultAnalyticsConfig,
    billboardConfig: {},
    scoringRules: {},
    updatedAt: now,
  },
  {
    id: "campaign-2",
    slug: "billboard-winter",
    title: "کمپین بیلبورد زمستانه",
    description: "کمپین فقط بیلبورد و پوستر — بدون سایت و مشارکت کاربران.",
    status: "live",
    startDate: "2025-01-01",
    endDate: "2025-03-20",
    coverImageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=400&fit=crop",
    published: true,
    features: {
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
    analyticsConfig: defaultAnalyticsConfig,
    billboardConfig: {},
    scoringRules: {},
    updatedAt: now,
  },
  {
    id: "campaign-3",
    slug: "social-reels",
    title: "کمپین شبکه‌های اجتماعی",
    description: "فقط پوستر و ویدیو برای شبکه‌های اجتماعی.",
    status: "completed",
    startDate: "2024-12-01",
    endDate: "2025-02-28",
    coverImageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=400&fit=crop",
    published: true,
    features: {
      billboards: false,
      posters: true,
      videos: true,
      analytics: false,
      socialAnalytics: true,
      socialPosts: true,
      sitePublications: false,
      broadcastReports: false,
      meetings: false,
      activities: false,
      pressPublications: false,
      submissions: false,
      files: false,
      rawMedia: false,
    },
    analyticsConfig: defaultAnalyticsConfig,
    billboardConfig: {},
    scoringRules: {},
    updatedAt: now,
  },
];

export const mockBillboards: Billboard[] = [
  {
    id: "bb-1",
    campaignId: "campaign-1",
    title: "بیلبورد میدان ونک",
    description: "نصب در محور اصلی شمال تهران",
    city: "تهران",
    location: "میدان ونک، خیابان ملاصدرا",
    date: "2025-04-10",
    thumbnailUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=900&fit=crop",
    externalUrl: "https://www.google.com/maps?q=35.7575,51.41",
    latitude: 35.7575,
    longitude: 51.41,
    source: "manual",
    status: "completed",
    tags: ["شمال", "اصلی"],
    notes: "نصب با موفقیت انجام شد",
    published: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bb-2",
    campaignId: "campaign-1",
    title: "بیلبورد بلوار کشاورز",
    city: "تهران",
    location: "بلوار کشاورز",
    date: "2025-04-15",
    thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=900&fit=crop",
    externalUrl: "https://www.google.com/maps?q=35.709,51.398",
    latitude: 35.709,
    longitude: 51.398,
    source: "manual",
    status: "completed",
    tags: ["مرکز"],
    published: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "bb-3",
    campaignId: "campaign-2",
    title: "بیلبورد چهارراه عباس‌آباد",
    city: "مشهد",
    location: "چهارراه عباس‌آباد",
    date: "2025-02-10",
    thumbnailUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop",
    externalUrl: "https://example.com/billboard/3",
    status: "completed",
    tags: ["شرق"],
    published: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
];

export const mockPosterCategories: MediaCategory[] = [
  { id: "pc-1", campaignId: "campaign-1", type: "poster", title: "پوستر اصلی", sortOrder: 1, published: true, createdAt: now },
  { id: "pc-2", campaignId: "campaign-1", type: "poster", title: "پوستر استوری", sortOrder: 2, published: true, createdAt: now },
  { id: "pc-3", campaignId: "campaign-2", type: "poster", title: "پوستر چاپی", sortOrder: 1, published: true, createdAt: now },
  { id: "pc-4", campaignId: "campaign-3", type: "poster", title: "پوستر شبکه اجتماعی", sortOrder: 1, published: true, createdAt: now },
];

export const mockPosters: Poster[] = [
  { id: "p-1", campaignId: "campaign-1", categoryId: "pc-1", title: "پوستر کمپین تابستان", description: "طراحی اصلی", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { id: "p-2", campaignId: "campaign-1", categoryId: "pc-2", title: "استوری معرفی محصول", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { id: "p-3", campaignId: "campaign-2", categoryId: "pc-3", title: "پوستر زمستانه", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { id: "p-4", campaignId: "campaign-3", categoryId: "pc-4", title: "پست اینستاگرام", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
];

export const mockPosterVersions: PosterVersion[] = [
  { id: "pv-1", posterId: "p-1", versionNumber: 1, imageUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=1000&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=250&fit=crop", notes: "نسخه اولیه", status: "draft", isFinal: false, date: "2025-03-25", createdAt: now },
  { id: "pv-2", posterId: "p-1", versionNumber: 2, imageUrl: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=1000&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&h=250&fit=crop", notes: "اصلاح رنگ", status: "revised", isFinal: false, date: "2025-04-01", createdAt: now },
  { id: "pv-3", posterId: "p-1", versionNumber: 3, imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&h=1000&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=200&h=250&fit=crop", notes: "نسخه نهایی", status: "final", isFinal: true, date: "2025-04-10", createdAt: now },
  { id: "pv-4", posterId: "p-2", versionNumber: 1, imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=700&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=175&fit=crop", notes: "استوری نهایی", status: "final", isFinal: true, date: "2025-04-05", createdAt: now },
  { id: "pv-5", posterId: "p-3", versionNumber: 1, imageUrl: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&h=1000&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&h=250&fit=crop", notes: "اولیه", status: "draft", isFinal: false, date: "2025-01-15", createdAt: now },
  { id: "pv-6", posterId: "p-3", versionNumber: 2, imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&h=1000&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=200&h=250&fit=crop", notes: "نهایی", status: "final", isFinal: true, date: "2025-02-01", createdAt: now },
  { id: "pv-7", posterId: "p-4", versionNumber: 1, imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=800&fit=crop", thumbnailUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=200&fit=crop", notes: "نسخه نهایی", status: "final", isFinal: true, date: "2025-01-20", createdAt: now },
];

export const mockVideoCategories: MediaCategory[] = [
  { id: "vc-1", campaignId: "campaign-1", type: "video", title: "ویدیو تیزر", sortOrder: 1, published: true, createdAt: now },
  { id: "vc-2", campaignId: "campaign-3", type: "video", title: "ریلز", sortOrder: 1, published: true, createdAt: now },
];

export const mockVideos: Video[] = [
  { id: "v-1", campaignId: "campaign-1", categoryId: "vc-1", title: "تیزر ۳۰ ثانیه‌ای", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { id: "v-2", campaignId: "campaign-3", categoryId: "vc-2", title: "ریلز معرفی", published: true, sortOrder: 1, createdAt: now, updatedAt: now },
];

export const mockVideoVersions: VideoVersion[] = [
  { id: "vv-1", videoId: "v-1", versionNumber: 1, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=225&fit=crop", duration: "0:30", notes: "اولیه", status: "draft", isFinal: false, date: "2025-03-28", createdAt: now },
  { id: "vv-2", videoId: "v-1", versionNumber: 2, videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b9?w=400&h=225&fit=crop", duration: "0:30", notes: "نهایی", status: "final", isFinal: true, date: "2025-04-12", createdAt: now },
  { id: "vv-3", videoId: "v-2", versionNumber: 1, videoUrl: "https://www.w3schools.com/html/movie.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1611162616305-c69b3fa7a162?w=400&h=225&fit=crop", duration: "0:15", notes: "نهایی", status: "final", isFinal: true, date: "2025-01-10", createdAt: now },
];

export const mockAnalyticsMetrics: AnalyticsMetric[] = Array.from({ length: 14 }, (_, i) => ({
  id: `am-site-${i}`,
  campaignId: "campaign-1",
  channel: "site" as const,
  date: daysAgo(13 - i),
  visitors: 800 + Math.floor(Math.random() * 400),
  uniqueVisitors: 600 + Math.floor(Math.random() * 300),
  pageViews: 1200 + Math.floor(Math.random() * 600),
  avgSessionDuration: 120 + Math.floor(Math.random() * 60),
  source: (["direct", "google", "referral", "other"] as const)[i % 4],
  device: (["mobile", "desktop", "tablet"] as const)[i % 3],
  page: ["/", "/about", "/contact", "/campaign"][i % 4],
  city: ["تهران", "مشهد", "اصفهان", "شیراز", "تبریز"][i % 5],
  createdAt: now,
}));

export const mockSocialPlatformStats: import("./types").SocialPlatformStat[] = [
  { id: "sps-1", campaignId: "campaign-1", platform: "instagram", followers: 125000, posts: 342, profileUrl: "https://instagram.com/", sortOrder: 1, createdAt: now, updatedAt: now },
  { id: "sps-2", campaignId: "campaign-1", platform: "telegram", followers: 48000, posts: 890, profileUrl: "https://t.me/", sortOrder: 2, createdAt: now, updatedAt: now },
  { id: "sps-3", campaignId: "campaign-1", platform: "x", followers: 22000, posts: 156, sortOrder: 3, createdAt: now, updatedAt: now },
  { id: "sps-4", campaignId: "campaign-1", platform: "aparat", followers: 15000, posts: 48, sortOrder: 4, createdAt: now, updatedAt: now },
];

export const mockSubmissions: CampaignSubmission[] = [
  {
    id: "sub-1",
    campaignId: "campaign-1",
    submissionType: "عکس با محصول",
    participantName: "علی محمدی",
    participantPhone: "09121234567",
    participantEmail: "ali@example.com",
    title: "عکس در پارک",
    text: "عکس گرفتم با محصول کمپین در پارک ملت",
    mediaUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop",
    status: "approved",
    published: true,
    createdAt: "2025-04-15T10:00:00Z",
    updatedAt: now,
  },
  {
    id: "sub-2",
    campaignId: "campaign-1",
    submissionType: "ویدیو کوتاه",
    participantName: "ناشناس",
    title: "ویدیو معرفی",
    text: "یک ویدیو کوتاه از تجربه استفاده از محصول",
    status: "approved",
    published: true,
    createdAt: "2025-04-18T14:30:00Z",
    updatedAt: now,
  },
];

let mockStore = {
  campaigns: [...mockCampaigns],
  billboards: [...mockBillboards],
  posterCategories: [...mockPosterCategories],
  posters: [...mockPosters],
  posterVersions: [...mockPosterVersions],
  videoCategories: [...mockVideoCategories],
  videos: [...mockVideos],
  videoVersions: [...mockVideoVersions],
  analytics: [...mockAnalyticsMetrics],
  socialPlatformStats: [...mockSocialPlatformStats],
  submissions: [...mockSubmissions],
  files: [] as import("./types").CampaignFile[],
  socialPosts: [] as import("./types").SocialMediaPost[],
  broadcastReports: [] as import("./types").BroadcastReport[],
  meetings: [] as import("./types").MeetingWithTasks[],
  activities: [] as import("./types").CampaignActivity[],
};

export function getMockStore() {
  return mockStore;
}

export function getMockStoreForCampaign(campaignId: string) {
  const store = getMockStore();
  return {
    campaigns: store.campaigns,
    settings: store.campaigns.find((c) => c.id === campaignId),
    billboards: store.billboards.filter((b) => b.campaignId === campaignId),
    posterCategories: store.posterCategories.filter((c) => c.campaignId === campaignId),
    posters: store.posters.filter((p) => p.campaignId === campaignId),
    posterVersions: store.posterVersions.filter((v) =>
      store.posters.filter((p) => p.campaignId === campaignId).some((p) => p.id === v.posterId)
    ),
    videoCategories: store.videoCategories.filter((c) => c.campaignId === campaignId),
    videos: store.videos.filter((v) => v.campaignId === campaignId),
    videoVersions: store.videoVersions.filter((v) =>
      store.videos.filter((vid) => vid.campaignId === campaignId).some((vid) => vid.id === v.videoId)
    ),
    analytics: store.analytics.filter((a) => a.campaignId === campaignId),
    submissions: store.submissions.filter((s) => s.campaignId === campaignId),
    files: store.files.filter((file) => file.campaignId === campaignId),
    socialPosts: store.socialPosts.filter((post) => post.campaignId === campaignId),
    broadcastReports: store.broadcastReports.filter((report) => report.campaignId === campaignId),
    socialPlatformStats: store.socialPlatformStats.filter((stat) => stat.campaignId === campaignId),
    meetings: store.meetings.filter((meeting) => meeting.campaignId === campaignId),
    activities: store.activities.filter((activity) => activity.campaignId === campaignId),
  };
}

export function resetMockStore() {
  mockStore = {
    campaigns: [...mockCampaigns],
    billboards: [...mockBillboards],
    posterCategories: [...mockPosterCategories],
    posters: [...mockPosters],
    posterVersions: [...mockPosterVersions],
    videoCategories: [...mockVideoCategories],
    videos: [...mockVideos],
    videoVersions: [...mockVideoVersions],
    analytics: [...mockAnalyticsMetrics],
    submissions: [...mockSubmissions],
    files: [],
    socialPosts: [],
    broadcastReports: [],
    meetings: [],
    activities: [],
    socialPlatformStats: [...mockSocialPlatformStats],
  };
}

export function updateMockStore(updater: (store: typeof mockStore) => typeof mockStore) {
  mockStore = updater(mockStore);
  return mockStore;
}
