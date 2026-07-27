"use client";

import { Loader2, StickyNote, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createUserProfileNoteAction,
  deleteUserProfileNoteAction,
  listUserProfileNotesAction,
} from "@/lib/actions/user-profile-notes-actions";
import type { UserProfileNote } from "@/lib/user-profile-notes/types";
import { formatPersianDateTime } from "@/lib/utils";

function authorRoleLabel(role?: string | null): string {
  if (role === "admin") return "مدیر";
  if (role === "client") return "کارفرما";
  return "ناظر";
}

export function UserProfileNotesPanel({
  subjectUserId,
  subjectName,
  className,
}: {
  subjectUserId: string;
  subjectName?: string | null;
  className?: string;
}) {
  const [notes, setNotes] = useState<UserProfileNote[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setLoading(true);
    void listUserProfileNotesAction(subjectUserId).then((result) => {
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری یادداشت‌ها ناموفق بود");
        setNotes([]);
      } else {
        setNotes(result.notes ?? []);
      }
      setLoading(false);
    });
  }, [subjectUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = () => {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      toast.error("متن یادداشت حداقل ۳ کاراکتر باشد");
      return;
    }

    startTransition(async () => {
      const result = await createUserProfileNoteAction({
        subjectUserId,
        body: trimmed,
      });
      if (!result.success || !result.note) {
        toast.error(result.error ?? "ثبت یادداشت ناموفق بود");
        return;
      }
      setNotes((prev) => [result.note!, ...prev]);
      setBody("");
      toast.success("یادداشت ثبت شد");
    });
  };

  const handleDelete = (noteId: string) => {
    startTransition(async () => {
      const result = await deleteUserProfileNoteAction({ noteId });
      if (!result.success) {
        toast.error(result.error ?? "حذف یادداشت ناموفق بود");
        return;
      }
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast.success("یادداشت حذف شد");
    });
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          یادداشت‌های داخلی
          <Badge variant="outline">{notes.length.toLocaleString("fa-IR")} مورد</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          فقط مدیر و کارفرما این یادداشت‌ها را می‌بینند
          {subjectName?.trim() ? ` · درباره «${subjectName.trim()}»` : ""}.
          کاربر/شرکت از آن‌ها مطلع نمی‌شود.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="مثلاً: این شرکت در ارسال محتوا منظم است / نیاز به پیگیری تلفنی دارد…"
            rows={4}
            maxLength={4000}
            disabled={isPending}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {body.trim().length.toLocaleString("fa-IR")}/۴۰۰۰
            </p>
            <Button type="button" size="sm" disabled={isPending} onClick={handleCreate}>
              {isPending ? "در حال ثبت…" : "ثبت یادداشت"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بارگذاری یادداشت‌ها…
          </div>
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            هنوز یادداشتی ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-3 max-h-[360px] overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {note.authorName?.trim() || "ناظر"} · {authorRoleLabel(note.authorRole)} ·{" "}
                      {formatPersianDateTime(note.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleDelete(note.id)}
                    title="حذف یادداشت"
                    aria-label="حذف یادداشت"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
