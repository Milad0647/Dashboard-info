/** Normalize Persian/Arabic digits to Latin so score "۰" parses as 0. */
export function normalizeScoreDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

/**
 * Parse a score input.
 * Empty → null (clear score).
 * 0 is a valid score.
 */
export function parseScoreInput(
  raw: string
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = normalizeScoreDigits(raw.trim());
  if (trimmed === "") {
    return { ok: true, value: null };
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: "امتیاز باید عدد معتبر باشد" };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: "امتیاز باید صفر یا بزرگ‌تر باشد" };
  }

  return { ok: true, value: parsed };
}

/** Normalize a score coming from the client/server action. 0 is valid. */
export function normalizeScoreValue(
  score: number | null | undefined
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (score === null || score === undefined) {
    return { ok: true, value: null };
  }

  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return { ok: false, error: "امتیاز باید صفر یا بزرگ‌تر باشد" };
  }

  return { ok: true, value: score };
}
