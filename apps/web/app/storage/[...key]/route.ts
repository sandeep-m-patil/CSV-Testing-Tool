import { createStorage } from "@repo/core";
import { NextResponse } from "next/server";

/**
 * Serves discovery artifacts stored with the local filesystem driver.
 * The S3 driver uses presigned URLs / S3 hosting instead of this route.
 */
export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  const keySegments = (await context.params).key;
  const key = keySegments.join("/");
  const storage = createStorage({
    driver: (process.env.STORAGE_DRIVER as "local" | "s3") ?? "local",
    localDir: process.env.STORAGE_LOCAL_DIR,
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL,
  });

  if (storage.driver !== "local") {
    return NextResponse.json({ data: null, error: { message: "Not served by this route" } }, { status: 404 });
  }

  try {
    const buffer = await storage.get(key);
    const contentType = guessContentType(key);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(key.split("/").pop() ?? "artifact")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: "Artifact not found" } }, { status: 404 });
  }
}

function guessContentType(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".zip")) return "application/zip";
  if (key.endsWith(".json")) return "application/json";
  if (key.endsWith(".log") || key.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}