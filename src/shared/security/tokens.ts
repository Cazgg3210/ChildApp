import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 32 random bytes, base64url (43 chars). Used for share links and auth tokens. */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored hashed; the plaintext only ever lives in the URL / email. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Human-friendly invite code (e.g. "ARC-7K3P9Q"), no ambiguous characters. */
export function generateInviteCode(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  const p = prefix
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");
  return `${p}-${code}`;
}

export function signValue(value: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function verifySignedValue(signed: string, secret: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}
