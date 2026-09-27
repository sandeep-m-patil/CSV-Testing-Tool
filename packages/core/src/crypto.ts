import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const DEV_FALLBACK_KEY = "autotest-dev-key-change-me-in-production-0001";

export interface EncryptionKeySource {
  get(): Buffer;
}

export class EnvEncryptionKey implements EncryptionKeySource {
  private readonly buffer: Buffer;

  constructor(envKey: string | undefined) {
    if (envKey && envKey.length > 0) {
      const decoded = Buffer.from(envKey, "base64");
      if (decoded.length !== 32) {
        throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
      }
      this.buffer = decoded;
      return;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("CREDENTIAL_ENCRYPTION_KEY is required in production.");
    }
    this.buffer = createHash("sha256").update(DEV_FALLBACK_KEY).digest();
  }

  get(): Buffer {
    return this.buffer;
  }
}

export class CredentialCrypto {
  private readonly key: Buffer;

  constructor(keySource: EncryptionKeySource = new EnvEncryptionKey(process.env.CREDENTIAL_ENCRYPTION_KEY)) {
    this.key = keySource.get();
  }

  decryptCredentials(scopedKey: string, secretPayload: string): { username: string; password: string } | null {
    const parsed = this.decryptText(scopedKey, secretPayload);
    if (parsed === null) {
      return null;
    }
    try {
      const value = JSON.parse(parsed) as unknown;
      if (
        typeof value === "object" &&
        value !== null &&
        "username" in value &&
        "password" in value &&
        typeof (value as Record<string, unknown>).username === "string" &&
        typeof (value as Record<string, unknown>).password === "string"
      ) {
        return value as { username: string; password: string };
      }
      return null;
    } catch {
      return null;
    }
  }

  encryptCredentials(scopedKey: string, username: string, password: string): string {
    return this.encryptText(scopedKey, JSON.stringify({ username, password }));
  }

  encryptText(scopedKey: string, plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const key = this.deriveKey(scopedKey);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
  }

  decryptText(scopedKey: string, token: string): string | null {
    const parts = token.split(":");
    if (parts.length !== 3) {
      return null;
    }
    const [ivB64, tagB64, dataB64] = parts as [string, string, string];
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const key = this.deriveKey(scopedKey);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    try {
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }

  private deriveKey(scopedKey: string): Buffer {
    return createHash("sha256").update(scopedKey).update(this.key).digest();
  }

  publicConstantTimeEqual(a: string, b: string): boolean {
    const ha = createHash("sha256").update(a).digest();
    const hb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ha, hb);
  }
}

export function maskSecret(value: string): string {
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export const credentialCrypto = new CredentialCrypto();