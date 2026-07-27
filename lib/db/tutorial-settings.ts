import { getSql } from "@/lib/db/client";
import {
  TUTORIAL_SECTION_KEYS,
  type TutorialSectionKey,
} from "@/lib/section-tutorials";

const TUTORIALS_ENABLED_KEY = "section_tutorials_enabled";

type TutorialEnabledSettings = {
  /** Per-section flags. Missing keys default to off. */
  sections?: Partial<Record<TutorialSectionKey, boolean>>;
  /**
   * Legacy global flag. Only used when `sections` is absent.
   * Explicit `true` keeps all sections on; otherwise default is off.
   */
  enabled?: boolean;
};

function emptyEnabledMap(): Record<TutorialSectionKey, boolean> {
  return Object.fromEntries(
    TUTORIAL_SECTION_KEYS.map((key) => [key, false])
  ) as Record<TutorialSectionKey, boolean>;
}

async function readSettings(): Promise<TutorialEnabledSettings> {
  const sql = getSql();
  const rows = await sql`
    SELECT value FROM system_settings WHERE key = ${TUTORIALS_ENABLED_KEY} LIMIT 1
  `;

  const value = rows[0]?.value;
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as TutorialEnabledSettings;
}

/** Resolve effective enabled state for one section (default: off). */
export function resolveSectionTutorialEnabled(
  settings: TutorialEnabledSettings,
  sectionKey: TutorialSectionKey
): boolean {
  if (settings.sections && typeof settings.sections === "object") {
    return settings.sections[sectionKey] === true;
  }

  // Legacy global toggle — only enforce when explicitly enabled.
  return settings.enabled === true;
}

export async function pgIsSectionTutorialEnabled(
  sectionKey: TutorialSectionKey
): Promise<boolean> {
  const settings = await readSettings();
  return resolveSectionTutorialEnabled(settings, sectionKey);
}

export async function pgGetSectionTutorialsEnabledMap(): Promise<
  Record<TutorialSectionKey, boolean>
> {
  const settings = await readSettings();
  const map = emptyEnabledMap();
  for (const key of TUTORIAL_SECTION_KEYS) {
    map[key] = resolveSectionTutorialEnabled(settings, key);
  }
  return map;
}

export async function pgSetSectionTutorialEnabled(
  sectionKey: TutorialSectionKey,
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const sql = getSql();
  const settings = await readSettings();
  const sections = emptyEnabledMap();

  for (const key of TUTORIAL_SECTION_KEYS) {
    sections[key] = resolveSectionTutorialEnabled(settings, key);
  }
  sections[sectionKey] = enabled;

  const now = new Date().toISOString();
  const payload = { sections };

  await sql`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (${TUTORIALS_ENABLED_KEY}, ${sql.json(payload)}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at
  `;

  return { success: true };
}
