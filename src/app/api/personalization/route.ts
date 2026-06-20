import { NextResponse } from "next/server";

import { getUserDid } from "@/lib/session";
import { getPersonalizationStatus, savePersonalization } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/personalization — status for the settings page. */
export async function GET() {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ status: await getPersonalizationStatus(did) });
}

/** PUT /api/personalization — update the Gemini key and/or the on/off switch. */
export async function PUT(req: Request) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { geminiApiKey?: string | null; atPersonalization?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: { geminiApiKey?: string | null; atPersonalization?: boolean } = {};
  if (typeof body.atPersonalization === "boolean")
    patch.atPersonalization = body.atPersonalization;
  if (typeof body.geminiApiKey === "string")
    patch.geminiApiKey = body.geminiApiKey.trim();

  await savePersonalization(did, patch);
  return NextResponse.json({ status: await getPersonalizationStatus(did) });
}
