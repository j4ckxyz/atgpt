import { NextResponse } from "next/server";

import { fetchAgentStatus, SESSION_COOKIE } from "@/lib/cocore";

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

  const res = NextResponse.json({ ok: true, status: result.data });
  res.cookies.set(SESSION_COOKIE, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
