import { createDailyBackupsForAllCampaigns } from "@/lib/services/stored-backup";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const bearer =
    authorization?.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;

  return bearer === secret || headerSecret === secret;
}

async function handleCron(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json(
      {
        success: false,
        error:
          "Unauthorized. Set CRON_SECRET and send Authorization: Bearer <secret>.",
      },
      { status: 401 }
    );
  }

  if (!isPostgresConfigured()) {
    return Response.json(
      { success: false, error: "Database is not configured" },
      { status: 503 }
    );
  }

  const summary = await createDailyBackupsForAllCampaigns();

  return Response.json({
    success: true,
    createdCount: summary.created.length,
    failedCount: summary.failed.length,
    summary,
  });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
