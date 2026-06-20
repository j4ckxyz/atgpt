import { NextResponse } from "next/server";

import { getUserDid } from "@/lib/session";
import {
  listConversations,
  saveConversation,
  type WireMessage,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** GET /api/conversations — metadata list for the signed-in account. */
export async function GET() {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ conversations: await listConversations(did) });
}

/** POST /api/conversations — create a conversation (optionally with messages). */
export async function POST(req: Request) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { id?: string; title?: string; messages?: WireMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const id = typeof body.id === "string" && body.id ? body.id : uid();
  const ok = await saveConversation(did, id, {
    title: body.title,
    messages: body.messages,
  });
  if (!ok) return NextResponse.json({ error: "Conflict" }, { status: 409 });

  return NextResponse.json({ id }, { status: 201 });
}
