// AES-256-GCM encryption for OAuth tokens at rest. The encryption key is
// derived from `AUTH_SECRET` via SHA-256 so we don't ship a separate secret.
//
// Output format: `<ivHex>:<authTagHex>:<cipherHex>`. Backwards-compatible with
// any future rotation that prepends a key id (none today).

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { getRequiredEnv } from "@/lib/env";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  return createHash("sha256").update(getRequiredEnv("AUTH_SECRET")).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(payload: string): string {
  const [ivHex, tagHex, encHex] = payload.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Malformed encrypted token payload");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
