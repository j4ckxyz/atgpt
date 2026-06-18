import { NextResponse } from "next/server";

import { fetchAgentStatus, fetchLatestVersion, getApiKey } from "@/lib/cocore";

export async function GET() {
  const key = await getApiKey();
  if (!key) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [status, latestVersion] = await Promise.all([
    fetchAgentStatus(key),
    fetchLatestVersion(),
  ]);

  if (!status.ok) {
    return NextResponse.json(
      { error: status.message },
      { status: status.status }
    );
  }

  return NextResponse.json({ status: status.data, latestVersion });
}
