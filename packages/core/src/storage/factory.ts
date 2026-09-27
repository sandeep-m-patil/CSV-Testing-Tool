import type { StorageProvider } from "./index";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

export interface StorageFactoryOptions {
  driver: "local" | "s3";
  localDir?: string;
  publicBaseUrl?: string;
  s3?: {
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    prefix?: string;
    forcePathStyle?: boolean;
  };
}

export function createStorage(options: StorageFactoryOptions): StorageProvider {
  switch (options.driver) {
    case "local":
      return new LocalStorage({
        dir: options.localDir ?? "./data/storage",
        publicBaseUrl: options.publicBaseUrl ?? "http://localhost:3000",
      });
    case "s3": {
      if (!options.s3?.bucket) {
        throw new Error("S3 bucket is required when STORAGE_DRIVER=s3");
      }
      return new S3Storage({
        bucket: options.s3.bucket,
        region: options.s3.region,
        endpoint: options.s3.endpoint,
        accessKeyId: options.s3.accessKeyId,
        secretAccessKey: options.s3.secretAccessKey,
        publicBaseUrl: options.publicBaseUrl,
        prefix: options.s3.prefix,
        forcePathStyle: options.s3.forcePathStyle,
      });
    }
  }
}