import { createReadStream, existsSync } from "fs";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { Readable } from "stream";
import {
  buildBackupFilename,
  getBackupsDir,
  isSafeBackupFilename,
  resolveBackupFilePath,
} from "@/lib/backups";
import { pgGetAllCampaigns, pgGetCampaignById } from "@/lib/db/repository";
import { writeCampaignBackupZipToFile } from "@/lib/services/campaign-backup";

export interface StoredBackupInfo {
  filename: string;
  campaignSlug: string;
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
  createdAt: string;
} | null {
  if (!isSafeBackupFilename(filename)) return null;

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

  return { campaignSlug, createdAt };
}

async function ensureBackupsDir(): Promise<string> {
  const dir = getBackupsDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function createStoredCampaignBackup(
  campaignId: string
): Promise<CreateStoredBackupResult> {
  const campaign = await pgGetCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const createdAt = new Date();
  const filename = buildBackupFilename(campaign.slug, createdAt);
  const dir = await ensureBackupsDir();
  const filePath = `${dir}/${filename}`;

  const written = await writeCampaignBackupZipToFile(campaignId, filePath);

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
    if (campaignSlug && meta.campaignSlug !== campaignSlug) continue;

    const filePath = resolveBackupFilePath(name);
    if (!filePath) continue;

    try {
      const info = await stat(filePath);
      if (!info.isFile()) continue;
      items.push({
        filename: name,
        campaignSlug: meta.campaignSlug,
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

export async function createDailyBackupsForAllCampaigns(): Promise<{
  created: CreateStoredBackupResult[];
  failed: Array<{ campaignId: string; slug: string; error: string }>;
}> {
  const campaigns = await pgGetAllCampaigns();
  const created: CreateStoredBackupResult[] = [];
  const failed: Array<{ campaignId: string; slug: string; error: string }> = [];

  for (const campaign of campaigns) {
    try {
      const result = await createStoredCampaignBackup(campaign.id);
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
