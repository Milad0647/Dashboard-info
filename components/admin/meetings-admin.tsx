"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteMeetingAction,
  saveMeetingAction,
  saveMeetingsViewPasswordAction,
} from "@/lib/actions/extended-actions";
import {
  appendMultilineDecisions,
  appendMultilineTasks,
  compareMeetingsByDateDesc,
  parseMultilineTasks,
  reindexMeetingDecisions,
  reindexMeetingTasks,
  type MeetingDecisionInput,
  type MeetingTaskInput,
} from "@/lib/meeting-tasks";
import { todayISO } from "@/lib/jalali";
import type { MeetingWithTasks } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  meetingDate: z.string(),
  location: z.string(),
  imageUrl: z.string().optional(),
  discussionSummary: z.string(),
  audioUrl: z.string().optional(),
});

interface MeetingsAdminProps {
  campaignId: string;
  initialMeetings: MeetingWithTasks[];
  hasMeetingsPassword: boolean;
}

function taskProgress(tasks: MeetingTaskInput[]) {
  if (tasks.length === 0) return "بدون مصوبه";
  const done = tasks.filter((task) => task.completed).length;
  return `${done}/${tasks.length} انجام‌شده`;
}

function decisionSummary(decisions: MeetingDecisionInput[]) {
  if (decisions.length === 0) return "بدون تصمیم";
  return `${decisions.length} مورد`;
}

export function MeetingsAdmin({ campaignId, initialMeetings, hasMeetingsPassword }: MeetingsAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialMeetings);
  const [meetingsPassword, setMeetingsPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(hasMeetingsPassword);
  const [tasks, setTasks] = useState<MeetingTaskInput[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecisionInput[]>([]);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [decisionsBulkText, setDecisionsBulkText] = useState("");
  const [attendeesText, setAttendeesText] = useState("");
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [editingDecisionIndex, setEditingDecisionIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      meetingDate: todayISO(),
      location: "",
      imageUrl: "",
      discussionSummary: "",
      audioUrl: "",
    },
  });

  const saveMeetingsPassword = (removePassword = false) => {
    startTransition(async () => {
      const result = await saveMeetingsViewPasswordAction(campaignId, {
        password: meetingsPassword.trim() || undefined,
        removePassword,
      });

      if (!result.success) {
        toast.error("error" in result && result.error ? result.error : "ذخیره رمز نشد");
        return;
      }

      setPasswordConfigured(!removePassword);
      setMeetingsPassword("");
      toast.success(removePassword ? "رمز جلسات حذف شد" : "رمز جلسات ذخیره شد");
    });
  };

  const resetDialog = () => {
    setTasks([]);
    setDecisions([]);
    setAttendees([]);
    setBulkText("");
    setDecisionsBulkText("");
    setAttendeesText("");
    setEditingTaskIndex(null);
    setEditingDecisionIndex(null);
  };

  const openCreate = () => {
    setEditingId(null);
    resetDialog();
    form.reset({
      title: "",
      meetingDate: todayISO(),
      location: "",
      imageUrl: "",
      discussionSummary: "",
      audioUrl: "",
    });
    setOpen(true);
  };

  const openEdit = (meeting: MeetingWithTasks) => {
    setEditingId(meeting.id);
    resetDialog();
    form.reset({
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      location: meeting.location,
      imageUrl: meeting.imageUrl ?? "",
      discussionSummary: meeting.discussionSummary,
      audioUrl: meeting.audioUrl ?? "",
    });
    setAttendees([...meeting.attendees]);
    setTasks(
      meeting.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        completed: task.completed,
        sortOrder: task.sortOrder,
      }))
    );
    setDecisions(
      meeting.decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        sortOrder: decision.sortOrder,
      }))
    );
    setOpen(true);
  };

  const addBulkTasks = () => {
    if (!bulkText.trim()) return;
    setTasks((prev) => reindexMeetingTasks(appendMultilineTasks(prev, bulkText)));
    setBulkText("");
    toast.success("موارد به چک‌لیست اضافه شد");
  };

  const addBulkDecisions = () => {
    if (!decisionsBulkText.trim()) return;
    setDecisions((prev) => reindexMeetingDecisions(appendMultilineDecisions(prev, decisionsBulkText)));
    setDecisionsBulkText("");
    toast.success("تصمیم‌ها اضافه شدند");
  };

  const addBulkAttendees = () => {
    const names = parseMultilineTasks(attendeesText);
    if (names.length === 0) return;
    setAttendees((prev) => [...new Set([...prev, ...names])]);
    setAttendeesText("");
    toast.success("حاضرین اضافه شدند");
  };

  const removeAttendee = (index: number) => {
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTaskTitle = (index: number, title: string) => {
    setTasks((prev) => prev.map((task, i) => (i === index ? { ...task, title } : task)));
  };

  const toggleTask = (index: number) => {
    setTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, completed: !task.completed } : task))
    );
  };

  const removeTask = (index: number) => {
    setTasks((prev) => reindexMeetingTasks(prev.filter((_, i) => i !== index)));
    setEditingTaskIndex(null);
  };

  const addEmptyTask = () => {
    setTasks((prev) =>
      reindexMeetingTasks([
        ...prev,
        { title: "", completed: false, sortOrder: prev.length },
      ])
    );
    setEditingTaskIndex(tasks.length);
  };

  const updateDecisionTitle = (index: number, title: string) => {
    setDecisions((prev) => prev.map((decision, i) => (i === index ? { ...decision, title } : decision)));
  };

  const removeDecision = (index: number) => {
    setDecisions((prev) => reindexMeetingDecisions(prev.filter((_, i) => i !== index)));
    setEditingDecisionIndex(null);
  };

  const addEmptyDecision = () => {
    setDecisions((prev) =>
      reindexMeetingDecisions([...prev, { title: "", sortOrder: prev.length }])
    );
    setEditingDecisionIndex(decisions.length);
  };

  const onSubmit = form.handleSubmit((data) => {
    const normalizedTasks = reindexMeetingTasks(
      tasks
        .map((task) => ({ ...task, title: task.title.trim() }))
        .filter((task) => task.title.length > 0)
    );

    const normalizedDecisions = reindexMeetingDecisions(
      decisions
        .map((decision) => ({ ...decision, title: decision.title.trim() }))
        .filter((decision) => decision.title.length > 0)
    );

    startTransition(async () => {
      const result = await saveMeetingAction(
        {
          campaignId,
          id: editingId ?? undefined,
          title: data.title,
          meetingDate: data.meetingDate,
          location: data.location,
          imageUrl: data.imageUrl || null,
          discussionSummary: data.discussionSummary,
          audioUrl: data.audioUrl || null,
          attendees,
          published: true,
        },
        normalizedTasks,
        normalizedDecisions
      );

      if (!result.success) {
        toast.error("error" in result && result.error ? result.error : "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());
      const now = new Date().toISOString();
      const existing = editingId ? rows.find((row) => row.id === editingId) : null;
      const savedMeeting: MeetingWithTasks = {
        id: savedId,
        campaignId,
        title: data.title,
        meetingDate: data.meetingDate,
        location: data.location,
        imageUrl: data.imageUrl || null,
        discussionSummary: data.discussionSummary,
        audioUrl: data.audioUrl || null,
        attendees,
        published: true,
        sortOrder: existing?.sortOrder ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        tasks: normalizedTasks.map((task, index) => ({
          id: task.id ?? crypto.randomUUID(),
          meetingId: savedId,
          title: task.title,
          completed: task.completed,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
        decisions: normalizedDecisions.map((decision, index) => ({
          id: decision.id ?? crypto.randomUUID(),
          meetingId: savedId,
          title: decision.title,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
      };

      setRows((prev) => {
        const next = editingId
          ? prev.map((row) => (row.id === editingId ? { ...row, ...savedMeeting } : row))
          : [...prev, savedMeeting];
        return [...next].sort(compareMeetingsByDateDesc);
      });
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold">جلسات و مصوبات</h1>
          <p className="text-sm text-muted-foreground">
            ثبت جلسه با رمز مشترک، حاضرین، صوت، مصوبات و تصمیم‌ها
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 self-start">
          <Plus className="h-4 w-4" />
          افزودن جلسه
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">رمز مشاهده همه جلسات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            یک رمز برای کل بخش جلسات. با وارد کردن آن، جزئیات همه جلسات در صفحه عمومی باز می‌شود.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="password"
              value={meetingsPassword}
              onChange={(event) => setMeetingsPassword(event.target.value)}
              placeholder={passwordConfigured ? "رمز جدید (برای تغییر)" : "رمز مشاهده جلسات"}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || !meetingsPassword.trim()}
              onClick={() => saveMeetingsPassword(false)}
            >
              {passwordConfigured ? "تغییر رمز" : "تنظیم رمز"}
            </Button>
            {passwordConfigured && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => saveMeetingsPassword(true)}
              >
                حذف رمز
              </Button>
            )}
          </div>
          {passwordConfigured && (
            <p className="text-xs text-muted-foreground">رمز فعلی تنظیم شده است.</p>
          )}
        </CardContent>
      </Card>

      <AdminDataTable
        data={rows}
        searchKeys={["title", "location", "discussionSummary"]}
        columns={[
          { key: "title", label: "عنوان" },
          adminOwnerTableColumn<MeetingWithTasks>(),
          { key: "meetingDate", label: "تاریخ", render: (item) => formatPersianDate(item.meetingDate) },
          { key: "location", label: "مکان" },
          {
            key: "tasks",
            label: "مصوبات",
            render: (item) => taskProgress(item.tasks),
          },
          {
            key: "decisions",
            label: "تصمیم‌ها",
            render: (item) => decisionSummary(item.decisions),
          },
        ]}
        onView={openEdit}
        onEdit={openEdit}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteMeetingAction(item.id);
            setRows((prev) => prev.filter((row) => row.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش جلسه" : "جلسه جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان جلسه</Label>
              <Input {...form.register("title")} placeholder="مثلاً جلسه هماهنگی کمپین" />
            </div>

            <PersianDateField control={form.control} name="meetingDate" label="تاریخ جلسه" />

            <div className="space-y-2">
              <Label>مکان جلسه</Label>
              <Input {...form.register("location")} placeholder="مثلاً سالن جلسات مرکز" />
            </div>

            <MediaUpload
              label="عکس جلسه"
              value={form.watch("imageUrl") ?? ""}
              onChange={(url) => form.setValue("imageUrl", url)}
              kind="image"
            />

            <MediaUpload
              label="فایل صوتی جلسه"
              value={form.watch("audioUrl") ?? ""}
              onChange={(url) => form.setValue("audioUrl", url)}
              kind="audio"
              dropzone={false}
            />

            <div className="space-y-2">
              <Label>خلاصه صحبت‌ها</Label>
              <Textarea
                {...form.register("discussionSummary")}
                rows={4}
                placeholder="خلاصه مباحث و نتایج کلی جلسه"
              />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label>حاضرین جلسه</Label>
                <p className="text-xs text-muted-foreground mt-1">هر خط یک نام — یا از لیست زیر حذف کنید.</p>
              </div>
              <Textarea
                value={attendeesText}
                onChange={(event) => setAttendeesText(event.target.value)}
                rows={3}
                placeholder={"علی محمدی\nسارا احمدی"}
                dir="rtl"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addBulkAttendees} disabled={!attendeesText.trim()}>
                افزودن حاضرین
              </Button>
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attendees.map((name, index) => (
                    <span
                      key={`${name}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs"
                    >
                      {name}
                      <button type="button" onClick={() => removeAttendee(index)} className="text-muted-foreground hover:text-destructive">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label>مصوبات (چک‌لیست)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  هر خط یک مورد — مثل Trello. متن را paste کنید و «افزودن به لیست» بزنید.
                </p>
              </div>

              <Textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                rows={5}
                placeholder={`ثبت مصوبات جلسات داخل کمپین\nگزارش‌گیری اسنپ\nگزارش شبکه‌های اجتماعی`}
                dir="rtl"
              />
              <Button type="button" variant="secondary" onClick={addBulkTasks} disabled={!bulkText.trim()}>
                افزودن به لیست
              </Button>

              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <div
                    key={task.id ?? `task-${index}`}
                    className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(index)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border"
                    />
                    {editingTaskIndex === index ? (
                      <Input
                        value={task.title}
                        onChange={(event) => updateTaskTitle(index, event.target.value)}
                        onBlur={() => setEditingTaskIndex(null)}
                        autoFocus
                        className="h-8 min-w-0 flex-1"
                      />
                    ) : (
                      <span
                        className={cn(
                          "min-w-0 flex-1 break-words text-sm",
                          task.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title || "—"}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingTaskIndex(index)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => removeTask(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addEmptyTask}>
                <Plus className="h-3.5 w-3.5" />
                افزودن مورد تکی
              </Button>

              {tasks.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {taskProgress(tasks)}
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label>تصمیم‌های جلسه</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  هر خط یک تصمیم — بدون چک‌باکس. متن را paste کنید و «افزودن تصمیم‌ها» بزنید.
                </p>
              </div>

              <Textarea
                value={decisionsBulkText}
                onChange={(event) => setDecisionsBulkText(event.target.value)}
                rows={4}
                placeholder={`تصمیم برگزاری جلسه هفتگی\nتخصیص بودجه تبلیغات`}
                dir="rtl"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addBulkDecisions}
                disabled={!decisionsBulkText.trim()}
              >
                افزودن تصمیم‌ها
              </Button>

              <div className="space-y-2">
                {decisions.map((decision, index) => (
                  <div
                    key={decision.id ?? `decision-${index}`}
                    className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    {editingDecisionIndex === index ? (
                      <Input
                        value={decision.title}
                        onChange={(event) => updateDecisionTitle(index, event.target.value)}
                        onBlur={() => setEditingDecisionIndex(null)}
                        autoFocus
                        className="h-8 min-w-0 flex-1"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 break-words text-sm">
                        {decision.title || "—"}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingDecisionIndex(index)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => removeDecision(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addEmptyDecision}>
                <Plus className="h-3.5 w-3.5" />
                افزودن تصمیم تکی
              </Button>

              {decisions.length > 0 && (
                <p className="text-xs text-muted-foreground">{decisionSummary(decisions)}</p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              ذخیره
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
