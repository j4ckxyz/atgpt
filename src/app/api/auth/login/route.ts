import { NextResponse } from "next/server";

import { fetchAgentStatus, SESSION_COOKIE } from "@/lib/cocore";
import { refreshPersonalization } from "@/lib/personalize";
import { DID_COOKIE, signDid } from "@/lib/session";
import { ensureUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let apiKey: string | undefined;
  try {
    const body = await req.json();
    apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  if (!apiKey.startsWith("cocore-")) {
    return NextResponse.json(
      { error: "That doesn't look like a co/core key (expected cocore-…)" },
      { status: 400 }
    );
  }

  // Validate the key by hitting the authed status endpoint.
  const result = await fetchAgentStatus(apiKey);
  if (!result.ok) {
    const status = result.status === 401 ? 401 : 502;
    return NextResponse.json(
      {
        error:
          result.status === 401
            ? "Invalid API key. Mint a fresh one in the co/core console."
            : result.message,
      },
      { status }
    );
  }

  // Provision the account (keyed on DID) for cross-device sync.
  const did = result.data.did;
  try {
    await ensureUser(did);
  } catch (e) {
    console.error("ensureUser failed", e);
    return NextResponse.json(
      { error: "Could not initialise your account storage." },
      { status: 500 }
    );
  }

  // Kick off AT Proto ingestion in the background (throttled; respects the
  // personalization switch). Never blocks sign-in.
  void refreshPersonalization(did).catch((e) =>
    console.error("background personalization refresh failed", e)
  );

  const res = NextResponse.json({ ok: true, status: result.data });
  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
  res.cookies.set(SESSION_COOKIE, apiKey, cookieBase);
  res.cookies.set(DID_COOKIE, signDid(did), cookieBase);
  return res;
}
