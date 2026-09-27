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
  });
  return cached;
}

export { createStorage };
export type { StorageProvider };