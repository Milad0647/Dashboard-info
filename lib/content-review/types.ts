import type { ContentMessageContentType } from "@/lib/content-messages/types";

export type ReviewableContentType = Extract<
  ContentMessageContentType,
  "billboard" | "poster" | "video" | "activity" | "social_post" | "site_publication"
>;

export type ContentReviewStatus = "needs_revision" | "resubmitted" | "approved";

export interface ContentReview {
  id: string;
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
  status: ContentReviewStatus;
  rejectionReason: string | null;
  rejectedByUserId: string | null;
  rejectedAt: string | null;
  resubmittedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const REVIEWABLE_CONTENT_TYPES: ReviewableContentType[] = [
  "billboard",
  "poster",
  "video",
  "activity",
  "social_post",
  "site_publication",
];
