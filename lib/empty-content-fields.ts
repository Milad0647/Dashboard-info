import { normalizePlanLabels } from "@/lib/content-topics";

export type EmptyContentField = "planLabels" | "location" | "areaSqm";

export type EmptyFieldFilter = "all" | "any" | EmptyContentField;

export interface EmptyFieldSource {
  planLabel?: string | null;
  planLabels?: string[] | null;
  location?: string | null;
  areaSqm?: number | null;
}

export interface EmptyFieldScope {
  /** Default true — every ownable item can have a topic. */
  planLabels?: boolean;
  location?: boolean;
  areaSqm?: boolean;
}

export const EMPTY_CONTENT_FIELD_LABELS: Record<EmptyContentField, string> = {
  planLabels: "موضوع",
  location: "محل اکران",
  areaSqm: "متراژ",
};

export const EMPTY_FIELD_FILTER_OPTIONS: { value: EmptyFieldFilter; label: string }[] = [
  { value: "all", label: "همه موارد" },
  { value: "any", label: "فیلد خالی (موضوع، محل اکران یا متراژ)" },
  { value: "planLabels", label: "بدون موضوع" },
  { value: "location", label: "بدون محل اکران" },
  { value: "areaSqm", label: "بدون متراژ" },
];

function isBlank(value?: string | null): boolean {
  return !value?.trim();
}

function isEmptyArea(value?: number | null): boolean {
  return value == null || !Number.isFinite(value) || value <= 0;
}

function isEmptyPlanLabels(item: EmptyFieldSource): boolean {
  return normalizePlanLabels(item.planLabels, item.planLabel).length === 0;
}

export function inferEmptyFieldScope(item: object): EmptyFieldScope {
  return {
    planLabels: true,
    location: Object.prototype.hasOwnProperty.call(item, "location"),
    areaSqm: Object.prototype.hasOwnProperty.call(item, "areaSqm"),
  };
}

export function emptyFieldScopeForContentType(contentType: string): EmptyFieldScope {
  const normalized = contentType.replace(/_/g, "");
  if (normalized === "billboard") {
    return { planLabels: true, location: true, areaSqm: true };
  }
  if (normalized === "activity" || normalized === "meeting") {
    return { planLabels: true, location: true, areaSqm: false };
  }
  return { planLabels: true, location: false, areaSqm: false };
}

export function collectEmptyContentFields(
  item: EmptyFieldSource,
  scope: EmptyFieldScope = inferEmptyFieldScope(item)
): EmptyContentField[] {
  const fields: EmptyContentField[] = [];
  if (scope.planLabels !== false && isEmptyPlanLabels(item)) {
    fields.push("planLabels");
  }
  if (scope.location && isBlank(item.location)) {
    fields.push("location");
  }
  if (scope.areaSqm && isEmptyArea(item.areaSqm)) {
    fields.push("areaSqm");
  }
  return fields;
}

export function matchesEmptyFieldFilter(
  item: EmptyFieldSource,
  filter: EmptyFieldFilter,
  scope: EmptyFieldScope = inferEmptyFieldScope(item)
): boolean {
  if (filter === "all") return true;
  const empty = collectEmptyContentFields(item, scope);
  if (filter === "any") return empty.length > 0;
  return empty.includes(filter);
}

export function buildEmptyFieldsReferralReason(fields: EmptyContentField[]): string {
  const unique = [...new Set(fields)];
  if (unique.length === 0) {
    return "لطفاً فیلدهای خالی مانند محل اکران، متراژ یا موضوع را تکمیل کنید.";
  }
  const labels = unique.map((field) => EMPTY_CONTENT_FIELD_LABELS[field]);
  if (labels.length === 1) {
    return `لطفاً ${labels[0]} را تکمیل کنید.`;
  }
  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1).join("، ");
  return `لطفاً ${rest} و ${last} را تکمیل کنید.`;
}

export function referralReasonForEmptyItems(
  items: Array<{ emptyFields?: EmptyContentField[] }>,
  filter: EmptyFieldFilter = "any"
): string {
  if (filter !== "all" && filter !== "any") {
    return buildEmptyFieldsReferralReason([filter]);
  }
  const fields = items.flatMap((item) => item.emptyFields ?? []);
  return buildEmptyFieldsReferralReason(fields);
}
