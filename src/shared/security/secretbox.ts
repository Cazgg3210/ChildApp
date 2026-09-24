import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/shared/config/env";

/**
 * Symmetric encryption for secrets stored in the database (SMTP passwords…).
 * AES-256-GCM with a key derived from AUTH_SECRET, so rotating AUTH_SECRET
 * invalidates stored secrets (they must be re-entered in /admin).
 * Format: base64url(iv) . base64url(ciphertext) . base64url(tag)
 */
function key(): Buffer {
  return createHash("sha256").update(env().AUTH_SECRET).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${enc.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function openSecret(sealed: string): string | null {
  const [iv, enc, tag] = sealed.split(".");
  if (!iv || !enc || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
