import { NextResponse } from "next/server";
import { getDb } from "@repo/db";
import { route } from "@/lib/api";

export const GET = route(async () => {
  const started = Date.now();
  const db = getDb();
  await db.execute("SELECT 1");
  const sqlMs = Date.now() - started;

  let redisOk = true;
  let redisMs = 0;
  try {
    const { default: IORedis } = await import("ioredis");
    const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    const redisStart = Date.now();
    await redis.ping();
    redisMs = Date.now() - redisStart;
    await redis.quit();
  } catch {
    redisOk = false;
  }

  return NextResponse.json({
    data: {
      status: redisOk && sqlMs < 2000 ? "ok" : "degraded",
      checks: {
        database: { ok: true, ms: sqlMs },
        redis: { ok: redisOk, ms: redisMs },
      },
    },
  });
});