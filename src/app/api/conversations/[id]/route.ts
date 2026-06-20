import { NextResponse } from "next/server";

import { getUserDid } from "@/lib/session";
import {
  deleteConversation,
  getConversation,
  saveConversation,
  type WireMessage,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/conversations/[id] — full conversation with messages. */
export async function GET(_req: Request, { params }: Ctx) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const convo = await getConversation(did, id);
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation: convo });
}

/** PUT /api/conversations/[id] — upsert title and/or replace messages. */
export async function PUT(req: Request, { params }: Ctx) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  let body: { title?: string; messages?: WireMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ok = await saveConversation(did, id, {
    title: body.title,
    messages: body.messages,
  });
  if (!ok) return NextResponse.json({ error: "Conflict" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/conversations/[id]. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const did = await getUserDid();
  if (!did) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await deleteConversation(did, id);
  return NextResponse.json({ ok: true });
}
