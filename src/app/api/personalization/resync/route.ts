import { NextResponse } from "next/server";

import { refreshPersonalization } from "@/lib/personalize";
import { getUserDid } from "@/lib/session";
import { getPersonalizationStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingest + one Gemini call can take a little while.
export const maxDuration = 60;

/** POST /api/personalization/resync — force a re-ingest + re-condense now. */
export async function POST() {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await refreshPersonalization(did, { force: true });
  return NextResponse.json({
    result,
    status: await getPersonalizationStatus(did),
  });
}
