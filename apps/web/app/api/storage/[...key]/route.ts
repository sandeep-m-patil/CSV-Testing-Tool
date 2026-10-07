import { NextResponse } from "next/server";
import { isAppError, normalizeStorageKey } from "@repo/core";
import { getStorage } from "@/lib/storage";
import { authorizeStorageKey } from "@/lib/storage-access";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  json: "application/json",
  csv: "text/csv",
  log: "text/plain; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

/** Serves run and discovery evidence to signed-in owners of the module it belongs to. */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const { key: keyParts } = await params;
    const key = normalizeStorageKey(decodeURIComponent(keyParts.join("/")));
    if (!key) {
      return new NextResponse("Missing key", { status: 400 });
    }
    await authorizeStorageKey(key);

    const storage = getStorage();
    if (!(await storage.exists(key))) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = await storage.get(key);
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isAppError(error)) return new NextResponse(error.message, { status: error.status });
    return new NextResponse("Storage error", { status: 500 });
  }
}