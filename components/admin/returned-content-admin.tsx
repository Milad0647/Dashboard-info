"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  approveContentAction,
  resubmitContentForReviewAction,
} from "@/lib/actions/content-review-actions";
import type { ReviewableContentType } from "@/lib/content-review/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

type ReturnedContentItem = {
  reviewId: string;
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
  title: string;
  ownerName: string | null;
  ownerProvince: string | null;
  ownerCity: string | null;
  status: "needs_revision" | "resubmitted" | "approved";
  rejectionReason: string | null;
  updatedAt: string;
  adminPath: string;
};

const statusLabel: Record<ReturnedContentItem["status"], string> = {
  needs_revision: "برگشت برای ویرایش",
  resubmitted: "ارسال‌مجدد برای بررسی",
  approved: "تاییدشده",
};

export function ReturnedContentAdmin({
  campaignId,
  items,
  canManage,
}: {
  campaignId: string;
  items: ReturnedContentItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const groups = new Map<ReturnedContentItem["status"], ReturnedContentItem[]>();
    for (const item of items) {
      const list = groups.get(item.status) ?? [];
      list.push(item);
      groups.set(item.status, list);
    }
    return groups;
  }, [items]);

  const runApprove = (item: ReturnedContentItem) => {
    setPendingKey(item.reviewId);
    startTransition(async () => {
      const result = await approveContentAction({
        campaignId,
        contentType: item.contentType,
        contentId: item.contentId,
      });
      setPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "تایید محتوا ناموفق بود");
        return;
      }
      toast.success("محتوا تایید شد");
      router.refresh();
    });
  };

  const runResubmit = (item: ReturnedContentItem) => {
    setPendingKey(item.reviewId);
    startTransition(async () => {
      const result = await resubmitContentForReviewAction({
        campaignId,
        contentType: item.contentType,
        contentId: item.contentId,
      });
      setPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "ارسال مجدد ناموفق بود");
        return;
      }
      toast.success("برای بررسی مجدد ارسال شد");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">محتواهای برگشتی</h1>
        <p className="text-sm text-muted-foreground">
          مواردی که برای ویرایش برگشت داده شده‌اند یا توسط کاربر دوباره ارسال شده‌اند.
        </p>
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        تعداد کل: {formatPersianNumber(items.length)}
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          موردی برای پیگیری وجود ندارد.
        </div>
      ) : (
        <div className="space-y-3">
          {(["needs_revision", "resubmitted"] as const).map((status) =>
            (grouped.get(status) ?? []).map((item) => (
              <article key={item.reviewId} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {statusLabel[item.status]}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.contentType}
                      </Badge>
                    </div>
                    <h3 className="font-medium leading-snug">{item.title || "بدون عنوان"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.ownerName ?? "کاربر"}{" "}
                      {[item.ownerProvince, item.ownerCity].filter(Boolean).join(" / ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      آخرین بروزرسانی: {formatPersianDateTime(item.updatedAt)}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5" asChild>
                    <Link href={item.adminPath}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      ویرایش محتوا
                    </Link>
                  </Button>
                </div>
                {item.rejectionReason && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
                    دلیل برگشت: {item.rejectionReason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {canManage ? (
                    <Button
                      size="sm"
                      onClick={() => runApprove(item)}
                      disabled={isPending && pendingKey === item.reviewId}
                    >
                      تایید نهایی
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => runResubmit(item)}
                      disabled={isPending && pendingKey === item.reviewId}
                    >
                      ارسال مجدد برای بررسی
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
