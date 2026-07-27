import {
  BILLBOARD_CATEGORIES,
  billboardCategoryLabels,
} from "@/lib/billboard-categories";
import {
  formatPlanLabelDisplay,
  flattenTopicOptions,
  type ContentTopic,
} from "@/lib/content-topics";
import type { MediaCategory, ScoreableContentType } from "@/lib/types";

export type ScoreableFieldValueType = "text" | "select" | "number" | "date" | "media" | "boolean";

export interface ScoreableFieldOption {
  value: string;
  label: string;
}

export interface ScoreableFieldDef {
  key: string;
  label: string;
  valueType: ScoreableFieldValueType;
  /** Allowed rule kinds for this field. */
  kinds: Array<"filled" | "equals" | "range">;
  options?: ScoreableFieldOption[];
}

/** Campaign-scoped options for dynamic select fields (categories / topics). */
export interface ScoreableFieldsContext {
  contentTopics?: ContentTopic[];
  posterCategories?: MediaCategory[];
  videoCategories?: MediaCategory[];
}

const ACTIVITY_TYPE_OPTIONS: ScoreableFieldOption[] = [
  { value: "magazine", label: "مجله" },
  { value: "newspaper", label: "روزنامه" },
  { value: "tract", label: "تراکت" },
  { value: "booth", label: "غرفه" },
  { value: "field", label: "میدانی" },
  { value: "poetry", label: "شعر" },
  { value: "painting", label: "نقاشی" },
  { value: "exhibition", label: "نمایشگاه" },
  { value: "other", label: "سایر" },
];

const SOCIAL_PLATFORM_OPTIONS: ScoreableFieldOption[] = [
  { value: "instagram", label: "اینستاگرام" },
  { value: "telegram", label: "تلگرام" },
  { value: "x", label: "توییتر / X" },
  { value: "aparat", label: "آپارات" },
  { value: "youtube", label: "یوتیوب" },
  { value: "linkedin", label: "لینکدین" },
  { value: "eitaa", label: "ایتا" },
  { value: "bale", label: "بله" },
  { value: "rubika", label: "روبیکا" },
  { value: "soroush", label: "سروش" },
  { value: "other", label: "سایر" },
  { value: "site", label: "سایت" },
];

const SOCIAL_CONTENT_TYPE_OPTIONS: ScoreableFieldOption[] = [
  { value: "image", label: "تصویر" },
  { value: "text", label: "متن" },
  { value: "video", label: "ویدیو" },
  { value: "carousel", label: "کاروسل" },
  { value: "story", label: "استوری" },
  { value: "reel", label: "ریلز" },
  { value: "audio", label: "صوت" },
];

const BILLBOARD_CATEGORY_OPTIONS: ScoreableFieldOption[] = BILLBOARD_CATEGORIES.map((key) => ({
  value: key,
  label: billboardCategoryLabels[key],
}));

const commonTitleDesc: ScoreableFieldDef[] = [
  { key: "title", label: "عنوان", valueType: "text", kinds: ["filled"] },
  { key: "description", label: "توضیحات", valueType: "text", kinds: ["filled"] },
];

function mediaCategoryOptions(categories: MediaCategory[] | undefined): ScoreableFieldOption[] {
  return (categories ?? []).map((category) => ({
    value: category.id,
    label: category.title,
  }));
}

function contentTopicOptions(topics: ContentTopic[] | undefined): ScoreableFieldOption[] {
  return flattenTopicOptions(topics ?? []).map((value) => ({
    value,
    label: formatPlanLabelDisplay(value),
  }));
}

function categoryIdField(
  label: string,
  options: ScoreableFieldOption[]
): ScoreableFieldDef {
  if (options.length > 0) {
    return {
      key: "categoryId",
      label,
      valueType: "select",
      kinds: ["filled", "equals"],
      options,
    };
  }
  return {
    key: "categoryId",
    label,
    valueType: "text",
    kinds: ["filled"],
  };
}

function planLabelsField(options: ScoreableFieldOption[]): ScoreableFieldDef {
  if (options.length > 0) {
    return {
      key: "planLabels",
      label: "موضوع / طرح",
      valueType: "select",
      kinds: ["filled", "equals"],
      options,
    };
  }
  return {
    key: "planLabels",
    label: "موضوع / طرح",
    valueType: "text",
    kinds: ["filled"],
  };
}

function buildScoreableFields(
  context?: ScoreableFieldsContext
): Record<ScoreableContentType, ScoreableFieldDef[]> {
  const topicOptions = contentTopicOptions(context?.contentTopics);
  const posterCategoryOptions = mediaCategoryOptions(context?.posterCategories);
  const videoCategoryOptions = mediaCategoryOptions(context?.videoCategories);
  const planLabels = planLabelsField(topicOptions);

  return {
    billboard: [
      ...commonTitleDesc,
      { key: "province", label: "استان", valueType: "text", kinds: ["filled", "equals"] },
      { key: "city", label: "شهر", valueType: "text", kinds: ["filled", "equals"] },
      { key: "location", label: "موقعیت", valueType: "text", kinds: ["filled"] },
      { key: "date", label: "تاریخ", valueType: "date", kinds: ["filled", "range"] },
      {
        key: "category",
        label: "دسته‌بندی سازه",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: BILLBOARD_CATEGORY_OPTIONS,
      },
      { key: "areaSqm", label: "متراژ (متر مربع)", valueType: "number", kinds: ["filled", "range"] },
      { key: "thumbnailUrl", label: "تصویر بندانگشتی", valueType: "media", kinds: ["filled"] },
      { key: "imageUrl", label: "تصویر اصلی", valueType: "media", kinds: ["filled"] },
      { key: "tags", label: "برچسب‌ها", valueType: "text", kinds: ["filled"] },
      { key: "notes", label: "یادداشت", valueType: "text", kinds: ["filled"] },
      { key: "billboardTypeLabel", label: "نوع بیلبورد", valueType: "text", kinds: ["filled", "equals"] },
      { key: "providerName", label: "نام تأمین‌کننده", valueType: "text", kinds: ["filled"] },
      { key: "displayPeriods", label: "دوره‌های نمایش", valueType: "media", kinds: ["filled"] },
      planLabels,
    ],
    poster: [
      ...commonTitleDesc,
      categoryIdField("دسته‌بندی محتوا", posterCategoryOptions),
      planLabels,
    ],
    video: [
      ...commonTitleDesc,
      categoryIdField("دسته‌بندی محتوا", videoCategoryOptions),
      planLabels,
    ],
    file: [
      ...commonTitleDesc,
      { key: "fileUrl", label: "فایل", valueType: "media", kinds: ["filled"] },
      { key: "fileName", label: "نام فایل", valueType: "text", kinds: ["filled"] },
      planLabels,
    ],
    raw_media: [
      ...commonTitleDesc,
      {
        key: "mediaKind",
        label: "نوع رسانه",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: [
          { value: "image", label: "تصویر" },
          { value: "video", label: "ویدیو" },
        ],
      },
      { key: "fileUrl", label: "فایل", valueType: "media", kinds: ["filled"] },
      planLabels,
    ],
    social_post: [
      ...commonTitleDesc,
      {
        key: "platform",
        label: "پلتفرم",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: SOCIAL_PLATFORM_OPTIONS.filter((o) => o.value !== "site"),
      },
      {
        key: "contentType",
        label: "نوع محتوا",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: SOCIAL_CONTENT_TYPE_OPTIONS,
      },
      { key: "coverImageUrl", label: "کاور", valueType: "media", kinds: ["filled"] },
      { key: "mediaUrl", label: "رسانه", valueType: "media", kinds: ["filled"] },
      { key: "link", label: "لینک", valueType: "text", kinds: ["filled"] },
      { key: "publishedDate", label: "تاریخ انتشار", valueType: "date", kinds: ["filled", "range"] },
      { key: "views", label: "بازدید", valueType: "number", kinds: ["filled", "range"] },
      { key: "likes", label: "لایک", valueType: "number", kinds: ["filled", "range"] },
      planLabels,
    ],
    site_publication: [
      ...commonTitleDesc,
      {
        key: "contentType",
        label: "نوع محتوا",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: SOCIAL_CONTENT_TYPE_OPTIONS,
      },
      { key: "coverImageUrl", label: "کاور", valueType: "media", kinds: ["filled"] },
      { key: "mediaUrl", label: "رسانه", valueType: "media", kinds: ["filled"] },
      { key: "link", label: "لینک", valueType: "text", kinds: ["filled"] },
      { key: "publishedDate", label: "تاریخ انتشار", valueType: "date", kinds: ["filled", "range"] },
      planLabels,
    ],
    activity: [
      ...commonTitleDesc,
      {
        key: "activityType",
        label: "نوع اقدام",
        valueType: "select",
        kinds: ["filled", "equals"],
        options: ACTIVITY_TYPE_OPTIONS,
      },
      { key: "activityDate", label: "تاریخ", valueType: "date", kinds: ["filled", "range"] },
      { key: "location", label: "مکان", valueType: "text", kinds: ["filled"] },
      { key: "link", label: "لینک", valueType: "text", kinds: ["filled"] },
      { key: "imageUrl", label: "تصویر", valueType: "media", kinds: ["filled"] },
      { key: "videoUrl", label: "ویدیو", valueType: "media", kinds: ["filled"] },
      { key: "mediaItems", label: "رسانه‌ها", valueType: "media", kinds: ["filled"] },
      { key: "attachments", label: "پیوست‌ها", valueType: "media", kinds: ["filled"] },
      {
        key: "isCreative",
        label: "خلاقانه",
        valueType: "boolean",
        kinds: ["equals"],
        options: [
          { value: "true", label: "بله" },
          { value: "false", label: "خیر" },
        ],
      },
      planLabels,
    ],
    broadcast: [
      { key: "title", label: "عنوان", valueType: "text", kinds: ["filled"] },
      { key: "reportDate", label: "تاریخ گزارش", valueType: "date", kinds: ["filled", "range"] },
      { key: "pdfUrl", label: "فایل PDF/ویدیو", valueType: "media", kinds: ["filled"] },
      { key: "fileName", label: "نام فایل", valueType: "text", kinds: ["filled"] },
      planLabels,
    ],
    meeting: [
      { key: "title", label: "عنوان", valueType: "text", kinds: ["filled"] },
      { key: "meetingDate", label: "تاریخ جلسه", valueType: "date", kinds: ["filled", "range"] },
      { key: "location", label: "مکان", valueType: "text", kinds: ["filled"] },
      { key: "discussionSummary", label: "خلاصه بحث", valueType: "text", kinds: ["filled"] },
      { key: "attendees", label: "حاضران", valueType: "text", kinds: ["filled"] },
      { key: "imageUrl", label: "تصویر", valueType: "media", kinds: ["filled"] },
      { key: "audioUrl", label: "صوت", valueType: "media", kinds: ["filled"] },
      planLabels,
    ],
  };
}

export const SCOREABLE_CONTENT_TYPE_LABELS: Record<ScoreableContentType, string> = {
  billboard: "تبلیغات محیطی",
  poster: "پوسترها",
  video: "ویدیوها",
  file: "فایل‌ها",
  raw_media: "راش تصویر",
  social_post: "پست شبکه اجتماعی",
  site_publication: "انتشار در سایت",
  activity: "اقدامات",
  broadcast: "پخش صدا و سیما",
  meeting: "جلسات و مصوبات",
};

export function getScoreableFields(
  contentType: ScoreableContentType,
  context?: ScoreableFieldsContext
): ScoreableFieldDef[] {
  return buildScoreableFields(context)[contentType] ?? [];
}

export function getScoreableField(
  contentType: ScoreableContentType,
  fieldKey: string,
  context?: ScoreableFieldsContext
): ScoreableFieldDef | undefined {
  return getScoreableFields(contentType, context).find((f) => f.key === fieldKey);
}
