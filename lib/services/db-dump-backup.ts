import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { mkdir, rename, unlink, stat } from "fs/promises";
import path from "path";
import { getBackupsDir } from "@/lib/backups";
import { getTehranCalendarDateIso } from "@/lib/safe-dates";

export interface DbDumpResult {
  filename: string;
  sizeBytes: number;
}

/**
 * Dump the whole Postgres database into BACKUP_DIR.
 * Required for true disaster recovery (bring app back in hours).
 */
export async function createPostgresDumpBackup(): Promise<DbDumpResult> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const dir = getBackupsDir();
  await mkdir(dir, { recursive: true });

  const day = getTehranCalendarDateIso();
  const filename = `db-dump-${day}.sql`;
  const finalPath = path.join(dir, filename);
  const tempPath = `${finalPath}.tmp`;

  try {
    await unlink(tempPath);
  } catch {
    // ignore
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      [
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
        `--dbname=${databaseUrl}`,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      }
    );

    const out = createWriteStream(tempPath);
    let stderr = "";

    child.stdout.pipe(out);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(
        error instanceof Error
          ? error
          : new Error("pg_dump failed to start (is postgresql-client installed?)")
      );
    });

    out.on("error", reject);

    child.on("close", (code) => {
      out.end(() => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
      });
    });
  });

  await rename(tempPath, finalPath);
  const info = await stat(finalPath);
  if (info.size < 64) {
    await unlink(finalPath).catch(() => undefined);
    throw new Error("pg_dump produced an empty dump");
  }

  return { filename, sizeBytes: info.size };
}
