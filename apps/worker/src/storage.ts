import { createStorage, type StorageProvider } from "@repo/core";
import { env } from "./env";

let cached: StorageProvider | null = null;

/** The worker's evidence store, local folder or S3-compatible bucket, per env. */
export function getWorkerStorage(): StorageProvider {
  cached ??= createStorage({
    driver: env.STORAGE_DRIVER,
    localDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
    s3: env.S3_BUCKET
      ? {
          bucket: env.S3_BUCKET,
          region: env.S3_REGION,
          endpoint: env.S3_ENDPOINT,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  return cached;
}
