"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { SocialPlatformIcon, getSocialPlatformLabel } from "@/components/public/social-platform-icon";
import {
  deleteSocialPlatformStatAction,
  saveSocialPlatformStatAction,
} from "@/lib/actions/extended-actions";
import type { SocialPlatform, SocialPlatformStat } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

const platformOptions: SocialPlatform[] = [
  "instagram",
  "telegram",
  "x",
  "youtube",
  "aparat",
  "linkedin",
  "rubika",
  "eitaa",
  "soroush",
  "bale",
  "other",
];

const schema = z.object({
  platform: z.enum([
    "instagram",
    "x",
    "telegram",
    "linkedin",
    "youtube",
    "aparat",
    "rubika",
    "eitaa",
    "soroush",
    "bale",
    "other",
  ]),
  title: z.string().optional(),
  followers: z.coerce.number().min(0),
  posts: z.coerce.number().min(0),
  profileUrl: z.string().optional(),
});

interface SocialAnalyticsAdminProps {
  campaignId: string;
  initialStats: SocialPlatformStat[];
  isFullAdmin?: boolean;
}

export function SocialAnalyticsAdmin({
  campaignId,
  initialStats,
  isFullAdmin = true,
}: SocialAnalyticsAdminProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialStats);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(initialStats);
  }, [initialStats]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: "instagram" as SocialPlatform,
      title: "",
      followers: 0,
      posts: 0,
      profileUrl: "",
    },
  });

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      platform: "instagram",
      title: "",
      followers: 0,
      posts: 0,
      profileUrl: "",
    });
    setOpen(true);
  };

  const openEdit = (stat: SocialPlatformStat) => {
    setEditingId(stat.id);
    form.reset({
      platform: stat.platform,
      title: stat.title ?? "",
      followers: stat.followers,
      posts: stat.posts,
      profileUrl: stat.profileUrl ?? "",
    });
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result = await saveSocialPlatformStatAction({
        ...data,
        title: data.title?.trim() || null,
        campaignId,
        id: editingId ?? undefined,
      });

      if (!result.success) {
        toast.error("error" in result && result.error ? result.error : "ذخیره نشد");
        return;
      }

      toast.success("ذخیره شد");
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">آمار صفحات شبکه‌های اجتماعی</h2>
          <p className="text-sm text-muted-foreground">
            {isFullAdmin
              ? "هر کاربر می‌تواند چند کانال ثبت کند (حتی چند کانال از یک پلتفرم)"
              : "می‌توانید چند کانال اضافه کنید — حتی چند کانال از یک پلتفرم"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          افزودن کانال
        </Button>
      </div>

      <AdminDataTable
        data={rows}
        searchKeys={["platform", "title", "profileUrl"]}
        columns={[
          {
            key: "platform",
            label: "کانال",
            render: (item) => (
              <div className="flex items-center gap-2">
                <SocialPlatformIcon platform={item.platform} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{getSocialPlatformLabel(item.platform)}</p>
                  {item.title?.trim() && (
                    <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                  )}
                </div>
              </div>
            ),
          },
          ...(isFullAdmin ? [adminOwnerTableColumn<SocialPlatformStat>()] : []),
          {
            key: "followers",
            label: "فالوور",
            render: (item) => formatPersianNumber(item.followers),
          },
          {
            key: "posts",
            label: "پست",
            render: (item) => formatPersianNumber(item.posts),
          },
        ]}
        onEdit={openEdit}
        onDelete={(item) => {
          startTransition(async () => {
            const result = await deleteSocialPlatformStatAction(item.id);
            if (!result.success) {
              toast.error("error" in result && result.error ? result.error : "حذف نشد");
              return;
            }
            setRows((prev) => prev.filter((row) => row.id !== item.id));
            toast.success("حذف شد");
            router.refresh();
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش کانال" : "کانال جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>پلتفرم</Label>
              <Select
                value={form.watch("platform")}
                onValueChange={(value) => form.setValue("platform", value as SocialPlatform)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {getSocialPlatformLabel(platform)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>نام کانال (اختیاری)</Label>
              <Input
                {...form.register("title")}
                placeholder="مثلاً کانال اصلی، کانال خبری، ..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تعداد فالوور</Label>
                <Input type="number" {...form.register("followers")} />
              </div>
              <div className="space-y-2">
                <Label>تعداد پست</Label>
                <Input type="number" {...form.register("posts")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>لینک صفحه (اختیاری)</Label>
              <Input {...form.register("profileUrl")} dir="ltr" placeholder="https://..." />
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
