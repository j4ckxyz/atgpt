/**
 * Condense a user's ingested AT Protocol data into a tiny personalization
 * profile, using their own Gemini key. The whole point is frugality: we
 * aggregate music locally, sample posts, and make exactly ONE generative call,
 * caching the result so small local models get rich context for ~free.
 */
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { atProfile, atRecords } from "@/db/schema";
import { POSTS, PLAYS } from "@/lib/ingest";
import { getPersonalization } from "@/lib/store";

// Floating alias so we ride the current flash model (2.5-flash retires soon).
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const POST_SAMPLE = 80; // recent original posts to sample
const PLAY_SAMPLE = 600; // recent plays to aggregate
const RECONDENSE_MIN_NEW = 25; // don't re-spend a call for a handful of records

type PostValue = { text?: string; reply?: unknown; createdAt?: string };
type PlayValue = {
  trackName?: string;
  releaseName?: string;
  artists?: { artistName?: string }[];
};

export type CondenseResult = {
  ok: boolean;
  skipped?: "off" | "no-key" | "no-data" | "fresh";
  profile?: string;
  error?: string;
};

export async function condenseUser(
  did: string,
  opts: { force?: boolean } = {}
): Promise<CondenseResult> {
  const personalization = await getPersonalization(did);
  if (!personalization.atPersonalization) return { ok: false, skipped: "off" };
  if (!personalization.geminiKey) return { ok: false, skipped: "no-key" };

  const [profileRow] = await db
    .select()
    .from(atProfile)
    .where(eq(atProfile.userDid, did))
    .limit(1);

  const postRows = await db
    .select({ json: atRecords.json })
    .from(atRecords)
    .where(and(eq(atRecords.userDid, did), eq(atRecords.collection, POSTS)))
    .orderBy(desc(atRecords.createdAt))
    .limit(POST_SAMPLE * 3);

  const playRows = await db
    .select({ json: atRecords.json })
    .from(atRecords)
    .where(and(eq(atRecords.userDid, did), eq(atRecords.collection, PLAYS)))
    .orderBy(desc(atRecords.createdAt))
    .limit(PLAY_SAMPLE);

  const totalRecords = postRows.length + playRows.length;
  if (totalRecords === 0) return { ok: false, skipped: "no-data" };

  // Throttle: skip if we already condensed and little new has arrived.
  if (
    !opts.force &&
    profileRow?.lastCondensedAt &&
    totalRecords - (profileRow.condensedFromCount ?? 0) < RECONDENSE_MIN_NEW
  ) {
    return { ok: true, skipped: "fresh", profile: profileRow.profileText ?? undefined };
  }

  // --- Aggregate music taste locally (no tokens spent) ---
  const artistCounts = new Map<string, number>();
  const trackCounts = new Map<string, number>();
  for (const row of playRows) {
    let v: PlayValue;
    try {
      v = JSON.parse(row.json);
    } catch {
      continue;
    }
    for (const a of v.artists ?? []) {
      const name = a.artistName?.trim();
      if (name) artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
    }
    if (v.trackName) {
      const t = `${v.trackName}${v.artists?.[0]?.artistName ? ` — ${v.artists[0].artistName}` : ""}`;
      trackCounts.set(t, (trackCounts.get(t) ?? 0) + 1);
    }
  }
  const topArtists = topN(artistCounts, 12);
  const topTracks = topN(trackCounts, 8);

  // --- Sample recent original posts ---
  const samplePosts: string[] = [];
  for (const row of postRows) {
    if (samplePosts.length >= POST_SAMPLE) break;
    let v: PostValue;
    try {
      v = JSON.parse(row.json);
    } catch {
      continue;
    }
    const text = (v.text ?? "").trim();
    if (!text || v.reply) continue; // originals only, for a cleaner "voice"
    samplePosts.push(text.length > 220 ? text.slice(0, 220) + "…" : text);
  }

  const prompt = buildPrompt({
    displayName: profileRow?.displayName ?? null,
    handle: profileRow?.handle ?? null,
    bio: profileRow?.description ?? null,
    topArtists,
    topTracks,
    totalPlays: playRows.length,
    posts: samplePosts,
  });

  // --- ONE Gemini call ---
  let profileText: string;
  try {
    profileText = await callGemini(personalization.geminiKey, prompt);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  profileText = profileText.trim();
  if (!profileText) return { ok: false, error: "Empty profile from Gemini" };

  const facts = {
    topArtists: topArtists.map(([name, n]) => ({ name, plays: n })),
    topTracks: topTracks.map(([name]) => name),
    totalPlays: playRows.length,
    postsAnalyzed: samplePosts.length,
  };

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(atProfile)
    .set({
      profileText,
      factsJson: JSON.stringify(facts),
      condensedFromCount: totalRecords,
      lastCondensedAt: now,
      updatedAt: now,
    })
    .where(eq(atProfile.userDid, did));

  return { ok: true, profile: profileText };
}

function topN(counts: Map<string, number>, n: number): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function buildPrompt(d: {
  displayName: string | null;
  handle: string | null;
  bio: string | null;
  topArtists: [string, number][];
  topTracks: [string, number][];
  totalPlays: number;
  posts: string[];
}): string {
  const lines: string[] = [];
  lines.push(
    "Build a COMPACT personalization profile of a person from their social data.",
    "It will be given to an AI assistant as background so replies feel personal.",
    "Write under 160 words, third person, concrete and specific. No preamble,",
    "no headings, no bullet lists — just a tight paragraph or two covering their",
    "interests and recurring topics, their writing tone/voice, and their music taste.",
    "Do not invent facts beyond what's provided.",
    ""
  );
  if (d.displayName || d.handle)
    lines.push(`Name: ${d.displayName ?? ""} (@${d.handle ?? "?"})`);
  if (d.bio) lines.push(`Bio: ${d.bio}`);
  if (d.topArtists.length)
    lines.push(
      `Top music artists (by play count): ${d.topArtists
        .map(([a, n]) => `${a} (${n})`)
        .join(", ")}`
    );
  if (d.topTracks.length)
    lines.push(`Most-played tracks: ${d.topTracks.map(([t]) => t).join(", ")}`);
  lines.push(`Total recent scrobbles analyzed: ${d.totalPlays}`);
  if (d.posts.length) {
    lines.push("", "Recent posts (sample):");
    for (const p of d.posts) lines.push(`- ${p}`);
  }
  return lines.join("\n");
}

async function callGemini(key: string, prompt: string): Promise<string> {
  const res = await fetch(GEMINI_URL(GEMINI_MODEL, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 600,
        // gemini-2.5-flash is a thinking model; disable it so the whole token
        // budget goes to the profile (and we make exactly one cheap call).
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error?.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Gemini request failed: ${detail}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
}
