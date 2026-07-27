import { createReadStream, existsSync } from "fs";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { Readable } from "stream";
import {
  buildBackupFilename,
  getBackupsDir,
  getStoredBackupKind,
  isSafeBackupFilename,
  resolveBackupFilePath,
  type StoredBackupKind,
} from "@/lib/backups";
import { pgGetAllCampaigns, pgGetCampaignById } from "@/lib/db/repository";
import { writeCampaignBackupZipToFile } from "@/lib/services/campaign-backup";

export interface StoredBackupInfo {
  filename: string;
  /** Campaign slug for ZIP backups; "database" for Postgres dumps. */
  campaignSlug: string;
  kind: StoredBackupKind;
  sizeBytes: number;
  createdAt: string;
}

export interface CreateStoredBackupResult {
  filename: string;
  sizeBytes: number;
  campaignId: string;
  campaignSlug: string;
  createdAt: string;
  includedFiles: number;
  skippedFiles: number;
}

function parseBackupMeta(filename: string): {
  campaignSlug: string;
  kind: StoredBackupKind;
  createdAt: string;
} | null {
  const kind = getStoredBackupKind(filename);
  if (!kind) return null;

  if (kind === "db-dump") {
    const match = filename.match(/^db-dump-(\d{4}-\d{2}-\d{2})\.sql$/);
    if (!match) return null;
    return {
      campaignSlug: "database",
      kind,
      createdAt: `${match[1]}T00:00:00.000Z`,
    };
  }

  const withoutExt = filename.replace(/\.zip$/i, "");
  const match = withoutExt.match(
    /^backup-(.+)-(\d{4}-\d{2}-\d{2})(?:-(\d{6}))?$/
  );
  if (!match) return null;

  const [, campaignSlug, date, time] = match;
  const hh = time?.slice(0, 2) ?? "00";
  const mm = time?.slice(2, 4) ?? "00";
  const ss = time?.slice(4, 6) ?? "00";
  const createdAt = `${date}T${hh}:${mm}:${ss}.000Z`;

  return { campaignSlug, kind, createdAt };
}

async function ensureBackupsDir(): Promise<string> {
  const dir = getBackupsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function createStoredCampaignBackup(
  campaignId: string,
  options?: { userId?: string; includeUploads?: boolean }
): Promise<CreateStoredBackupResult> {
  const campaign = await pgGetCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const createdAt = new Date();
  const filename = buildBackupFilename(campaign.slug, createdAt);
  const dir = await ensureBackupsDir();
  const filePath = `${dir}/${filename}`;

  const written = await writeCampaignBackupZipToFile(campaignId, filePath, {
    userId: options?.userId,
    includeUploads: options?.includeUploads,
  });

  // Backups are kept until an admin deletes them manually — no auto-prune.
  return {
    filename,
    sizeBytes: written.sizeBytes,
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    createdAt: createdAt.toISOString(),
    includedFiles: written.includedFiles,
    skippedFiles: written.skippedFiles.length,
  };
}

export async function listStoredBackups(campaignSlug?: string): Promise<StoredBackupInfo[]> {
  const dir = await ensureBackupsDir();
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const items: StoredBackupInfo[] = [];
  for (const name of entries) {
    if (!isSafeBackupFilename(name)) continue;
    const meta = parseBackupMeta(name);
    if (!meta) continue;
    // Campaign-scoped callers (e.g. billboard restore) only want that campaign's ZIPs.
    if (campaignSlug) {
      if (meta.kind !== "campaign" || meta.campaignSlug !== campaignSlug) continue;
    }

    const filePath = resolveBackupFilePath(name);
    if (!filePath) continue;

    try {
      const info = await stat(filePath);
      if (!info.isFile()) continue;
      items.push({
        filename: name,
        campaignSlug: meta.campaignSlug,
        kind: meta.kind,
        sizeBytes: info.size,
        createdAt: info.mtime.toISOString(),
      });
    } catch {
      // Skip unreadable entries
    }
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function deleteStoredBackup(filename: string): Promise<boolean> {
  const filePath = resolveBackupFilePath(filename);
  if (!filePath) return false;
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredBackups(filenames: string[]): Promise<{
  deleted: string[];
  failed: string[];
}> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const filename of filenames) {
    if (!isSafeBackupFilename(filename)) {
      failed.push(filename);
      continue;
    }
    const ok = await deleteStoredBackup(filename);
    if (ok) deleted.push(filename);
    else failed.push(filename);
  }
  return { deleted, failed };
}

/**
 * Delete stored backups older than `olderThanDays` (by file mtime).
 * Keeps the newest files; never deletes today's db-dump when olderThanDays >= 1.
 */
export async function deleteStoredBackupsOlderThan(olderThanDays: number): Promise<{
  deleted: string[];
  failed: string[];
  freedBytes: number;
}> {
  const days = Math.floor(olderThanDays);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("olderThanDays must be at least 1");
  }

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const all = await listStoredBackups();
  const toDelete = all.filter((item) => new Date(item.createdAt).getTime() < cutoffMs);

  let freedBytes = 0;
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const item of toDelete) {
    const ok = await deleteStoredBackup(item.filename);
    if (ok) {
      deleted.push(item.filename);
      freedBytes += item.sizeBytes;
    } else {
      failed.push(item.filename);
    }
  }

  return { deleted, failed, freedBytes };
}

/** Keep only the newest N campaign ZIPs per slug + newest N db dumps. */
export async function pruneStoredBackups(options?: {
  keepCampaignPerSlug?: number;
  keepDbDumps?: number;
}): Promise<{ deleted: string[]; freedBytes: number }> {
  const keepCampaign = Math.max(1, options?.keepCampaignPerSlug ?? 7);
  const keepDumps = Math.max(1, options?.keepDbDumps ?? 7);

  const all = await listStoredBackups();
  const bySlug = new Map<string, StoredBackupInfo[]>();
  const dumps: StoredBackupInfo[] = [];

  for (const item of all) {
    if (item.kind === "db-dump") {
      dumps.push(item);
      continue;
    }
    const list = bySlug.get(item.campaignSlug) ?? [];
    list.push(item);
    bySlug.set(item.campaignSlug, list);
  }

  const toDelete: StoredBackupInfo[] = [];

  for (const list of bySlug.values()) {
    // Already sorted newest-first from listStoredBackups
    toDelete.push(...list.slice(keepCampaign));
  }
  toDelete.push(...dumps.slice(keepDumps));

  let freedBytes = 0;
  const deleted: string[] = [];
  for (const item of toDelete) {
    const ok = await deleteStoredBackup(item.filename);
    if (ok) {
      deleted.push(item.filename);
      freedBytes += item.sizeBytes;
    }
  }

  return { deleted, freedBytes };
}

export function openStoredBackupStream(filename: string): {
  stream: ReadableStream;
  filePath: string;
} | null {
  const filePath = resolveBackupFilePath(filename);
  if (!filePath || !existsSync(filePath)) return null;
  const nodeStream = createReadStream(filePath);
  return {
    filePath,
    stream: Readable.toWeb(nodeStream) as ReadableStream,
  };
}

export async function createDailyBackupsForAllCampaigns(options?: {
  includeUploads?: boolean;
}): Promise<{
  created: CreateStoredBackupResult[];
  failed: Array<{ campaignId: string; slug: string; error: string }>;
}> {
  const campaigns = await pgGetAllCampaigns();
  const created: CreateStoredBackupResult[] = [];
  const failed: Array<{ campaignId: string; slug: string; error: string }> = [];

  for (const campaign of campaigns) {
    try {
      const result = await createStoredCampaignBackup(campaign.id, {
        includeUploads: options?.includeUploads === true,
      });
      created.push(result);
    } catch (error) {
      failed.push({
        campaignId: campaign.id,
        slug: campaign.slug,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { created, failed };
}
