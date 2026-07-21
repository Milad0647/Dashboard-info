import { createWriteStream } from "fs";
import { mkdir, writeFile, stat, unlink, rename } from "fs/promises";
import { basename } from "path";
import JSZip from "jszip";
import {
  type CampaignBackupFullData,
  type DbRow,
  UNASSIGNED_OWNER_KEY,
  ownerKey,
  pgGetFullCampaignBackupData,
  pgRestoreFullCampaignData,
  pgRestoreUserCampaignData,
} from "@/lib/db/campaign-backup-repository";
import { getUploadsDir } from "@/lib/uploads";

// CommonJS package — loaded via require for Next/webpack compatibility.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver") as (
  format: "zip",
  options?: { zlib?: { level?: number } }
) => import("archiver").Archiver;

/** Prefer including all media; skip only missing/unreadable files. */
const DEFAULT_MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export interface CreateCampaignBackupOptions {
  includeUploads?: boolean;
  maxSingleFileBytes?: number;
  /** When set, ZIP only includes this user's content folders (+ shared campaign JSON). */
  userId?: string;
}

export interface CampaignBackupWriteResult {
  includedFiles: number;
  skippedFiles: string[];
  sizeBytes: number;
}

export interface FileMapEntry {
  filename: string;
  usedBy: Array<{ path: string }>;
}

function extractFilenameFromUrl(url: string): string | null {
  const match = url.match(/\/api\/files\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function collectFilenamesFromValue(
  value: unknown,
  out: Set<string>,
  path = "root"
): void {
  if (typeof value === "string") {
    const filename = extractFilenameFromUrl(value);
    if (filename) out.add(filename);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectFilenamesFromValue(item, out, `${path}[${index}]`)
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectFilenamesFromValue(child, out, `${path}.${key}`);
    }
  }
}

function filterDataForUser(
  data: CampaignBackupFullData,
  userId: string
): CampaignBackupFullData {
  const owned = <T extends DbRow>(rows: T[]) =>
    rows.filter((row) => String(row.owner_user_id ?? "") === userId);

  const billboards = owned(data.billboards);
  const billboardIds = new Set(billboards.map((b) => String(b.id)));
  const posters = owned(data.posters);
  const posterIds = new Set(posters.map((p) => String(p.id)));
  const videos = owned(data.videos);
  const videoIds = new Set(videos.map((v) => String(v.id)));
  const meetings = owned(data.meetings);
  const meetingIds = new Set(meetings.map((m) => String(m.id)));

  return {
    ...data,
    users: data.users.filter((u) => String(u.id) === userId),
    access: data.access.filter((a) => String(a.user_id) === userId),
    billboards,
    billboardPeriods: data.billboardPeriods.filter((p) =>
      billboardIds.has(String(p.billboard_id))
    ),
    posters,
    posterVersions: data.posterVersions.filter((v) =>
      posterIds.has(String(v.poster_id))
    ),
    videos,
    videoVersions: data.videoVersions.filter((v) =>
      videoIds.has(String(v.video_id))
    ),
    analytics: owned(data.analytics),
    submissions: owned(data.submissions),
    files: owned(data.files),
    socialPosts: owned(data.socialPosts),
    platformStats: owned(data.platformStats),
    activities: owned(data.activities),
    broadcasts: owned(data.broadcasts),
    meetings,
    meetingTasks: data.meetingTasks.filter((t) =>
      meetingIds.has(String(t.meeting_id))
    ),
    meetingDecisions: data.meetingDecisions.filter((d) =>
      meetingIds.has(String(d.meeting_id))
    ),
    rawMedia: owned(data.rawMedia),
    // Campaign-level shared metadata still included so a user ZIP is restorable.
    directives: [],
    directiveAttachments: [],
    directiveRecipients: [],
    pageAccessCodes: [],
  };
}

function nestVersions(
  parents: DbRow[],
  versions: DbRow[],
  parentKey: string
): DbRow[] {
  const byParent = new Map<string, DbRow[]>();
  for (const version of versions) {
    const id = String(version[parentKey] ?? "");
    if (!id) continue;
    const list = byParent.get(id) ?? [];
    list.push(version);
    byParent.set(id, list);
  }
  return parents.map((parent) => ({
    ...parent,
    versions: byParent.get(String(parent.id)) ?? [],
  }));
}

function nestMeetingChildren(
  meetings: DbRow[],
  tasks: DbRow[],
  decisions: DbRow[]
): DbRow[] {
  const tasksBy = new Map<string, DbRow[]>();
  const decisionsBy = new Map<string, DbRow[]>();
  for (const task of tasks) {
    const id = String(task.meeting_id ?? "");
    const list = tasksBy.get(id) ?? [];
    list.push(task);
    tasksBy.set(id, list);
  }
  for (const decision of decisions) {
    const id = String(decision.meeting_id ?? "");
    const list = decisionsBy.get(id) ?? [];
    list.push(decision);
    decisionsBy.set(id, list);
  }
  return meetings.map((meeting) => ({
    ...meeting,
    tasks: tasksBy.get(String(meeting.id)) ?? [],
    decisions: decisionsBy.get(String(meeting.id)) ?? [],
  }));
}

function groupBillboardPeriods(
  billboards: DbRow[],
  periods: DbRow[]
): { billboards: DbRow[]; periodsByOwner: Map<string, DbRow[]> } {
  const billboardOwner = new Map<string, string>();
  for (const billboard of billboards) {
    billboardOwner.set(String(billboard.id), ownerKey(billboard));
  }
  const periodsByOwner = new Map<string, DbRow[]>();
  for (const period of periods) {
    const owner = billboardOwner.get(String(period.billboard_id)) ?? UNASSIGNED_OWNER_KEY;
    const list = periodsByOwner.get(owner) ?? [];
    list.push(period);
    periodsByOwner.set(owner, list);
  }
  return { billboards, periodsByOwner };
}

function buildUserFolders(data: CampaignBackupFullData): Map<string, Record<string, DbRow[]>> {
  const folders = new Map<string, Record<string, DbRow[]>>();

  const ensure = (key: string) => {
    let folder = folders.get(key);
    if (!folder) {
      folder = {
        billboards: [],
        billboard_periods: [],
        posters: [],
        videos: [],
        social_posts: [],
        platform_stats: [],
        activities: [],
        broadcasts: [],
        meetings: [],
        files: [],
        raw_media: [],
        analytics: [],
        submissions: [],
      };
      folders.set(key, folder);
    }
    return folder;
  };

  const postersNested = nestVersions(data.posters, data.posterVersions, "poster_id");
  const videosNested = nestVersions(data.videos, data.videoVersions, "video_id");
  const meetingsNested = nestMeetingChildren(
    data.meetings,
    data.meetingTasks,
    data.meetingDecisions
  );
  const { periodsByOwner } = groupBillboardPeriods(data.billboards, data.billboardPeriods);

  for (const row of data.billboards) ensure(ownerKey(row)).billboards.push(row);
  for (const [owner, periods] of periodsByOwner) {
    ensure(owner).billboard_periods.push(...periods);
  }
  for (const row of postersNested) ensure(ownerKey(row)).posters.push(row);
  for (const row of videosNested) ensure(ownerKey(row)).videos.push(row);
  for (const row of data.socialPosts) ensure(ownerKey(row)).social_posts.push(row);
  for (const row of data.platformStats) ensure(ownerKey(row)).platform_stats.push(row);
  for (const row of data.activities) ensure(ownerKey(row)).activities.push(row);
  for (const row of data.broadcasts) ensure(ownerKey(row)).broadcasts.push(row);
  for (const row of meetingsNested) ensure(ownerKey(row)).meetings.push(row);
  for (const row of data.files) ensure(ownerKey(row)).files.push(row);
  for (const row of data.rawMedia) ensure(ownerKey(row)).raw_media.push(row);
  for (const row of data.analytics) ensure(ownerKey(row)).analytics.push(row);
  for (const row of data.submissions) ensure(ownerKey(row)).submissions.push(row);

  // Always create a folder for each known user profile, even with empty sections.
  for (const user of data.users) {
    ensure(String(user.id));
  }
  if (folders.size === 0) {
    ensure(UNASSIGNED_OWNER_KEY);
  }

  return folders;
}

function jsonFile(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

type ZipTextEntry = { path: string; content: string };
type ZipDiskEntry = { path: string; diskPath: string };

async function prepareBackupEntries(
  campaignId: string,
  options: CreateCampaignBackupOptions = {}
): Promise<{
  textEntries: ZipTextEntry[];
  diskEntries: ZipDiskEntry[];
  includedFiles: number;
  skippedFiles: string[];
}> {
  const includeUploads = options.includeUploads !== false;
  const maxSingleFileBytes =
    options.maxSingleFileBytes ?? DEFAULT_MAX_SINGLE_FILE_BYTES;

  const full = await pgGetFullCampaignBackupData(campaignId);
  if (!full) throw new Error("Campaign not found");

  const data =
    options.userId?.trim()
      ? filterDataForUser(full, options.userId.trim())
      : full;

  const userFolders = buildUserFolders(data);
  const usersById = new Map(data.users.map((u) => [String(u.id), u]));
  const textEntries: ZipTextEntry[] = [];

  textEntries.push({
    path: "manifest.json",
    content: jsonFile({
      version: 2,
      format: "per-user-v2",
      exportedAt: data.exportedAt,
      campaignId: data.campaignId,
      mode: options.userId ? "user" : "full",
      filterUserId: options.userId ?? null,
      includeUploads,
      userFolderCount: userFolders.size,
      counts: {
        users: data.users.length,
        billboards: data.billboards.length,
        posters: data.posters.length,
        videos: data.videos.length,
        socialPosts: data.socialPosts.length,
        activities: data.activities.length,
        meetings: data.meetings.length,
        files: data.files.length,
        rawMedia: data.rawMedia.length,
        broadcasts: data.broadcasts.length,
      },
    }),
  });

  textEntries.push({ path: "campaign/settings.json", content: jsonFile(data.settings) });
  textEntries.push({ path: "campaign/users.json", content: jsonFile(data.users) });
  textEntries.push({ path: "campaign/access.json", content: jsonFile(data.access) });
  textEntries.push({
    path: "campaign/categories.json",
    content: jsonFile(data.categories),
  });
  textEntries.push({
    path: "campaign/directives.json",
    content: jsonFile({
      directives: data.directives,
      attachments: data.directiveAttachments,
      recipients: data.directiveRecipients,
    }),
  });
  textEntries.push({
    path: "campaign/page_access_codes.json",
    content: jsonFile(data.pageAccessCodes),
  });
  textEntries.push({
    path: "campaign/full-data.json",
    content: jsonFile(data),
  });

  for (const [folderKey, sections] of userFolders) {
    const base = `users/${folderKey}`;
    const profile =
      folderKey === UNASSIGNED_OWNER_KEY
        ? {
            id: null,
            name: "unassigned",
            note: "Content without owner_user_id",
          }
        : usersById.get(folderKey) ?? { id: folderKey };

    textEntries.push({ path: `${base}/profile.json`, content: jsonFile(profile) });
    for (const [section, rows] of Object.entries(sections)) {
      textEntries.push({
        path: `${base}/${section}.json`,
        content: jsonFile(rows),
      });
    }
  }

  const filenames = new Set<string>();
  collectFilenamesFromValue(data, filenames);
  const fileMap: FileMapEntry[] = [...filenames].map((filename) => ({
    filename,
    usedBy: [{ path: "campaign/full-data.json" }],
  }));
  textEntries.push({
    path: "files/file-map.json",
    content: jsonFile(fileMap),
  });

  const skippedFiles: string[] = [];
  const diskEntries: ZipDiskEntry[] = [];
  let includedFiles = 0;

  if (!includeUploads) {
    textEntries.push({
      path: "skipped.json",
      content: jsonFile({
        reason: "Uploads omitted; media remains on the server uploads volume.",
        filenames: [...filenames],
      }),
    });
    return { textEntries, diskEntries, includedFiles, skippedFiles };
  }

  const uploadsDir = getUploadsDir();
  for (const filename of filenames) {
    const diskPath = `${uploadsDir}/${filename}`;
    try {
      const info = await stat(diskPath);
      if (!info.isFile()) {
        skippedFiles.push(filename);
        continue;
      }
      if (info.size > maxSingleFileBytes) {
        skippedFiles.push(filename);
        continue;
      }
      diskEntries.push({ path: `files/by-id/${filename}`, diskPath });
      includedFiles += 1;
    } catch {
      skippedFiles.push(filename);
    }
  }

  if (skippedFiles.length > 0) {
    textEntries.push({
      path: "skipped.json",
      content: jsonFile({
        reason:
          "Some media files were missing, unreadable, or over the single-file limit.",
        maxSingleFileBytes,
        filenames: skippedFiles,
      }),
    });
  }

  return { textEntries, diskEntries, includedFiles, skippedFiles };
}

/** Build a campaign backup ZIP in memory (for immediate download). */
export async function createCampaignBackupZip(
  campaignId: string,
  options?: CreateCampaignBackupOptions
): Promise<Buffer> {
  // Prefer streaming to a temp buffer via archiver for lower peak memory than JSZip.
  const { PassThrough } = await import("stream");
  const chunks: Buffer[] = [];
  const pass = new PassThrough();
  pass.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.pipe(pass);

  const prepared = await prepareBackupEntries(campaignId, options);
  for (const entry of prepared.textEntries) {
    archive.append(entry.content, { name: entry.path });
  }
  for (const entry of prepared.diskEntries) {
    archive.file(entry.diskPath, { name: entry.path });
  }

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    pass.on("end", () => resolve());
    pass.on("error", reject);
    archive.on("error", reject);
  });

  return Buffer.concat(chunks);
}

/** Build a campaign backup ZIP and stream it directly to disk (for stored backups). */
export async function writeCampaignBackupZipToFile(
  campaignId: string,
  outputPath: string,
  options?: CreateCampaignBackupOptions
): Promise<CampaignBackupWriteResult> {
  const prepared = await prepareBackupEntries(campaignId, options);
  const tempPath = `${outputPath}.tmp`;

  try {
    await unlink(tempPath);
  } catch {
    // ignore
  }

  const output = createWriteStream(tempPath);
  const archive = archiver("zip", { zlib: { level: 5 } });

  const done = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
  });

  archive.pipe(output);

  for (const entry of prepared.textEntries) {
    archive.append(entry.content, { name: entry.path });
  }
  for (const entry of prepared.diskEntries) {
    archive.file(entry.diskPath, { name: entry.path });
  }

  await archive.finalize();
  await done;

  const info = await stat(tempPath);
  // A real v2 backup always has manifest + full-data JSON — reject near-empty files.
  if (info.size < 200) {
    await unlink(tempPath).catch(() => undefined);
    throw new Error("Backup ZIP was empty or incomplete");
  }

  await rename(tempPath, outputPath);

  return {
    includedFiles: prepared.includedFiles,
    skippedFiles: prepared.skippedFiles,
    sizeBytes: info.size,
  };
}

async function parseBackupZip(buffer: Buffer): Promise<{
  data: CampaignBackupFullData;
  zip: JSZip;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const fullDataFile = zip.file("campaign/full-data.json");
  const manifestFile = zip.file("manifest.json");

  if (fullDataFile) {
    const data = JSON.parse(await fullDataFile.async("string")) as CampaignBackupFullData;
    if (data.version !== 2) {
      throw new Error("فرمت بکاپ قدیمی است؛ یک پشتیبان جدید بگیرید");
    }
    return { data, zip };
  }

  // Legacy v1 rejection with clear message
  if (manifestFile) {
    const manifest = JSON.parse(await manifestFile.async("string")) as {
      version?: number;
      format?: string;
    };
    if (manifest.version !== 2 && manifest.format !== "per-user-v2") {
      throw new Error(
        "فرمت بکاپ قدیمی پشتیبانی نمی‌شود. لطفاً دوباره از صفحه پشتیبان‌گیری، بکاپ جدید بگیرید."
      );
    }
  }

  throw new Error("campaign/full-data.json در بکاپ پیدا نشد");
}

async function restoreUploadFiles(zip: JSZip): Promise<number> {
  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });
  let restored = 0;

  const byIdEntries = Object.keys(zip.files).filter(
    (name) => name.startsWith("files/by-id/") && !zip.files[name].dir
  );
  const legacyEntries = Object.keys(zip.files).filter(
    (name) => name.startsWith("uploads/") && !zip.files[name].dir
  );

  const entries = byIdEntries.length > 0 ? byIdEntries : legacyEntries;

  for (const entryName of entries) {
    const entry = zip.files[entryName];
    const originalName = basename(entryName);
    if (!originalName || originalName === "." || originalName === "..") continue;
    const content = await entry.async("nodebuffer");
    await writeFile(`${uploadsDir}/${originalName}`, content);
    restored += 1;
  }

  return restored;
}

export async function restoreFullCampaignFromZip(
  buffer: Buffer,
  campaignId: string
): Promise<{ success: true; campaignId: string; restoredFiles: number }> {
  const { data, zip } = await parseBackupZip(buffer);
  const restoredFiles = await restoreUploadFiles(zip);
  await pgRestoreFullCampaignData(campaignId, data);
  return { success: true, campaignId, restoredFiles };
}

export async function restoreUserFromZip(
  buffer: Buffer,
  campaignId: string,
  userId: string
): Promise<{ success: true; campaignId: string; userId: string; restoredFiles: number }> {
  const { data, zip } = await parseBackupZip(buffer);
  const filtered = filterDataForUser(data, userId);
  if (filtered.users.length === 0 && filtered.billboards.length === 0) {
    // Still allow if content exists under owner without profile
    const hasOwned =
      filtered.posters.length +
        filtered.videos.length +
        filtered.files.length +
        filtered.socialPosts.length +
        filtered.activities.length +
        filtered.meetings.length +
        filtered.rawMedia.length +
        filtered.broadcasts.length +
        filtered.submissions.length +
        filtered.analytics.length >
      0;
    if (!hasOwned) {
      throw new Error("در این بکاپ داده‌ای برای این کاربر پیدا نشد");
    }
  }
  const restoredFiles = await restoreUploadFiles(zip);
  await pgRestoreUserCampaignData(campaignId, userId, filtered);
  return { success: true, campaignId, userId, restoredFiles };
}

/**
 * Legacy import entry used by /api/campaign/import.
 * Always performs full wipe+replace against the target campaign.
 */
export async function importCampaignBackupZip(
  buffer: Buffer,
  targetCampaignId?: string
): Promise<{ success: true; campaignId: string; restoredFiles: number }> {
  if (!targetCampaignId?.trim()) {
    throw new Error(
      "برای بازیابی کامل باید campaignId کمپین مقصد مشخص باشد (داده‌های همان کمپین پاک و جایگزین می‌شود)."
    );
  }
  return restoreFullCampaignFromZip(buffer, targetCampaignId.trim());
}
