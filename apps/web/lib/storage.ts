import { createStorage, type StorageProvider } from "@repo/core";
import { getEnv } from "./env";

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = createStorage({
    driver: env.STORAGE_DRIVER,
    localDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL ?? env.NEXT_PUBLIC_APP_URL,
    // Only the S3 driver reads this block; local ignores it entirely.
    s3:
      env.S3_BUCKET === undefined
        ? undefined
        : {
            bucket: env.S3_BUCKET,
            region: env.S3_REGION,
            endpoint: env.S3_ENDPOINT,
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          },
  });
  return cached;
}

export { createStorage };
export type { StorageProvider };
