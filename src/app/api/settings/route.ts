import { NextResponse } from "next/server";

import { getUserDid } from "@/lib/session";
import { getSettings, saveSettings, type UserSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings — per-account chat preferences. */
export async function GET() {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ settings: await getSettings(did) });
}

/** PUT /api/settings — partial update of chat preferences. */
export async function PUT(req: Request) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Partial<UserSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Whitelist + coerce the fields we persist.
  const patch: Partial<UserSettings> = {};
  if (typeof body.model === "string") patch.model = body.model;
  if (typeof body.friendsOnly === "boolean") patch.friendsOnly = body.friendsOnly;
  if (typeof body.temperature === "number")
    patch.temperature = Math.max(0, Math.min(2, body.temperature));
  if (typeof body.topP === "number")
    patch.topP = Math.max(0, Math.min(1, body.topP));
  if (typeof body.maxTokens === "number")
    patch.maxTokens = Math.max(1, Math.min(8192, Math.round(body.maxTokens)));

  await saveSettings(did, patch);
  return NextResponse.json({ ok: true });
}
