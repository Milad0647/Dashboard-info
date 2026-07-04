"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocialAnalyticsAdmin } from "@/components/admin/social-analytics-admin";
import { SocialPostsAdmin } from "@/components/admin/social-posts-admin";
import type { SocialMediaPost, SocialPlatformStat } from "@/lib/types";

interface SocialHubAdminProps {
  campaignId: string;
  initialPosts: SocialMediaPost[];
  initialPlatformStats: SocialPlatformStat[];
  isFullAdmin?: boolean;
}

export function SocialHubAdmin({
  campaignId,
  initialPosts,
  initialPlatformStats,
  isFullAdmin = true,
}: SocialHubAdminProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">شبکه‌های اجتماعی</h1>
        <p className="text-sm text-muted-foreground">
          آمار صفحات هر پلتفرم و ثبت پست‌های منتشرشده
        </p>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">آمار صفحات</TabsTrigger>
          <TabsTrigger value="posts">پست‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6">
          <SocialAnalyticsAdmin
            campaignId={campaignId}
            initialStats={initialPlatformStats}
            isFullAdmin={isFullAdmin}
          />
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <SocialPostsAdmin campaignId={campaignId} initialPosts={initialPosts} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
