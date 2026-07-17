import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";
import { logAuditForSession } from "@/lib/audit/log-event";
import type { AuditCategory } from "@/lib/audit/types";
import { isPostgresConfigured } from "@/lib/utils";

const ALLOWED_ACTIONS = new Set([
  "navigation.page_view",
  "ui.click",
  "presence.heartbeat",
]);
const MAX_LABEL_LENGTH = 200;
const MAX_PATH_LENGTH = 500;

interface TrackPayload {
  action?: string;
  path?: string;
  label?: string;
  campaignId?: string;
  metadata?: Record<string, unknown>;
}

function sanitize(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ success: true, skipped: true });
  }

  const session = await getAuthSession();
  // Only track authenticated panel activity.
  if (!session) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload: TrackPayload;
  try {
    payload = (await request.json()) as TrackPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const action = payload.action;
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  }

  const category: AuditCategory =
    action === "ui.click" ? "ui" : action === "presence.heartbeat" ? "system" : "navigation";
  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : undefined;

  await logAuditForSession(session, {
    category,
    action,
    path: sanitize(payload.path, MAX_PATH_LENGTH),
    label:
      action === "presence.heartbeat"
        ? "آنلاین"
        : sanitize(payload.label, MAX_LABEL_LENGTH),
    campaignId: sanitize(payload.campaignId, 64),
    metadata,
  });

  return NextResponse.json({ success: true });
}
