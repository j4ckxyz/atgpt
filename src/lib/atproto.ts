/**
 * Minimal AT Protocol client for ingesting a user's public data.
 *
 * Everything here reads *public* records — no auth at all. From a DID we resolve
 * the hosting PDS, then read records straight from it: `getRecord` for the
 * profile (handle/display name/bio), `listRecords` for collections (Bluesky
 * posts, teal.fm plays).
 */

const PLC_DIRECTORY = "https://plc.directory";
const TIMEOUT_MS = 12_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

type DidDoc = {
  alsoKnownAs?: string[];
  service?: { id: string; type: string; serviceEndpoint: string }[];
};

/** Resolve a DID to its PDS endpoint and primary handle. */
export async function resolveDid(
  did: string
): Promise<{ pds: string; handle: string | null }> {
  let doc: DidDoc;
  if (did.startsWith("did:web:")) {
    const host = did.slice("did:web:".length).replace(/:/g, "/");
    doc = (await getJson(`https://${host}/.well-known/did.json`)) as DidDoc;
  } else {
    doc = (await getJson(`${PLC_DIRECTORY}/${did}`)) as DidDoc;
  }

  const pdsService = (doc.service ?? []).find(
    (s) => s.id.endsWith("#atproto_pds") || s.type === "AtprotoPersonalDataServer"
  );
  if (!pdsService?.serviceEndpoint) {
    throw new Error(`No PDS endpoint in DID document for ${did}`);
  }

  const aka = (doc.alsoKnownAs ?? []).find((a) => a.startsWith("at://"));
  const handle = aka ? aka.slice("at://".length) : null;

  return { pds: pdsService.serviceEndpoint.replace(/\/$/, ""), handle };
}

export type AtProfile = {
  displayName: string | null;
  description: string | null;
};

/**
 * Profile basics (display name, bio) read straight from the PDS — no auth, no
 * AppView. The handle comes from the DID document (see `resolveDid`).
 */
export async function fetchProfile(pds: string, did: string): Promise<AtProfile> {
  try {
    const params = new URLSearchParams({
      repo: did,
      collection: "app.bsky.actor.profile",
      rkey: "self",
    });
    const rec = (await getJson(
      `${pds}/xrpc/com.atproto.repo.getRecord?${params}`
    )) as { value?: { displayName?: string; description?: string } };
    return {
      displayName: rec.value?.displayName ?? null,
      description: rec.value?.description ?? null,
    };
  } catch {
    return { displayName: null, description: null };
  }
}

export type RepoRecord = { uri: string; cid: string; value: Record<string, unknown> };

/** One page of records from a collection, newest first by default. */
export async function listRecords(
  pds: string,
  did: string,
  collection: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<{ records: RepoRecord[]; cursor?: string }> {
  const params = new URLSearchParams({
    repo: did,
    collection,
    limit: String(opts.limit ?? 100),
  });
  if (opts.cursor) params.set("cursor", opts.cursor);
  const data = (await getJson(
    `${pds}/xrpc/com.atproto.repo.listRecords?${params}`
  )) as { records?: RepoRecord[]; cursor?: string };
  return { records: data.records ?? [], cursor: data.cursor };
}
