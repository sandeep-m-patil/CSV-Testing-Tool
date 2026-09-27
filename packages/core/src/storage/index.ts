import type { Readable } from "node:stream";

export type StorageDriver = "local" | "s3";

export interface StorageProvider {
  readonly driver: StorageDriver;
  put(key: string, body: Buffer | Uint8Array | Readable, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export function normalizeStorageKey(key: string): string {
  return key.split("/").filter(Boolean).join("/");
}

export * from "./local";
export * from "./s3";
export * from "./factory";