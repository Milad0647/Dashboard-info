import { checkDatabaseConnection } from "@/lib/db/client";
import { getDatabaseMode } from "@/lib/utils";

export async function GET() {
  const mode = getDatabaseMode();

  if (mode === "postgres") {
    const dbOk = await checkDatabaseConnection();
    return Response.json(
      {
        status: dbOk ? "ok" : "degraded",
        database: dbOk ? "connected" : "disconnected",
        mode,
      },
      { status: dbOk ? 200 : 503 }
    );
  }

  return Response.json({ status: "ok", mode });
}
