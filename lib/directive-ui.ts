/** Shared red styling for directive (دستورکار) CTAs and notifications. */
export const DIRECTIVE_PRIMARY_BUTTON_CLASS =
  "bg-red-600 text-white shadow-sm shadow-red-600/30 hover:bg-red-700 hover:text-white";

export const DIRECTIVE_OUTLINE_BUTTON_CLASS =
  "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40";

export const DIRECTIVE_SIDEBAR_CTA_CLASS =
  "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-extrabold tracking-wide bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-red-400/70 hover:bg-red-700 hover:shadow-red-700/50 transition-colors";

/** Sonner toast options — keep directive notifications visually red/urgent. */
export const DIRECTIVE_TOAST_OPTIONS = {
  className: "border-red-500/40 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
} as const;
