/**
 * Lightweight magic-byte checks for uploaded files.
 * Rejects obvious mismatches (e.g. executable labeled as image).
 */

export type DetectedFileKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "mp4"
  | "webm"
  | "pdf"
  | "zip"
  | "ogg"
  | "wav"
  | "mp3"
  | "unknown";

function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

export function detectFileKind(buffer: Buffer): DetectedFileKind {
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 4, 8) === "ftyp"
  ) {
    return "mp4";
  }
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) return "zip"; // docx/xlsx/etc.
  if (startsWithBytes(buffer, [0x4f, 0x67, 0x67, 0x53])) return "ogg";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "wav";
  }
  if (
    startsWithBytes(buffer, [0xff, 0xfb]) ||
    startsWithBytes(buffer, [0xff, 0xf3]) ||
    startsWithBytes(buffer, [0xff, 0xf2]) ||
    startsWithBytes(buffer, [0x49, 0x44, 0x33])
  ) {
    return "mp3";
  }
  return "unknown";
}

/**
 * Detect SVG by text structure near the start of the file.
 * Do not scan binary payloads for "<?xml" — PNG/JPEG from design tools often
 * embed XMP metadata containing that substring.
 */
export function looksLikeSvg(buffer: Buffer): boolean {
  // Known binary formats are never SVG, even if metadata contains XML.
  const detected = detectFileKind(buffer);
  if (detected !== "unknown") return false;

  const head = buffer
    .subarray(0, Math.min(buffer.length, 1024))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();

  // Require an actual <svg> root (optional XML declaration / doctype / comments before it).
  return /^(?:\s*<\?xml\b[^>]*>\s*)?(?:\s*<!doctype\b[^>]*>\s*)?(?:\s*<!--[\s\S]*?-->\s*)*<svg\b/.test(
    head
  );
}

const IMAGE_KINDS = new Set<DetectedFileKind>(["jpeg", "png", "gif", "webp"]);
const VIDEO_KINDS = new Set<DetectedFileKind>(["mp4", "webm"]);
const AUDIO_KINDS = new Set<DetectedFileKind>(["mp3", "wav", "ogg"]);
const DOCUMENT_KINDS = new Set<DetectedFileKind>(["pdf", "zip"]);

export function assertMagicMatchesKind(
  buffer: Buffer,
  kind: string
): { ok: true } | { ok: false; error: string } {
  const detected = detectFileKind(buffer);

  if (looksLikeSvg(buffer)) {
    return { ok: false, error: "آپلود فایل SVG مجاز نیست" };
  }

  if (kind === "image") {
    if (!IMAGE_KINDS.has(detected)) {
      return { ok: false, error: "محتوای فایل با نوع تصویر هم‌خوانی ندارد" };
    }
    return { ok: true };
  }

  if (kind === "video" || kind === "activity-video") {
    if (!VIDEO_KINDS.has(detected)) {
      return { ok: false, error: "محتوای فایل با نوع ویدیو هم‌خوانی ندارد" };
    }
    return { ok: true };
  }

  if (kind === "audio") {
    if (!AUDIO_KINDS.has(detected)) {
      return { ok: false, error: "محتوای فایل با نوع صدا هم‌خوانی ندارد" };
    }
    return { ok: true };
  }

  if (kind === "document") {
    if (!DOCUMENT_KINDS.has(detected)) {
      return { ok: false, error: "محتوای فایل با نوع سند هم‌خوانی ندارد" };
    }
    return { ok: true };
  }

  if (kind === "raw-image") {
    if (IMAGE_KINDS.has(detected) || detected === "unknown") {
      // Allow camera RAW / uncommon formats when not clearly an executable payload.
      if (detected === "unknown" && looksLikeExecutable(buffer)) {
        return { ok: false, error: "نوع فایل برای راش تصویر مجاز نیست" };
      }
      return { ok: true };
    }
    return { ok: false, error: "محتوای فایل با راش تصویر هم‌خوانی ندارد" };
  }

  if (kind === "raw-video") {
    if (VIDEO_KINDS.has(detected) || detected === "unknown") {
      if (detected === "unknown" && looksLikeExecutable(buffer)) {
        return { ok: false, error: "نوع فایل برای راش ویدیو مجاز نیست" };
      }
      return { ok: true };
    }
    return { ok: false, error: "محتوای فایل با راش ویدیو هم‌خوانی ندارد" };
  }

  return { ok: true };
}

function looksLikeExecutable(buffer: Buffer): boolean {
  // Windows PE / ELF / Mach-O
  if (startsWithBytes(buffer, [0x4d, 0x5a])) return true;
  if (startsWithBytes(buffer, [0x7f, 0x45, 0x4c, 0x46])) return true;
  if (startsWithBytes(buffer, [0xcf, 0xfa, 0xed, 0xfe])) return true;
  if (startsWithBytes(buffer, [0xce, 0xfa, 0xed, 0xfe])) return true;
  return false;
}
