"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import {
  generateCampaignPageAccessCodesAction,
  listCampaignPageAccessCodesAction,
  revokeCampaignPageAccessCodeAction,
} from "@/lib/actions/extended-actions";
import type { CampaignPageAccessCode } from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface CampaignPageAccessCodesAdminProps {
  campaignId: string;
}

interface GenerateFormValues {
  titleBase: string;
  count: string;
  expiresAt: string;
  maxUnlocks: string;
}

interface GeneratedPlaintext {
  id: string;
  title: string;
  password: string;
}

const statusLabels: Record<CampaignPageAccessCode["status"], string> = {
  active: "فعال",
  expired: "منقضی",
  exhausted: "اتمام سقف",
  revoked: "لغو شده",
};

export function CampaignPageAccessCodesAdmin({ campaignId }: CampaignPageAccessCodesAdminProps) {
  const [codes, setCodes] = useState<CampaignPageAccessCode[]>([]);
  const [generated, setGenerated] = useState<GeneratedPlaintext[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [expiresAt, setExpiresAt] = useState("");

  const form = useForm<GenerateFormValues>({
    defaultValues: {
      titleBase: "",
      count: "1",
      expiresAt: "",
      maxUnlocks: "",
    },
  });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const result = await listCampaignPageAccessCodesAction(campaignId);
    if (!result.success) {
      toast.error(result.error || "بارگذاری کدها ناموفق بود");
      setLoading(false);
      return;
    }
    setCodes(result.codes);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  const onGenerate = form.handleSubmit((data) => {
    startTransition(async () => {
      const count = Number(data.count);
      const maxRaw = data.maxUnlocks.trim();
      const result = await generateCampaignPageAccessCodesAction(campaignId, {
        titleBase: data.titleBase,
        count,
        expiresAt: expiresAt || null,
        maxUnlocks: maxRaw ? Number(maxRaw) : null,
      });

      if (!result.success) {
        toast.error(result.error || "تولید کد ناموفق بود");
        return;
      }

      setGenerated(
        result.codes.map((item) => ({
          id: item.id,
          title: item.title,
          password: item.password,
        }))
      );
      form.reset({ titleBase: data.titleBase, count: "1", expiresAt: "", maxUnlocks: "" });
      setExpiresAt("");
      toast.success(`${formatPersianNumber(result.codes.length)} کد ساخته شد`);
      await loadCodes();
    });
  });

  const revokeCode = (codeId: string) => {
    startTransition(async () => {
      const result = await revokeCampaignPageAccessCodeAction(campaignId, codeId);
      if (!result.success) {
        toast.error(result.error || "لغو کد ناموفق بود");
        return;
      }
      toast.success("کد لغو شد");
      await loadCodes();
    });
  };

  const copyPassword = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("رمز کپی شد");
    } catch {
      toast.error("کپی نشد");
    }
  };

  const copyAllGenerated = async () => {
    const text = generated.map((item) => `${item.title}: ${item.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("همه رمزها کپی شدند");
    } catch {
      toast.error("کپی نشد");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">کدهای دسترسی صفحه کمپین</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadCodes()}
          disabled={loading || isPending}
          aria-label="بروزرسانی لیست"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          می‌توانید چند کد با عنوان، تاریخ انقضا و سقف تعداد ورود بسازید و به افراد بدهید.
          رمز مشترک بالا همچنان کار می‌کند؛ هر کدام صفحه را باز می‌کند.
        </p>

        <form onSubmit={onGenerate} className="space-y-3 rounded-md border p-3">
          <div className="space-y-2">
            <Label htmlFor="access-code-title">عنوان پایه</Label>
            <Input
              id="access-code-title"
              placeholder="مثلاً مهمان رسانه"
              {...form.register("titleBase")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="access-code-count">تعداد</Label>
              <Input
                id="access-code-count"
                type="number"
                min={1}
                max={20}
                dir="ltr"
                className="text-left"
                {...form.register("count")}
              />
            </div>
            <div className="space-y-2">
              <Label>تاریخ انقضا (اختیاری)</Label>
              <PersianDateInput
                value={expiresAt}
                onChange={setExpiresAt}
                allowEmpty
                placeholder="بدون انقضا"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-code-max">سقف ورود (اختیاری)</Label>
              <Input
                id="access-code-max"
                type="number"
                min={1}
                placeholder="نامحدود"
                dir="ltr"
                className="text-left"
                {...form.register("maxUnlocks")}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            تولید کد
          </Button>
        </form>

        {generated.length > 0 && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                رمزها فقط همین یک‌بار نمایش داده می‌شوند — همین الان کپی کنید.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyAllGenerated()}>
                <Copy className="ml-1 h-3.5 w-3.5" />
                کپی همه
              </Button>
            </div>
            <ul className="space-y-2">
              {generated.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-3 py-2 text-sm"
                >
                  <span>{item.title}</span>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs" dir="ltr">
                      {item.password}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void copyPassword(item.password)}
                      aria-label="کپی رمز"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" onClick={() => setGenerated([])}>
              بستن لیست رمزها
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">کدهای موجود</h3>
          {loading && codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز کدی ساخته نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {codes.map((code) => (
                <li
                  key={code.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{code.title}</div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>وضعیت: {statusLabels[code.status]}</div>
                      <div>
                        انقضا:{" "}
                        {code.expiresAt
                          ? formatPersianDate(code.expiresAt.slice(0, 10))
                          : "بدون محدودیت"}
                      </div>
                      <div>
                        ورود: {formatPersianNumber(code.unlockCount)}
                        {code.maxUnlocks != null
                          ? ` / ${formatPersianNumber(code.maxUnlocks)}`
                          : " (نامحدود)"}
                      </div>
                    </div>
                  </div>
                  {code.status !== "revoked" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => revokeCode(code.id)}
                    >
                      لغو
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
