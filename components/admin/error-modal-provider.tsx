"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ERROR_SOLUTION_CATEGORY_LABELS,
  type ResolvedErrorInfo,
} from "@/lib/error-solutions";
import { emitUiError, UI_ERROR_EVENT, type UiErrorEventDetail } from "@/lib/ui-error-bus";

/**
 * Listens for UI errors and shows a modal with problem + suggested fix.
 * Also reports to rasad via AuditTracker (toast.error / window hooks).
 */
export function ErrorModalProvider() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ResolvedErrorInfo | null>(null);

  useEffect(() => {
    const onError = (event: Event) => {
      const custom = event as CustomEvent<UiErrorEventDetail>;
      const next = custom.detail?.info;
      if (!next) return;
      setInfo(next);
      setOpen(true);
    };

    window.addEventListener(UI_ERROR_EVENT, onError);
    return () => window.removeEventListener(UI_ERROR_EVENT, onError);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="space-y-3 border-b bg-destructive/5 px-6 py-5 pr-12 text-right">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-destructive">
                  {info?.title ?? "خطا"}
                </DialogTitle>
                {info ? (
                  <Badge variant="outline" className="text-[10px]">
                    {ERROR_SOLUTION_CATEGORY_LABELS[info.category]}
                  </Badge>
                ) : null}
              </div>
              <DialogDescription>
                این خطا به‌صورت خودکار در بخش رصد برای ادمین ثبت می‌شود.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5 text-right">
          <section className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              مشکل چیست؟
            </p>
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm leading-relaxed">
              {info?.problem}
            </p>
            {info?.message && info.message !== info.problem ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                جزئیات: {info.message}
              </p>
            ) : null}
          </section>

          <section className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              راهکار پیشنهادی
            </p>
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-sm leading-relaxed">
              {info?.solution}
            </p>
          </section>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-start gap-2">
          {info?.message &&
          /Server Action|failed-to-find-server-action|was not found on the server|unexpected response was received from the server|Minified React error #418|Hydration failed/i.test(
            info.message
          ) ? (
            <Button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
            >
              بارگذاری مجدد
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            متوجه شدم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Convenience for calling sites that want an explicit modal without toast. */
export function showErrorModal(info: ResolvedErrorInfo, source = "manual") {
  emitUiError({ info, source });
}
