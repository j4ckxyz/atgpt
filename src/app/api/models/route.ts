import { NextResponse } from "next/server";

import { fetchDirectory, fetchModels } from "@/lib/cocore";

export async function GET(req: Request) {
  const view = new URL(req.url).searchParams.get("view");
  const data = view === "directory" ? await fetchDirectory() : await fetchModels();
  if (!data) {
    return NextResponse.json(
      { error: "Could not reach the co/core model directory" },
      { status: 502 }
    );
  }
  return NextResponse.json(data);
}
