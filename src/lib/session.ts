/**
 * Account session for cross-device sync.
 *
 * The co/core API key (in its own httpOnly cookie) stays the credential for
 * talking to co/core. For sync we also need to know *which account* a request
 * belongs to without re-hitting co/core every time. The account key is the
 * user's DID — not secret, but a client must not be able to forge it and read
 * someone else's chats. So we store the DID in an httpOnly cookie signed with an
 * HMAC over a server secret, and verify the signature on every sync request.
 */
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const DID_COOKIE = "atgpt_did";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need >= 16 chars). Set it in your environment."
    );
  }
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Cookie value: `<did>.<hmac>`. */
export function signDid(did: string): string {
  return `${did}.${sign(did)}`;
}

/** Verify a `<did>.<hmac>` token; returns the DID or null if tampered. */
export function verifyDidToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const did = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(did);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return did;
}

/** Resolve the signed-in account DID from the cookie (server only). */
export async function getUserDid(): Promise<string | null> {
  const store = await cookies();
  return verifyDidToken(store.get(DID_COOKIE)?.value);
}
