import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { StorageProvider } from "./index";

export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  prefix?: string;
  forcePathStyle?: boolean;
}

export class S3Storage implements StorageProvider {
  readonly driver = "s3" as const;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly publicBaseUrl?: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = (options.prefix ?? "").replace(/\/$/, "");
    this.publicBaseUrl = options.publicBaseUrl?.replace(/\/$/, "");
    this.client = new S3Client({
      region: options.region ?? "us-east-1",
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    });
  }

  private fullKey(key: string): string {
    return this.prefix.length > 0 ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, body: Buffer | Uint8Array | Readable, contentType = "application/octet-stream"): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }));
    const body = result.Body;
    if (!body) {
      throw new Error("Empty object returned from storage");
    }
    if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
      return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${this.fullKey(key)}`;
    }
    return `s3://${this.bucket}/${this.fullKey(key)}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }));
      return true;
    } catch {
      return false;
    }
  }
}