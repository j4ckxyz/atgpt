/**
 * Ingest a user's public AT Protocol data into the local store. Runs in the
 * background (fire-and-forget on login) and is incremental: because records
 * come newest-first, we stop as soon as we hit one we already have.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { atProfile, atRecords, ingestState } from "@/db/schema";
import { fetchProfile, listRecords, resolveDid } from "@/lib/atproto";

export const POSTS = "app.bsky.feed.post";
export const PLAYS = "fm.teal.alpha.feed.play";

const CAPS: Record<string, number> = {
  [POSTS]: 500, // recent posts are plenty for a taste profile
  [PLAYS]: 1500, // plays are tiny; keep more for music taste
};
const PAGE = 100;
const REINGEST_AFTER_MS = 30 * 60 * 1000; // throttle background re-ingest

// Avoid two concurrent ingests for the same account in one process.
const inFlight = new Set<string>();

function recordTime(value: Record<string, unknown>): number {
  const raw =
    (value.createdAt as string) ||
    (value.playedTime as string) ||
    (value.indexedAt as string);
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? Date.now() : t;
}

async function existingUris(did: string, collection: string): Promise<Set<string>> {
  const rows = await db
    .select({ uri: atRecords.uri })
    .from(atRecords)
    .where(and(eq(atRecords.userDid, did), eq(atRecords.collection, collection)));
  return new Set(rows.map((r) => r.uri));
}

async function ingestCollection(
  did: string,
  pds: string,
  collection: string
): Promise<number> {
  const cap = CAPS[collection] ?? 300;
  const seen = await existingUris(did, collection);
  const now = Math.floor(Date.now() / 1000);

  let cursor: string | undefined;
  let added = 0;
  let caughtUp = false;

  while (!caughtUp && seen.size < cap + added) {
    const { records, cursor: next } = await listRecords(pds, did, collection, {
      limit: PAGE,
      cursor,
    });
    if (records.length === 0) break;

    const batch: (typeof atRecords.$inferInsert)[] = [];
    for (const rec of records) {
      if (seen.has(rec.uri)) {
        caughtUp = true; // newest-first: everything after is already stored
        break;
      }
      seen.add(rec.uri);
      batch.push({
        uri: rec.uri,
        userDid: did,
        collection,
        json: JSON.stringify(rec.value),
        createdAt: recordTime(rec.value),
        indexedAt: now,
      });
      added++;
      if (added >= cap) break;
    }

    if (batch.length > 0) {
      await db.insert(atRecords).values(batch).onConflictDoNothing();
    }

    if (added >= cap || !next) break;
    cursor = next;
  }

  const total = seen.size;
  await db
    .insert(ingestState)
    .values({ userDid: did, collection, recordCount: total, lastRunAt: now })
    .onConflictDoUpdate({
      target: [ingestState.userDid, ingestState.collection],
      set: { recordCount: total, lastRunAt: now },
    });

  return added;
}

export type IngestResult = {
  ok: boolean;
  handle: string | null;
  added: { posts: number; plays: number };
  error?: string;
};

/**
 * Ingest profile + posts + teal.fm plays for a DID. Throttled (skips if it ran
 * within the last 30 min) unless `force` is set.
 */
export async function ingestUser(
  did: string,
  opts: { force?: boolean } = {}
): Promise<IngestResult> {
  if (inFlight.has(did)) {
    return { ok: false, handle: null, added: { posts: 0, plays: 0 }, error: "busy" };
  }

  if (!opts.force) {
    const [prof] = await db
      .select({ last: atProfile.lastIngestAt })
      .from(atProfile)
      .where(eq(atProfile.userDid, did))
      .limit(1);
    if (prof?.last && Date.now() - prof.last * 1000 < REINGEST_AFTER_MS) {
      return { ok: true, handle: null, added: { posts: 0, plays: 0 } };
    }
  }

  inFlight.add(did);
  try {
    const { pds, handle } = await resolveDid(did);
    const profile = await fetchProfile(pds, did);
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(atProfile)
      .values({
        userDid: did,
        handle,
        displayName: profile.displayName,
        description: profile.description,
        lastIngestAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: atProfile.userDid,
        set: {
          handle,
          displayName: profile.displayName,
          description: profile.description,
          lastIngestAt: now,
          updatedAt: now,
        },
      });

    const posts = await ingestCollection(did, pds, POSTS);
    const plays = await ingestCollection(did, pds, PLAYS);

    return { ok: true, handle, added: { posts, plays } };
  } catch (e) {
    return {
      ok: false,
      handle: null,
      added: { posts: 0, plays: 0 },
      error: (e as Error).message,
    };
  } finally {
    inFlight.delete(did);
  }
}
