/**
 * Orchestrates the personalization refresh: ingest public AT Proto data, then
 * (if a Gemini key is set) condense it into the profile. Respects the user's
 * AT Personalisation switch. Safe to fire-and-forget on login or await on an
 * explicit resync.
 */
import { condenseUser, type CondenseResult } from "@/lib/condense";
import { ingestUser, type IngestResult } from "@/lib/ingest";
import { getPersonalization } from "@/lib/store";

export type RefreshResult = {
  enabled: boolean;
  ingest?: IngestResult;
  condense?: CondenseResult;
};

export async function refreshPersonalization(
  did: string,
  opts: { force?: boolean } = {}
): Promise<RefreshResult> {
  const personalization = await getPersonalization(did);
  if (!personalization.atPersonalization) return { enabled: false };

  const ingest = await ingestUser(did, opts);
  const condense = personalization.geminiKey
    ? await condenseUser(did, opts)
    : undefined;

  return { enabled: true, ingest, condense };
}
