"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSubmissionAction,
  resubmitSubmissionAction,
} from "@/lib/actions/admin-actions";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import type { CampaignSubmission } from "@/lib/types";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface RejectedSubmissionsInboxProps {
  initialItems: CampaignSubmission[];
  onCountChange?: (count: number) => void;
}

export function RejectedSubmissionsInbox({
  initialItems,
  onCountChange,
}: RejectedSubmissionsInboxProps) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<CampaignSubmission | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const openEdit = (item: CampaignSubmission) => {
    setEditing(item);
    setTitle(item.title);
    setText(item.text);
    setMediaUrl(item.mediaUrl ?? "");
  };

  const closeEdit = () => {
    setEditing(null);
    setTitle("");
    setText("");
    setMediaUrl("");
  };

  const handleResubmit = () => {
    if (!editing) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("عنوان الزامی است");
      return;
    }
    if (nextTitle.length > CONTENT_TITLE_MAX_LENGTH) {
      toast.error(CONTENT_TITLE_MAX_LENGTH_MESSAGE);
      return;
    }

    startTransition(async () => {
      const result = await resubmitSubmissionAction(editing.id, {
        title: nextTitle,
        text: text.trim(),
        mediaUrl: mediaUrl.trim() || null,
      });
      if (!result.success) {
        toast.error("error" in result && result.error ? String(result.error) : "ارسال مجدد ناموفق بود");
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== editing.id));
      toast.success("برای بررسی مجدد ارسال شد");
      closeEdit();
    });
  };

  const handleDelete = (item: CampaignSubmission) => {
    if (!window.confirm("این مشارکت ردشده حذف شود؟")) return;
    startTransition(async () => {
      const result = await deleteSubmissionAction(item.id);
      if (!result?.success) {
        toast.error(
          result && "error" in result && result.error
            ? String(result.error)
            : "حذف ناموفق بود"
        );
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (editing?.id === item.id) closeEdit();
      toast.success("حذف شد");
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        مشارکت ردشده‌ای ندارید
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{item.title}</h2>
                  <Badge variant="destructive">رد شده</Badge>
                </div>
                {item.submissionType && (
                  <p className="text-xs text-muted-foreground">{item.submissionType}</p>
                )}
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.text?.trim() || "بدون متن"}
                </p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive">دلیل رد ادمین</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {item.rejectionReason?.trim() || "دلیلی ثبت نشده است"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  بروزرسانی: {formatPersianDateTime(item.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-4 w-4" />
                  ویرایش و ارسال مجدد
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش و ارسال مجدد</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
                <p className="text-xs font-medium text-destructive">دلیل رد</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {editing.rejectionReason?.trim() || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resubmit-title">عنوان</Label>
                <Input
                  id="resubmit-title"
                  value={title}
                  maxLength={CONTENT_TITLE_MAX_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  حداکثر {formatPersianNumber(CONTENT_TITLE_MAX_LENGTH)} کاراکتر
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resubmit-text">متن</Label>
                <Textarea
                  id="resubmit-text"
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resubmit-media">آدرس رسانه (اختیاری)</Label>
                <Input
                  id="resubmit-media"
                  dir="ltr"
                  className="text-left"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={isPending}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" disabled={isPending} onClick={closeEdit}>
                  انصراف
                </Button>
                <Button type="button" disabled={isPending} onClick={handleResubmit}>
                  <Send className="h-4 w-4" />
                  ارسال مجدد برای بررسی
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
