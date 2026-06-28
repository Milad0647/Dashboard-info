"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { CalendarDays, Lock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MeetingPublicDetail, MeetingPublicPreview } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

interface MeetingDetailDialogProps {
  preview: MeetingPublicPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cachedDetail?: MeetingPublicDetail | null;
  onDetailLoaded?: (meeting: MeetingPublicDetail) => void;
}

export function MeetingDetailDialog({
  preview,
  open,
  onOpenChange,
  cachedDetail,
  onDetailLoaded,
}: MeetingDetailDialogProps) {
  const [password, setPassword] = useState("");
  const [detail, setDetail] = useState<MeetingPublicDetail | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !preview) {
      setPassword("");
      setDetail(null);
      setNeedsPassword(false);
      return;
    }

    if (cachedDetail) {
      setDetail(cachedDetail);
      setNeedsPassword(false);
      return;
    }

    if (!preview.hasPassword) {
      startTransition(async () => {
        const response = await fetch(`/api/meetings/${preview.id}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "" }),
        });
        if (!response.ok) {
          toast.error("بارگذاری جزئیات ناموفق بود");
          return;
        }
        const data = (await response.json()) as { meeting: MeetingPublicDetail };
        setDetail(data.meeting);
        onDetailLoaded?.(data.meeting);
        setNeedsPassword(false);
      });
      return;
    }

    setNeedsPassword(true);
    setDetail(null);
  }, [open, preview, cachedDetail, onDetailLoaded]);

  const handleUnlock = () => {
    if (!preview) return;

    startTransition(async () => {
      const response = await fetch(`/api/meetings/${preview.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        toast.error("رمز اشتباه است");
        return;
      }

      if (!response.ok) {
        toast.error("دسترسی به جزئیات ممکن نشد");
        return;
      }

      const data = (await response.json()) as { meeting: MeetingPublicDetail };
      setDetail(data.meeting);
      onDetailLoaded?.(data.meeting);
      setNeedsPassword(false);
      toast.success("جزئیات جلسه نمایش داده شد");
    });
  };

  if (!preview) return null;

  const completedCount = detail?.tasks.filter((task) => task.completed).length ?? 0;
  const totalTasks = detail?.tasks.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preview.title}</DialogTitle>
        </DialogHeader>

        {needsPassword && !detail ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              برای مشاهده جزئیات جلسه، رمز را وارد کنید.
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-password">رمز مشاهده</Label>
              <Input
                id="meeting-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleUnlock();
                }}
              />
            </div>
            <Button onClick={handleUnlock} disabled={isPending || !password.trim()} className="w-full">
              نمایش جزئیات
            </Button>
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {detail.imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={detail.imageUrl}
                  alt={detail.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatPersianDate(detail.meetingDate)}
              </span>
              {detail.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {detail.location}
                </span>
              )}
            </div>

            {detail.attendees.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  حاضرین جلسه
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.attendees.map((name) => (
                    <span key={name} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.discussionSummary && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{detail.discussionSummary}</p>
            )}

            {detail.audioUrl && (
              <div className="space-y-2">
                <Label>فایل صوتی جلسه</Label>
                <audio src={detail.audioUrl} controls className="w-full" preload="metadata" />
              </div>
            )}

            {totalTasks > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">مصوبات</h4>
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{totalTasks} انجام‌شده
                  </span>
                </div>
                <ul className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  {detail.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2 text-sm">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                          task.completed
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        )}
                        aria-hidden
                      >
                        {task.completed ? "✓" : ""}
                      </span>
                      <span className={cn(task.completed && "line-through text-muted-foreground")}>
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.decisions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">تصمیم‌های جلسه</h4>
                <ul className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  {detail.decisions.map((decision) => (
                    <li key={decision.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{decision.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
