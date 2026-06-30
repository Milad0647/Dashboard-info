import { mkdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import JSZip from "jszip";
import { pgSaveBillboard } from "@/lib/db/repository";
import { matchProviderToUser } from "@/lib/services/provider-user-match";
import { getBillboardApiBaseUrl } from "@/lib/routes/billboard-api";
import { getUploadPublicUrl, getUploadsDir } from "@/lib/uploads";
import { getExternalBillboardTag } from "@/lib/models/billboard-api";
import type { AdminUser } from "@/lib/types";
import { generateId } from "@/lib/utils";

interface MapBilboardManifest {
  app?: string;
  format_version?: string;
}

interface MapBilboardProvider {
  id: string;
  name: string;
}

interface MapBilboardBillboard {
  id: string;
  axis: string;
  code: string;
  latitude: string | number;
  longitude: string | number;
  address: string;
  provider_id: string | null;
  city?: string | null;
  province?: string | null;
}

interface MapBilboardCampaign {
  id: string;
  name: string;
  slug: string;
}

interface MapBilboardCampaignBillboard {
  id: string;
  campaign_id: string;
  billboard_id: string;
  display_start: string | null;
  display_end: string | null;
}

interface MapBilboardAssignmentDesign {
  id: string;
  campaign_billboard_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  image_path: string | null;
  billboard_image_path: string | null;
}

export interface MapBilboardImportResult {
  forwarded: boolean;
  forwardError?: string;
  imported: number;
  skipped: number;
  unmatchedProviders: string[];
  matchedUsers: number;
}

async function readJsonFile<T>(zip: JSZip, path: string): Promise<T> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`فایل ${path} در پشتیبان یافت نشد`);
  }
  return JSON.parse(await file.async("string")) as T;
}

function resolveCityFromBillboard(billboard: MapBilboardBillboard): string {
  if (billboard.city?.trim()) return billboard.city.trim();
  if (billboard.address.includes("تهران")) return "تهران";
  if (billboard.address.includes("مشهد")) return "مشهد";
  if (billboard.address.includes("اصفهان")) return "اصفهان";
  if (billboard.address.includes("شیراز")) return "شیراز";
  if (billboard.address.includes("تبریز")) return "تبریز";
  return "نامشخص";
}

async function copyZipAsset(zip: JSZip, relativePath: string | null | undefined): Promise<string | null> {
  if (!relativePath?.trim()) return null;

  const normalizedPath = relativePath.replace(/\\/g, "/");
  const entry = zip.file(`files/${normalizedPath}`) ?? zip.file(normalizedPath);
  if (!entry) return null;

  const uploadsDir = getUploadsDir();
  await mkdir(uploadsDir, { recursive: true });

  const extension = basename(normalizedPath).includes(".")
    ? basename(normalizedPath).slice(basename(normalizedPath).lastIndexOf("."))
    : ".jpg";
  const filename = `${generateId()}${extension}`;
  const content = await entry.async("nodebuffer");
  await writeFile(join(uploadsDir, filename), content);

  return getUploadPublicUrl(filename);
}

export async function forwardMapBilboardBackupZip(buffer: Buffer): Promise<{ ok: boolean; error?: string }> {
  const restoreUrl = process.env.BILLBOARD_BACKUP_RESTORE_URL?.trim();
  if (!restoreUrl) {
    return { ok: false, error: "BILLBOARD_BACKUP_RESTORE_URL تنظیم نشده است" };
  }

  const token = process.env.BILLBOARD_BACKUP_RESTORE_TOKEN?.trim();
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/zip" }),
    "map-bilboard-backup.zip"
  );

  try {
    const response = await fetch(restoreUrl, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const message = await response.text();
      return {
        ok: false,
        error: message || `خطای ${response.status} از سرویس بیلبورد (${getBillboardApiBaseUrl()})`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ارسال پشتیبان به سرویس بیلبورد ناموفق بود",
    };
  }
}

export async function importMapBilboardBackupZip(params: {
  buffer: Buffer;
  campaignId: string;
  externalCampaignSlug?: string | null;
  users: AdminUser[];
}): Promise<MapBilboardImportResult> {
  const zip = await JSZip.loadAsync(params.buffer);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("manifest.json در فایل ZIP یافت نشد");
  }

  const manifest = JSON.parse(await manifestFile.async("string")) as MapBilboardManifest;
  if (manifest.app && manifest.app !== "map-bilboard") {
    throw new Error("این فایل پشتیبان map-bilboard نیست");
  }

  const providers = await readJsonFile<MapBilboardProvider[]>(zip, "data/providers.json");
  const billboards = await readJsonFile<MapBilboardBillboard[]>(zip, "data/billboards.json");
  const campaigns = await readJsonFile<MapBilboardCampaign[]>(zip, "data/campaigns.json");
  const campaignBillboards = await readJsonFile<MapBilboardCampaignBillboard[]>(
    zip,
    "data/campaign_billboard.json"
  );
  const assignmentDesigns = await readJsonFile<MapBilboardAssignmentDesign[]>(
    zip,
    "data/assignment_designs.json"
  );

  const targetCampaign =
    campaigns.find((campaign) => campaign.slug === params.externalCampaignSlug) ??
    campaigns.find((campaign) => campaign.slug) ??
    campaigns[0];

  if (!targetCampaign) {
    throw new Error("کمپینی در پشتیبان یافت نشد");
  }

  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const billboardMap = new Map(billboards.map((billboard) => [billboard.id, billboard]));
  const campaignBillboardIds = new Set(
    campaignBillboards
      .filter((row) => row.campaign_id === targetCampaign.id)
      .map((row) => row.id)
  );

  const forwardResult = await forwardMapBilboardBackupZip(params.buffer);

  let imported = 0;
  let skipped = 0;
  let matchedUsers = 0;
  const unmatchedProviders = new Set<string>();

  for (const assignment of assignmentDesigns) {
    if (!campaignBillboardIds.has(assignment.campaign_billboard_id)) continue;

    const imagePath = assignment.billboard_image_path ?? assignment.image_path;
    if (!imagePath) {
      skipped += 1;
      continue;
    }

    const campaignBillboard = campaignBillboards.find(
      (row) => row.id === assignment.campaign_billboard_id
    );
    if (!campaignBillboard) {
      skipped += 1;
      continue;
    }

    const billboard = billboardMap.get(campaignBillboard.billboard_id);
    if (!billboard) {
      skipped += 1;
      continue;
    }

    const provider = billboard.provider_id ? providerMap.get(billboard.provider_id) : null;
    const matchedUser = provider ? matchProviderToUser(provider.name, params.users) : null;
    if (provider && !matchedUser) {
      unmatchedProviders.add(provider.name);
    }
    if (matchedUser) {
      matchedUsers += 1;
    }

    const imageUrl = await copyZipAsset(zip, imagePath);
    if (!imageUrl) {
      skipped += 1;
      continue;
    }

    const latitude = Number(billboard.latitude);
    const longitude = Number(billboard.longitude);
    const title = `${billboard.code} — ${billboard.axis}`;
    const date = assignment.start_date ?? campaignBillboard.display_start ?? new Date().toISOString().split("T")[0];

    await pgSaveBillboard({
      id: `mb-${assignment.id}`,
      campaignId: params.campaignId,
      title,
      description: billboard.address,
      city: resolveCityFromBillboard(billboard),
      location: billboard.address,
      date,
      thumbnailUrl: imageUrl,
      imageUrl,
      externalUrl:
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? `https://www.google.com/maps?q=${latitude},${longitude}`
          : "",
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      source: "manual",
      externalId: assignment.id,
      status: "published",
      tags: [getExternalBillboardTag(billboard.id), `provider:${provider?.name ?? "unknown"}`],
      notes: assignment.title ?? null,
      published: true,
      ownerUserId: matchedUser?.id ?? null,
    });

    imported += 1;
  }

  return {
    forwarded: forwardResult.ok,
    forwardError: forwardResult.error,
    imported,
    skipped,
    unmatchedProviders: [...unmatchedProviders].sort((a, b) => a.localeCompare(b, "fa")),
    matchedUsers,
  };
}
