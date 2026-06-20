/**
 * Symmetric encryption for third-party credentials stored at rest (the user's
 * Gemini API key). AES-256-GCM with a key derived from AUTH_SECRET, so a leaked
 * database file alone doesn't expose anyone's key.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is required to encrypt secrets.");
  }
  cachedKey = scryptSync(secret, "atgpt-secrets-v1", 32);
  return cachedKey;
}

/** Encrypt a string → base64(iv | authTag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt a value produced by encryptSecret; returns null on any failure. */
export function decryptSecret(packed: string | null | undefined): string | null {
  if (!packed) return null;
  try {
    const buf = Buffer.from(packed, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
