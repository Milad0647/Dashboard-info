"use client";

import { ActivitiesSection } from "@/components/public/activities-section";
import { pressPublicationHasDisplayContent } from "@/lib/public-media-section";
import type { CampaignActivity, DataOwnerGroup } from "@/lib/types";

interface PressPublicationsSectionProps {
  publications: CampaignActivity[];
  groups: DataOwnerGroup<CampaignActivity>[];
}

export function PressPublicationsSection({ publications, groups }: PressPublicationsSectionProps) {
  return (
    <ActivitiesSection
      activities={publications}
      groups={groups}
      sectionId="press-publications"
      title="مجله و روزنامه"
      description="آگهی‌های مجله و روزنامه"
      hasDisplayContent={pressPublicationHasDisplayContent}
    />
  );
}
