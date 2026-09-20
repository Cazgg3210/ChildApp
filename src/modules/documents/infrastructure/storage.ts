import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/shared/config/env";
import { signValue, verifySignedValue } from "@/shared/security/tokens";

export interface StoredObject {
  bytes: Buffer;
  contentType: string;
}

/**
 * Object storage abstraction. Child photos and documents are always private:
 * the only way to read them is a short-lived signed URL issued after an
 * authorization check.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}

function safeKey(key: string): string {
  if (!/^[A-Za-z0-9/_\-.]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

/** Development / single-node storage: files on disk, URLs signed with AUTH_SECRET and served by /files/[token]. */
export class LocalDiskStorage implements StorageProvider {
  readonly name = "local";
  private root = path.resolve(env().STORAGE_LOCAL_DIR);

  private pathFor(key: string) {
    return path.join(this.root, safeKey(key));
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta`, JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const file = this.pathFor(key);
      const [bytes, meta] = await Promise.all([readFile(file), readFile(`${file}.meta`, "utf8").catch(() => "{}")]);
      return { bytes, contentType: (JSON.parse(meta).contentType as string) ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const file = this.pathFor(key);
    await rm(file, { force: true });
    await rm(`${file}.meta`, { force: true });
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    const token = signValue(`${safeKey(key)}|${expires}`, env().AUTH_SECRET);
    return `${env().APP_URL}/files/${encodeURIComponent(token)}`;
  }

  /** Used by the /files route: returns the key when the token is valid and not expired. */
  static verifyToken(token: string): string | null {
    const value = verifySignedValue(token, env().AUTH_SECRET);
    if (!value) return null;
    const [key, expires] = value.split("|");
    if (!key || Number(expires) < Date.now()) return null;
    return key;
  }
}

/** S3-compatible storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO). */
export class S3Storage implements StorageProvider {
  readonly name = "s3";
  private clientPromise?: Promise<{ client: import("@aws-sdk/client-s3").S3Client; bucket: string }>;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const e = env();
        if (!e.S3_BUCKET) throw new Error("S3_BUCKET is not configured");
        const { S3Client } = await import("@aws-sdk/client-s3");
        const client = new S3Client({
          region: e.S3_REGION,
          endpoint: e.S3_ENDPOINT || undefined,
          forcePathStyle: e.S3_FORCE_PATH_STYLE,
          credentials:
            e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
              ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
              : undefined,
        });
        return { client, bucket: e.S3_BUCKET };
      })();
    }
    return this.clientPromise;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = await this.client();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: safeKey(key), Body: bytes, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    const { client, bucket } = await this.client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
      const bytes = Buffer.from(await res.Body!.transformToByteArray());
      return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = await this.client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const { client, bucket } = await this.client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }), { expiresIn: ttlSeconds });
  }
}

let instance: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (!instance) instance = env().STORAGE_PROVIDER === "s3" ? new S3Storage() : new LocalDiskStorage();
  return instance;
}
