"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Save, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUpload } from "@/components/ui/media-upload";
import {
  getSectionTutorialsEnabledMapAction,
  listTutorialsForAdminAction,
  saveSectionTutorialAction,
  setSectionTutorialEnabledAction,
} from "@/lib/actions/tutorial-actions";
import {
  TUTORIAL_SECTION_KEYS,
  tutorialSectionLabels,
  type SectionTutorial,
  type TutorialSectionKey,
  type TutorialStep,
} from "@/lib/section-tutorials";
import { formatPersianNumber } from "@/lib/utils";

function emptyStep(): TutorialStep {
  return { title: "", body: "", imageUrl: null };
}

function emptyEnabledMap(): Record<TutorialSectionKey, boolean> {
  return Object.fromEntries(
    TUTORIAL_SECTION_KEYS.map((key) => [key, false])
  ) as Record<TutorialSectionKey, boolean>;
}

export function TutorialsAdmin() {
  const [tutorials, setTutorials] = useState<SectionTutorial[]>([]);
  const [sectionKey, setSectionKey] = useState<TutorialSectionKey>("posters");
  const [title, setTitle] = useState(tutorialSectionLabels.posters);
  const [steps, setSteps] = useState<TutorialStep[]>([emptyStep()]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enabledMap, setEnabledMap] = useState<Record<TutorialSectionKey, boolean>>(
    emptyEnabledMap
  );
  const [enabledLoaded, setEnabledLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isTogglingEnabled, startToggleTransition] = useTransition();

  const tutorialMap = useMemo(() => {
    return new Map(tutorials.map((item) => [item.sectionKey, item]));
  }, [tutorials]);

  const sectionEnabled = enabledMap[sectionKey] === true;

  const loadTutorials = async () => {
    setLoading(true);
    const [listResult, enabledResult] = await Promise.all([
      listTutorialsForAdminAction(),
      getSectionTutorialsEnabledMapAction(),
    ]);
    if (!listResult.success) {
      toast.error(listResult.error ?? "بارگذاری آموزش‌ها ناموفق بود");
      setLoading(false);
      return;
    }
    setTutorials(listResult.tutorials);
    if (enabledResult.success) {
      setEnabledMap(enabledResult.enabledMap);
    }
    setEnabledLoaded(true);
    setLoading(false);
  };

  useEffect(() => {
    void loadTutorials();
  }, []);

  useEffect(() => {
    const existing = tutorialMap.get(sectionKey);
    if (existing) {
      setTitle(existing.title);
      setSteps(existing.steps.length > 0 ? existing.steps : [emptyStep()]);
      setVersion(existing.version);
      return;
    }
    setTitle(tutorialSectionLabels[sectionKey]);
    setSteps([emptyStep()]);
    setVersion(0);
  }, [sectionKey, tutorialMap]);

  const updateStep = (index: number, patch: Partial<TutorialStep>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step))
    );
  };

  const handleToggleEnabled = (nextEnabled: boolean) => {
    const previous = sectionEnabled;
    setEnabledMap((prev) => ({ ...prev, [sectionKey]: nextEnabled }));
    startToggleTransition(async () => {
      const result = await setSectionTutorialEnabledAction(sectionKey, nextEnabled);
      if (!result.success) {
        setEnabledMap((prev) => ({ ...prev, [sectionKey]: previous }));
        toast.error(result.error ?? "ذخیره وضعیت آموزش ناموفق بود");
        return;
      }
      toast.success(
        nextEnabled
          ? `آموزش «${tutorialSectionLabels[sectionKey]}» فعال شد`
          : `آموزش «${tutorialSectionLabels[sectionKey]}» غیرفعال شد`
      );
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveSectionTutorialAction({
        sectionKey,
        title,
        steps,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره ناموفق بود");
        return;
      }
      toast.success("آموزش ذخیره شد — نسخه جدید برای contributorها اجباری است");
      setTutorials((prev) => {
        const next = prev.filter((item) => item.sectionKey !== sectionKey);
        return [...next, result.tutorial];
      });
      setVersion(result.tutorial.version);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">آموزش بخش‌ها</h1>
        <p className="text-sm text-muted-foreground">
          محتوای مودال آموزشی هر بخش را مدیریت کنید. آموزش هر بخش را جداگانه فعال کنید؛
          پیش‌فرض همه خاموش است. تا وقتی آموزش یک بخش فعال و نوشته نشود، contributor در آن
          بخش بدون اجبار آموزش می‌تواند محتوا اضافه کند.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <Label>بخش</Label>
          <Select
            value={sectionKey}
            onValueChange={(value) => setSectionKey(value as TutorialSectionKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TUTORIAL_SECTION_KEYS.map((key) => {
                const existing = tutorialMap.get(key);
                const ready = Boolean(existing?.steps.length);
                const enabled = enabledMap[key] === true;
                return (
                  <SelectItem key={key} value={key}>
                    {tutorialSectionLabels[key]}
                    {enabled ? " ●" : ""}
                    {ready ? " ✓" : " (خالی)"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-3">
            <div className="min-w-0 text-right">
              <p className="text-sm font-medium">اجبار آموزش این بخش</p>
              <p className="text-xs text-muted-foreground">
                {sectionEnabled
                  ? "فعال — قبل از افزودن محتوا باید آموزش را ببینند"
                  : "غیرفعال — بدون آموزش می‌توانند محتوا اضافه کنند"}
              </p>
            </div>
            <Switch
              checked={sectionEnabled}
              disabled={!enabledLoaded || isTogglingEnabled}
              onCheckedChange={handleToggleEnabled}
              aria-label={`فعال‌سازی آموزش ${tutorialSectionLabels[sectionKey]}`}
            />
          </div>

          {!sectionEnabled && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">
              آموزش این بخش خاموش است. مودال نشان داده نمی‌شود و گیت سرور هم رد می‌شود.
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">
            <p className="flex items-center gap-1 font-medium text-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              وضعیت
            </p>
            <p>
              {loading
                ? "در حال بارگذاری…"
                : version > 0
                  ? `نسخه ${formatPersianNumber(version)}`
                  : "هنوز آموزشی ثبت نشده"}
            </p>
            <p>با هر ذخیره، نسخه افزایش می‌یابد و contributorها باید دوباره ببینند.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tutorial-title">عنوان مودال</Label>
            <Input
              id="tutorial-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثلاً آموزش افزودن پوستر"
            />
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    مرحله {formatPersianNumber(index + 1)}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={steps.length <= 1}
                    onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>عنوان مرحله</Label>
                  <Input
                    value={step.title}
                    onChange={(event) => updateStep(index, { title: event.target.value })}
                    placeholder="مثلاً عنوان را وارد کنید"
                  />
                </div>
                <div className="space-y-2">
                  <Label>توضیح</Label>
                  <Textarea
                    value={step.body}
                    onChange={(event) => updateStep(index, { body: event.target.value })}
                    rows={4}
                    placeholder="توضیح دهید کاربر چه چیزی را باید پر کند…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تصویر نمونه (اختیاری)</Label>
                  <MediaUpload
                    value={step.imageUrl ?? ""}
                    onChange={(url) => updateStep(index, { imageUrl: url || null })}
                    accept="image/*"
                    kind="image"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSteps((prev) => [...prev, emptyStep()])}
            >
              <Plus className="h-4 w-4" />
              افزودن مرحله
            </Button>
            <Button type="button" disabled={isPending || loading} onClick={handleSave}>
              <Save className="h-4 w-4" />
              ذخیره آموزش
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
