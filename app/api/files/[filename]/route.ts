import { open, readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";
import { verifyFileAccessToken } from "@/lib/auth/file-access-token";
import { detectFileKind } from "@/lib/security/file-magic";
import {
  getExistingLocalImageThumbnail,
  isThumbnailableImageFilename,
} from "@/lib/server/image-thumbnail";
import { resolveUploadFilePath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".rar": "application/vnd.rar",
};

function getContentType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function sanitizeFilename(raw: string): string | null {
  const safeName = path.basename(raw.split("?")[0].split("#")[0]);
  if (!safeName || safeName === "." || safeName === "..") return null;
  return safeName;
}

function decodeFilenameParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\w.\-()+ ]+/g, "_").trim() || "download";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function tokenFilenameCandidates(filename: string, request: Request): string[] {
  const names = new Set<string>([filename]);
  try {
    const pathname = new URL(request.url).pathname;
    const fromPath = pathname.slice(pathname.lastIndexOf("/") + 1);
    if (fromPath) {
      names.add(fromPath);
      names.add(decodeFilenameParam(fromPath));
    }
  } catch {
    // ignore
  }
  try {
    names.add(decodeURIComponent(filename));
  } catch {
    // ignore
  }
  return [...names].filter(Boolean);
}

function hasValidAccessToken(filename: string, request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");
  return tokenFilenameCandidates(filename, request).some((name) =>
    verifyFileAccessToken(name, exp, sig)
  );
}

function sniffContentType(buffer: Buffer, fallback: string): string {
  switch (detectFileKind(buffer)) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return fallback;
  }
}

async function hasAuthSession(): Promise<boolean> {
  try {
    return Boolean(await getAuthSession());
  } catch {
    return false;
  }
}

async function canAccessFile(request: Request, filename: string): Promise<boolean> {
  // Prefer signed URL tokens so image grids do not hit the DB on every file.
  if (hasValidAccessToken(filename, request)) return true;
  return hasAuthSession();
}

function binaryResponse(
  data: Buffer,
  contentType: string,
  extraHeaders?: Record<string, string>
) {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = sanitizeFilename(decodeFilenameParam(rawFilename));
  if (!filename) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canAccessFile(request, filename))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wantCardThumb =
    searchParams.get("thumb") === "1" && isThumbnailableImageFilename(filename);

  try {
    if (wantCardThumb) {
      const thumbName = await getExistingLocalImageThumbnail(filename);
      if (thumbName) {
        const thumbBuffer = await readFile(resolveUploadFilePath(thumbName));
        return binaryResponse(thumbBuffer, "image/webp", {
          "Cache-Control": "private, max-age=86400",
        });
      }
    }

    const filePath = resolveUploadFilePath(filename);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = getContentType(filename);
    const fileSize = fileStat.size;
    const range = request.headers.get("range");
    const forceDownload = searchParams.get("download") === "1";
    const disposition = forceDownload ? contentDispositionAttachment(filename) : null;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        const chunkSize = end - start + 1;
        const fileHandle = await open(filePath, "r");
        const buffer = Buffer.alloc(chunkSize);

        try {
          await fileHandle.read(buffer, 0, chunkSize, start);
        } finally {
          await fileHandle.close();
        }

        return new NextResponse(new Uint8Array(buffer), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            ...(disposition ? { "Content-Disposition": disposition } : {}),
          },
        });
      }
    }

    const fileBuffer = await readFile(filePath);
    return binaryResponse(fileBuffer, sniffContentType(fileBuffer, contentType), {
      "Accept-Ranges": "bytes",
      ...(disposition ? { "Content-Disposition": disposition } : {}),
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
