import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StorageProvider } from "./index";

export interface LocalStorageOptions {
  dir: string;
  publicBaseUrl: string;
}

export class LocalStorage implements StorageProvider {
  readonly driver = "local" as const;

  private readonly dir: string;
  private readonly publicBaseUrl: string;

  constructor(options: LocalStorageOptions) {
    this.dir = path.resolve(options.dir);
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
  }

  async put(key: string, body: Buffer | Uint8Array | Readable, _contentType?: string): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    if (body instanceof Readable) {
      await pipeline(body, createWriteStream(target));
      return;
    }
    await writeFile(target, Buffer.from(body));
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/storage/${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  private resolve(key: string): string {
    const safeKey = key.split("/").filter(Boolean).join("/");
    const target = path.resolve(this.dir, safeKey);
    if (!target.startsWith(path.resolve(this.dir))) {
      throw new Error("Storage key escapes root");
    }
    return target;
  }
}