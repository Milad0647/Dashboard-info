export interface BillboardActingUser {
  id: string;
  email: string;
  name?: string;
}

export interface BillboardDisplayPeriodInput {
  id?: string;
  title?: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
  image?: Blob | null;
  billboardImage?: Blob | null;
  billboardImageUrl?: string | null;
  confirmationImageUrl?: string | null;
}

export async function createSystemBillboard(_params: {
  axis: string;
  address?: string;
  latitude: number;
  longitude: number;
  areaSqm?: number | null;
  province?: string | null;
  city?: string | null;
  actingUser?: BillboardActingUser | null;
}): Promise<string> {
  throw new Error("API خارجی بیلبورد غیرفعال شده است");
}

export async function attachBillboardToCampaign(_params: {
  externalCampaignId: string;
  billboardId: string;
  displayStart?: string | null;
  displayEnd?: string | null;
  notes?: string | null;
  executionImage?: Blob | null;
  actingUser?: BillboardActingUser | null;
}): Promise<string> {
  throw new Error("API خارجی بیلبورد غیرفعال شده است");
}

export async function addCampaignBillboardDesign(_params: {
  externalCampaignId: string;
  assignmentId: string;
  period: BillboardDisplayPeriodInput;
  actingUser?: BillboardActingUser | null;
}): Promise<void> {
  throw new Error("API خارجی بیلبورد غیرفعال شده است");
}

export function computeDisplayRangeFromPeriods(
  periods: Pick<BillboardDisplayPeriodInput, "startDate" | "endDate">[]
): { displayStart?: string; displayEnd?: string } {
  const starts = periods.map((p) => p.startDate).filter(Boolean).sort();
  const ends = periods.map((p) => p.endDate).filter(Boolean).sort();
  if (starts.length === 0 || ends.length === 0) return {};
  return { displayStart: starts[0], displayEnd: ends[ends.length - 1] };
}

export async function resolveAssignmentIdForBillboard(_params: {
  externalCampaignSlug: string;
  assignmentId?: string | null;
  billboardExternalId?: string | null;
}): Promise<string> {
  throw new Error("API خارجی بیلبورد غیرفعال شده است");
}
