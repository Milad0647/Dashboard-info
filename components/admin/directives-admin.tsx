"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Check,
  ClipboardList,
  Download,
  Eye,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentUpload } from "@/components/ui/document-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDateField } from "@/components/ui/persian-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmDirectiveSeenAction,
  deleteDirectiveAction,
  getDirectiveRecipientsAction,
  saveDirectiveAction,
} from "@/lib/actions/directive-actions";
import {
  CONTENT_TITLE_MAX_LENGTH,
  CONTENT_TITLE_MAX_LENGTH_MESSAGE,
} from "@/lib/content-constraints";
import type {
  CampaignDirective,
  DirectiveAttachment,
  DirectiveRecipient,
} from "@/lib/types";
import { USER_REGIONS, getUserRegionLabel, type UserRegion } from "@/lib/user-regions";
import { cn, formatPersianDate, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1).max(CONTENT_TITLE_MAX_LENGTH, CONTENT_TITLE_MAX_LENGTH_MESSAGE),
  body: z.string().min(1, "متن دستورکار الزامی است"),
  priority: z.enum(["normal", "urgent"]),
  startDate: z.string().min(1, "تاریخ شروع الزامی است"),
  endDate: z.string().min(1, "تاریخ پایان الزامی است"),
  audienceType: z.enum(["all", "region", "users"]),
  audienceRegion: z.enum(["north", "south", "east", "west"]).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

type InboxTab = "new" | "seen" | "all";
type ManagerView = "manage" | "inbox";

type DraftAttachment = {
  id?: string;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

interface CampaignUserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  region: UserRegion | null;
  phone: string | null;
}

interface DirectivesAdminProps {
  campaignId: string;
  canManage: boolean;
  /** All campaign directives for managers. */
  initialDirectives: CampaignDirective[];
  /** Directives addressed to the current user (kartabl). */
  inboxDirectives: CampaignDirective[];
  campaignUsers: CampaignUserOption[];
}

const smsStatusLabels: Record<DirectiveRecipient["smsStatus"], string> = {
  pending: "در انتظار",
  sent: "ارسال شد",
  failed: "خطا",
  no_phone: "بدون شماره",
  skipped: "رد شد",
};

function extraAttachments(
  item: CampaignDirective
): DirectiveAttachment[] {
  const letterUrl = item.letterFileUrl?.trim();
  if (!letterUrl) return item.attachments;
  return item.attachments.filter((file) => file.fileUrl !== letterUrl);
}

function OfficialLetterPreview({ item }: { item: CampaignDirective }) {
  if (!item.letterFileUrl) {
    return <p className="text-sm text-muted-foreground">نامه رسمی آپلود نشده</p>;
  }

  const isImage = Boolean(item.letterMimeType?.startsWith("image/"));

  return (
    <div className="space-y-2 rounded-lg border px-3 py-3">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.letterFileUrl}
          alt={item.letterFileName || "نامه رسمی"}
          className="max-h-64 w-full rounded-md object-contain bg-muted/30"
        />
      )}
      <a
        href={item.letterFileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-start gap-2 text-sm text-primary hover:underline"
      >
        <Download className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">
            {item.letterFileName || "نامه رسمی"}
          </span>
          <span className="block text-xs text-muted-foreground">دانلود / مشاهده نامه رسمی</span>
        </span>
      </a>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: DirectiveAttachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">پیوستی ندارد</p>;
  }

  return (
    <ul className="space-y-3">
      {attachments.map((file) => {
        const isImage = file.mimeType.startsWith("image/");
        const isVideo = file.mimeType.startsWith("video/");

        return (
          <li key={file.id} className="space-y-2 rounded-lg border px-3 py-2">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.fileUrl}
                alt={file.title || file.fileName}
                className="max-h-56 w-full rounded-md object-contain bg-muted"
              />
            ) : null}
            {isVideo ? (
              <video
                src={file.fileUrl}
                controls
                className="max-h-56 w-full rounded-md bg-black"
              />
            ) : null}
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-2 text-sm text-primary hover:underline"
            >
              <Download className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">
                  {file.title || file.fileName}
                </span>
                {file.title && file.title !== file.fileName && (
                  <span className="block text-xs text-muted-foreground">{file.fileName}</span>
                )}
                {(isImage || isVideo) && (
                  <span className="block text-xs text-muted-foreground">
                    {isImage ? "تصویر" : "ویدیو"} — دانلود / مشاهده
                  </span>
                )}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function DirectiveDateRange({ item }: { item: CampaignDirective }) {
  const start = item.startDate;
  const end = item.endDate ?? item.dueDate;
  if (!start && !end) return null;
  return (
    <>
      {start && <span>شروع: {formatPersianDate(start)}</span>}
      {end && <span>پایان: {formatPersianDate(end)}</span>}
    </>
  );
}

export function DirectivesAdmin({
  campaignId,
  canManage,
  initialDirectives,
  inboxDirectives: initialInbox,
  campaignUsers,
}: DirectivesAdminProps) {
  const [rows, setRows] = useState(initialDirectives);
  const [inboxRowsState, setInboxRowsState] = useState(initialInbox);
  const [managerView, setManagerView] = useState<ManagerView>("manage");
  const [inboxTab, setInboxTab] = useState<InboxTab>("new");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [letterUpload, setLetterUpload] = useState({
    url: "",
    fileName: "",
    fileSize: 0,
    mimeType: "",
  });
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null);
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentUpload, setAttachmentUpload] = useState({
    url: "",
    fileName: "",
    fileSize: 0,
    mimeType: "",
  });
  const [detailItem, setDetailItem] = useState<CampaignDirective | null>(null);
  const [trackingItem, setTrackingItem] = useState<CampaignDirective | null>(null);
  const [recipients, setRecipients] = useState<DirectiveRecipient[]>([]);
  const [recipientFilter, setRecipientFilter] = useState<"all" | "unseen" | "sms_error">("all");
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      body: "",
      priority: "normal",
      startDate: "",
      endDate: "",
      audienceType: "all",
      audienceRegion: null,
    },
  });

  const audienceType = form.watch("audienceType");

  const showingInbox = !canManage || managerView === "inbox";

  const listRows = useMemo(() => {
    if (!showingInbox) return rows;
    if (inboxTab === "new") return inboxRowsState.filter((row) => !row.confirmed);
    if (inboxTab === "seen") return inboxRowsState.filter((row) => row.confirmed);
    return inboxRowsState;
  }, [showingInbox, inboxTab, rows, inboxRowsState]);

  const openCreate = () => {
    setEditingId(null);
    setSelectedUserIds([]);
    setAttachments([]);
    setLetterUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
    form.reset({
      title: "",
      body: "",
      priority: "normal",
      startDate: "",
      endDate: "",
      audienceType: "all",
      audienceRegion: null,
    });
    setOpen(true);
  };

  const openEdit = (item: CampaignDirective) => {
    setEditingId(item.id);
    setLetterUpload({
      url: item.letterFileUrl ?? "",
      fileName: item.letterFileName ?? "",
      fileSize: item.letterFileSize ?? 0,
      mimeType: item.letterMimeType ?? "",
    });
    setAttachments(
      extraAttachments(item).map((file) => ({
        id: file.id,
        title: file.title || file.fileName,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
      }))
    );
    setSelectedUserIds([]);
    form.reset({
      title: item.title,
      body: item.body,
      priority: item.priority,
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? item.dueDate ?? "",
      audienceType: item.audienceType,
      audienceRegion: item.audienceRegion,
    });

    if (item.audienceType === "users") {
      startTransition(async () => {
        const result = await getDirectiveRecipientsAction(item.id);
        if (result.success) {
          setSelectedUserIds(result.recipients.map((row) => row.userId));
        }
      });
    }

    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setAttachmentDialogOpen(false);
    setEditingAttachmentIndex(null);
  };

  const openAddAttachment = () => {
    setEditingAttachmentIndex(null);
    setAttachmentTitle("");
    setAttachmentUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
    setAttachmentDialogOpen(true);
  };

  const openEditAttachment = (index: number) => {
    const current = attachments[index];
    if (!current) return;
    setEditingAttachmentIndex(index);
    setAttachmentTitle(current.title);
    setAttachmentUpload({
      url: current.fileUrl,
      fileName: current.fileName,
      fileSize: current.fileSize,
      mimeType: current.mimeType,
    });
    setAttachmentDialogOpen(true);
  };

  const closeAttachmentDialog = () => {
    setAttachmentDialogOpen(false);
    setEditingAttachmentIndex(null);
    setAttachmentTitle("");
    setAttachmentUpload({ url: "", fileName: "", fileSize: 0, mimeType: "" });
  };

  const saveAttachmentDraft = () => {
    const title = attachmentTitle.trim();
    if (!title) {
      toast.error("عنوان فایل الزامی است");
      return;
    }
    if (!attachmentUpload.url) {
      toast.error("فایل را آپلود کنید");
      return;
    }

    const next: DraftAttachment = {
      id: editingAttachmentIndex != null ? attachments[editingAttachmentIndex]?.id : undefined,
      title,
      fileUrl: attachmentUpload.url,
      fileName: attachmentUpload.fileName || title,
      mimeType: attachmentUpload.mimeType || "application/octet-stream",
      fileSize: attachmentUpload.fileSize || 0,
    };

    setAttachments((prev) => {
      if (editingAttachmentIndex == null) return [...prev, next];
      return prev.map((item, index) => (index === editingAttachmentIndex ? next : item));
    });
    closeAttachmentDialog();
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const onSubmit = form.handleSubmit((data) => {
    if (!letterUpload.url) {
      toast.error("آپلود نامه رسمی (PDF یا تصویر) الزامی است");
      return;
    }

    startTransition(async () => {
      const result = await saveDirectiveAction({
        id: editingId ?? undefined,
        campaignId,
        title: data.title,
        body: data.body,
        priority: data.priority,
        startDate: data.startDate,
        endDate: data.endDate,
        letterFileUrl: letterUpload.url,
        letterFileName: letterUpload.fileName || "نامه رسمی",
        letterMimeType: letterUpload.mimeType || "application/octet-stream",
        letterFileSize: letterUpload.fileSize || 0,
        audienceType: data.audienceType,
        audienceRegion: data.audienceType === "region" ? data.audienceRegion ?? null : null,
        selectedUserIds: data.audienceType === "users" ? selectedUserIds : undefined,
        attachments,
        sendSmsOnPublish: true,
      });

      if (!result.success) {
        toast.error(result.error ?? "ذخیره نشد");
        return;
      }

      toast.success(editingId ? "دستورکار به‌روز شد" : "دستورکار منتشر شد");
      closeDialog();
      window.location.reload();
    });
  });

  const openTracking = (item: CampaignDirective) => {
    setTrackingItem(item);
    setRecipientFilter("all");
    startTransition(async () => {
      const result = await getDirectiveRecipientsAction(item.id);
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری مخاطبان ناموفق بود");
        return;
      }
      setRecipients(result.recipients);
    });
  };

  const filteredRecipients = useMemo(() => {
    if (recipientFilter === "unseen") return recipients.filter((row) => !row.confirmed);
    if (recipientFilter === "sms_error") {
      return recipients.filter(
        (row) => row.smsStatus === "failed" || row.smsStatus === "no_phone"
      );
    }
    return recipients;
  }, [recipientFilter, recipients]);

  const confirmSeen = (item: CampaignDirective) => {
    startTransition(async () => {
      const result = await confirmDirectiveSeenAction(item.id, campaignId);
      if (!result.success) {
        toast.error(result.error ?? "تأیید ثبت نشد");
        return;
      }
      const next = { ...item, confirmed: true, seenAt: new Date().toISOString() };
      setInboxRowsState((prev) =>
        prev.map((row) => (row.id === item.id ? next : row))
      );
      if (detailItem?.id === item.id) {
        setDetailItem(next);
      }
      toast.success("تأیید مشاهده ثبت شد");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">دستورکارها</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "انتشار دستورکار برای کاربران و پیگیری مشاهده و پیامک"
              : "دستورکارهای جدید را ببینید، نامه رسمی را مشاهده کنید و تأیید مشاهده بزنید"}
          </p>
        </div>
        {canManage && managerView === "manage" && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            دستورکار جدید
          </Button>
        )}
      </div>

      {canManage && (
        <Tabs
          value={managerView}
          onValueChange={(value) => setManagerView(value as ManagerView)}
        >
          <TabsList>
            <TabsTrigger value="manage">مدیریت</TabsTrigger>
            <TabsTrigger value="inbox">
              کارتابل من (
              {formatPersianNumber(inboxRowsState.filter((row) => !row.confirmed).length)}
              )
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {showingInbox && (
        <Tabs value={inboxTab} onValueChange={(value) => setInboxTab(value as InboxTab)}>
          <TabsList>
            <TabsTrigger value="new">
              جدید (
              {formatPersianNumber(inboxRowsState.filter((row) => !row.confirmed).length)}
              )
            </TabsTrigger>
            <TabsTrigger value="seen">
              دیده‌شده (
              {formatPersianNumber(inboxRowsState.filter((row) => row.confirmed).length)}
              )
            </TabsTrigger>
            <TabsTrigger value="all">
              همه ({formatPersianNumber(inboxRowsState.length)})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="space-y-3">
        {listRows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 opacity-50" />
            هنوز دستورکاری نیست
          </div>
        ) : (
          listRows.map((item) => (
            <article
              key={item.id}
              className={cn(
                "rounded-xl border bg-card p-4 shadow-sm",
                item.priority === "urgent" && "border-destructive/40"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{item.title}</h2>
                    {item.priority === "urgent" && <Badge variant="destructive">فوری</Badge>}
                    {showingInbox && !item.confirmed && <Badge>جدید</Badge>}
                    {showingInbox && item.confirmed && (
                      <Badge variant="secondary">دیده‌شده</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {item.body}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>انتشار: {formatPersianDateTime(item.publishedAt ?? item.createdAt)}</span>
                    <DirectiveDateRange item={item} />
                    {!showingInbox && (
                      <span>
                        {formatPersianNumber(item.seenCount ?? 0)} دیده‌اند ·{" "}
                        {formatPersianNumber(item.unseenCount ?? 0)} ندیده‌اند
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDetailItem(item)}>
                    <Eye className="h-4 w-4" />
                    جزئیات
                  </Button>
                  {showingInbox && !item.confirmed && (
                    <Button size="sm" disabled={isPending} onClick={() => confirmSeen(item)}>
                      <Check className="h-4 w-4" />
                      تأیید مشاهده
                    </Button>
                  )}
                  {!showingInbox && canManage && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openTracking(item)}>
                        <Users className="h-4 w-4" />
                        پیگیری
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        ویرایش
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await deleteDirectiveAction(item.id, campaignId);
                            if (!result.success) {
                              toast.error(result.error ?? "حذف نشد");
                              return;
                            }
                            setRows((prev) => prev.filter((row) => row.id !== item.id));
                            toast.success("حذف شد");
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Create / Edit */}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش دستورکار" : "دستورکار جدید"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>متن دستورکار</Label>
              <Textarea rows={6} {...form.register("body")} />
              {form.formState.errors.body && (
                <p className="text-sm text-destructive">{form.formState.errors.body.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>اولویت</Label>
                <Select
                  value={form.watch("priority")}
                  onValueChange={(value) =>
                    form.setValue("priority", value as "normal" | "urgent")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">عادی</SelectItem>
                    <SelectItem value="urgent">فوری</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PersianDateField
                control={form.control}
                name="startDate"
                label="تاریخ شروع"
              />
              <PersianDateField
                control={form.control}
                name="endDate"
                label="تاریخ پایان"
              />
            </div>
            {(form.formState.errors.startDate || form.formState.errors.endDate) && (
              <p className="text-sm text-destructive">
                {form.formState.errors.startDate?.message ||
                  form.formState.errors.endDate?.message}
              </p>
            )}

            <DocumentUpload
              variant="letter"
              label="نامه رسمی این اقدام"
              value={letterUpload.url}
              fileName={letterUpload.fileName}
              fileSize={letterUpload.fileSize}
              mimeType={letterUpload.mimeType}
              onChange={(payload) => setLetterUpload(payload)}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>پیوست‌ها</Label>
                <Button type="button" variant="outline" size="sm" onClick={openAddAttachment}>
                  <Plus className="h-4 w-4" />
                  افزودن فایل
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                می‌توانید تصویر، ویدیو، PDF، Word یا Excel هم پیوست کنید
              </p>
              {attachments.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  هنوز فایلی اضافه نشده — با «افزودن فایل» تصویر، ویدیو یا سند پیوست بگذارید
                </p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.fileUrl}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{file.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.mimeType.startsWith("image/")
                            ? "تصویر"
                            : file.mimeType.startsWith("video/")
                              ? "ویدیو"
                              : "سند"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditAttachment(index)}
                        >
                          ویرایش
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          حذف
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label>مخاطب</Label>
              <Select
                value={audienceType}
                onValueChange={(value) =>
                  form.setValue("audienceType", value as "all" | "region" | "users")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه کاربران این کمپین</SelectItem>
                  <SelectItem value="region">منطقه جغرافیایی</SelectItem>
                  <SelectItem value="users">افراد انتخابی</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {audienceType === "region" && (
              <div className="space-y-2">
                <Label>منطقه</Label>
                <Select
                  value={form.watch("audienceRegion") ?? ""}
                  onValueChange={(value) =>
                    form.setValue("audienceRegion", value as UserRegion)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب منطقه" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>
                        {getUserRegionLabel(region)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {audienceType === "users" && (
              <div className="space-y-2">
                <Label>انتخاب کاربران</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {campaignUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">کاربری در این کمپین نیست</p>
                  ) : (
                    campaignUsers.map((user) => (
                      <label key={user.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {user.name}
                          <span className="text-muted-foreground"> · {user.email}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              با انتشار، برای مخاطبان پیامک رزرو می‌شود (سرویس پیامک فعلاً جای خالی است و بعداً وصل می‌شود).
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                انصراف
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingId ? "ذخیره" : "انتشار"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / edit attachment */}
      <Dialog
        open={attachmentDialogOpen}
        onOpenChange={(next) => (next ? setAttachmentDialogOpen(true) : closeAttachmentDialog())}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAttachmentIndex != null ? "ویرایش فایل" : "افزودن فایل"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان فایل</Label>
              <Input
                value={attachmentTitle}
                maxLength={CONTENT_TITLE_MAX_LENGTH}
                onChange={(event) => setAttachmentTitle(event.target.value)}
                placeholder="مثلاً دستورالعمل / تصویر / ویدیو / فایل خام"
              />
            </div>
            <DocumentUpload
              label="فایل (تصویر، ویدیو یا سند)"
              variant="attachment"
              value={attachmentUpload.url}
              fileName={attachmentUpload.fileName}
              fileSize={attachmentUpload.fileSize}
              mimeType={attachmentUpload.mimeType}
              onChange={(payload) => {
                setAttachmentUpload(payload);
                if (!attachmentTitle.trim() && payload.fileName) {
                  setAttachmentTitle(payload.fileName.replace(/\.[^.]+$/, ""));
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeAttachmentDialog}>
                انصراف
              </Button>
              <Button type="button" onClick={saveAttachmentDraft}>
                {editingAttachmentIndex != null ? "ذخیره فایل" : "افزودن به دستورکار"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={Boolean(detailItem)} onOpenChange={(next) => !next && setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {detailItem.title}
                  {detailItem.priority === "urgent" && (
                    <Badge variant="destructive">فوری</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-7">{detailItem.body}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    انتشار:{" "}
                    {formatPersianDateTime(detailItem.publishedAt ?? detailItem.createdAt)}
                  </span>
                  <DirectiveDateRange item={detailItem} />
                  {detailItem.createdByName && (
                    <span>از طرف: {detailItem.createdByName}</span>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">نامه رسمی</h3>
                  <OfficialLetterPreview item={detailItem} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">پیوست‌ها</h3>
                  <AttachmentList attachments={extraAttachments(detailItem)} />
                </div>
                {showingInbox && !detailItem.confirmed && (
                  <Button disabled={isPending} onClick={() => confirmSeen(detailItem)}>
                    <Check className="h-4 w-4" />
                    تأیید مشاهده
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tracking */}
      <Dialog
        open={Boolean(trackingItem)}
        onOpenChange={(next) => {
          if (!next) {
            setTrackingItem(null);
            setRecipients([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {trackingItem && (
            <>
              <DialogHeader>
                <DialogTitle>پیگیری: {trackingItem.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {formatPersianNumber(trackingItem.seenCount ?? 0)} دیده‌اند ·{" "}
                  {formatPersianNumber(trackingItem.unseenCount ?? 0)} ندیده‌اند ·{" "}
                  {formatPersianNumber(trackingItem.recipientCount ?? recipients.length)} مخاطب
                </p>

                <Tabs
                  value={recipientFilter}
                  onValueChange={(value) =>
                    setRecipientFilter(value as "all" | "unseen" | "sms_error")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">همه</TabsTrigger>
                    <TabsTrigger value="unseen">فقط ندیده‌ها</TabsTrigger>
                    <TabsTrigger value="sms_error">خطای پیامک / بدون شماره</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-right">
                      <tr>
                        <th className="px-3 py-2 font-medium">نام</th>
                        <th className="px-3 py-2 font-medium">نقش</th>
                        <th className="px-3 py-2 font-medium">مشاهده</th>
                        <th className="px-3 py-2 font-medium">زمان تأیید</th>
                        <th className="px-3 py-2 font-medium">پیامک</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecipients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                            موردی نیست
                          </td>
                        </tr>
                      ) : (
                        filteredRecipients.map((row) => (
                          <tr key={row.userId} className="border-t">
                            <td className="px-3 py-2">
                              <div>{row.userName}</div>
                              <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                            </td>
                            <td className="px-3 py-2">
                              {row.userRole === "client"
                                ? "کارفرما"
                                : row.userRole === "admin"
                                  ? "مدیر"
                                  : "کاربر"}
                            </td>
                            <td className="px-3 py-2">
                              {row.confirmed ? (
                                <Badge variant="secondary">دید</Badge>
                              ) : (
                                <Badge variant="outline">ندید</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {row.seenAt ? formatPersianDateTime(row.seenAt) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <div>{smsStatusLabels[row.smsStatus]}</div>
                              {row.smsError && (
                                <div className="text-xs text-muted-foreground">{row.smsError}</div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
