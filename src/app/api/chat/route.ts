import { COCORE_BASE, getApiKey } from "@/lib/cocore";
import { getUserDid } from "@/lib/session";
import { getInjectableProfile } from "@/lib/store";

export const runtime = "nodejs";
// Streaming responses must not be statically cached or buffered.
export const dynamic = "force-dynamic";

type ChatBody = {
  model?: string;
  messages?: { role: string; content: string }[];
  friendsOnly?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
};

export async function POST(req: Request) {
  const key = await getApiKey();
  if (!key) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: "model and at least one message are required" },
      { status: 400 }
    );
  }

  const path = body.friendsOnly
    ? "/api/v1/private/chat/completions"
    : "/api/v1/chat/completions";

  // Personalize: prepend a compact profile as a system message when the user
  // has AT Personalisation on and a condensed profile exists.
  let messages = body.messages;
  try {
    const did = await getUserDid();
    const profile = did ? await getInjectableProfile(did) : null;
    if (profile && messages[0]?.role !== "system") {
      messages = [
        {
          role: "system",
          content:
            "Background about the person you're talking to (use it to personalize " +
            "your replies; don't recite it back):\n" +
            profile,
        },
        ...messages,
      ];
    }
  } catch {
    /* personalization is best-effort; never block chat */
  }

  const upstream = await fetch(`${COCORE_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: body.model,
      messages,
      stream: true,
      max_tokens: body.max_tokens ?? 1024,
      ...(body.temperature !== undefined
        ? { temperature: body.temperature }
        : {}),
      ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
    }),
  });

  // Pass through the upstream response verbatim — SSE stream on success,
  // a JSON error envelope (with a stable cocore `code`) on failure.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
