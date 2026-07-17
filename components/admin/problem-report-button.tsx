"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitProblemReportAction } from "@/lib/actions/problem-report-actions";
import {
  PROBLEM_REPORT_CATEGORY_LABELS,
  type ProblemReportCategory,
} from "@/lib/audit/problem-types";

const CATEGORIES = Object.keys(PROBLEM_REPORT_CATEGORY_LABELS) as ProblemReportCategory[];

export function ProblemReportButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ProblemReportCategory>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("other");
    setTitle("");
    setDescription("");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const campaignId = searchParams.get("campaign");
      const query = searchParams.toString();
      const path = query ? `${pathname}?${query}` : pathname;

      const result = await submitProblemReportAction({
        category,
        title,
        description,
        path,
        campaignId,
      });

      if (!result.success) {
        toast.error(result.error ?? "ارسال گزارش ناموفق بود");
        return;
      }

      toast.success("گزارش مشکل ثبت شد. ادمین رسیدگی می‌کند.");
      setOpen(false);
      reset();
    } catch {
      toast.error("ارسال گزارش با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed bottom-5 left-5 z-[80] gap-2 shadow-md lg:left-6"
        data-audit-label="گزارش مشکل"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        گزارش مشکل
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>گزارش مشکل</DialogTitle>
            <DialogDescription>
              اگر جایی گیر کردید یا خطایی دیدید، اینجا بنویسید تا ادمین در بخش رصد کاربران
              رسیدگی کند.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">نوع مشکل</label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ProblemReportCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نوع مشکل" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {PROBLEM_REPORT_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">عنوان کوتاه</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثلاً: دکمه ذخیره کار نمی‌کند"
                maxLength={160}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">توضیح مشکل</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="چه کاری می‌خواستید انجام دهید و چه اتفاقی افتاد؟"
                className="min-h-[120px]"
                maxLength={4000}
              />
            </div>

            <p className="text-xs text-muted-foreground" dir="ltr">
              صفحه فعلی: {pathname}
              {searchParams.toString() ? `?${searchParams.toString()}` : ""}
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              انصراف
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting} data-audit-label="ارسال گزارش مشکل">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ارسال…
                </>
              ) : (
                "ارسال گزارش"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
