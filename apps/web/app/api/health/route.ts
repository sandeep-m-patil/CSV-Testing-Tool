import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDb, jobQueue } from "@repo/db";
import { route } from "@/lib/api";

const SLOW_DB_MS = 2000;

/** Database reachability plus job-queue depth. The queue lives in Postgres, so there is no Redis to check. */
export const GET = route(async () => {
  const started = Date.now();
  const db = getDb();
  await db.execute("SELECT 1");
  const sqlMs = Date.now() - started;
  const [queued] = await db.select({ total: count() }).from(jobQueue).where(eq(jobQueue.status, "queued"));

  return NextResponse.json({
    data: {
      status: sqlMs < SLOW_DB_MS ? "ok" : "degraded",
      checks: {
        database: { ok: true, ms: sqlMs },
        queue: { ok: true, backend: "postgres", queued: queued?.total ?? 0 },
      },
    },
  });
});
