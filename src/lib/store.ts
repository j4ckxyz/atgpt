/**
 * Server-side data access for conversations and settings. Every function is
 * scoped to a DID so a user can only ever touch their own rows.
 */
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  atProfile,
  conversations,
  ingestState,
  messages,
  settings,
} from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

export type WireMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
};

export type ConversationMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ConversationFull = ConversationMeta & { messages: WireMessage[] };

/** Conversation metadata for the sidebar, newest first. */
export async function listConversations(
  did: string
): Promise<ConversationMeta[]> {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userDid, did))
    .orderBy(desc(conversations.updatedAt));
}

/** A single conversation with its messages, or null if not owned/found. */
export async function getConversation(
  did: string,
  id: string
): Promise<ConversationFull | null> {
  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userDid, did)))
    .limit(1);
  if (!convo) return null;

  const rows = await db
    .select({
      role: messages.role,
      content: messages.content,
      reasoning: messages.reasoning,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.seq));

  return {
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt,
    messages: rows,
  };
}

/**
 * Upsert a conversation owned by `did`. Creates it if new. When `msgs` is
 * provided the message list is fully replaced (mirrors the client's
 * setActiveMessages). Returns false if the id exists under a different user.
 */
export async function saveConversation(
  did: string,
  id: string,
  data: { title?: string; messages?: WireMessage[] }
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);

  const [existing] = await db
    .select({ userDid: conversations.userDid })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  if (existing && existing.userDid !== did) return false;

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(conversations)
        .set({
          ...(data.title !== undefined ? { title: data.title } : {}),
          updatedAt: now,
        })
        .where(eq(conversations.id, id));
    } else {
      await tx.insert(conversations).values({
        id,
        userDid: did,
        title: data.title ?? "New chat",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (data.messages) {
      await tx.delete(messages).where(eq(messages.conversationId, id));
      if (data.messages.length > 0) {
        await tx.insert(messages).values(
          data.messages.map((m, seq) => ({
            conversationId: id,
            seq,
            role: m.role,
            content: m.content,
            reasoning: m.reasoning ?? null,
            createdAt: now,
          }))
        );
      }
    }
  });

  return true;
}

export async function deleteConversation(
  did: string,
  id: string
): Promise<void> {
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userDid, did)));
}

export type UserSettings = {
  model: string | null;
  friendsOnly: boolean;
  temperature: number;
  topP: number;
  maxTokens: number;
};

export async function getSettings(did: string): Promise<UserSettings> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.userDid, did))
    .limit(1);

  return {
    model: row?.model ?? null,
    friendsOnly: row?.friendsOnly ?? false,
    temperature: row?.temperature ?? 0.7,
    topP: row?.topP ?? 1,
    maxTokens: row?.maxTokens ?? 1024,
  };
}

export async function saveSettings(
  did: string,
  patch: Partial<UserSettings>
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(settings)
    .values({
      userDid: did,
      model: patch.model ?? null,
      friendsOnly: patch.friendsOnly ?? false,
      temperature: patch.temperature ?? 0.7,
      topP: patch.topP ?? 1,
      maxTokens: patch.maxTokens ?? 1024,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.userDid,
      set: { ...patch, updatedAt: now },
    });
}

// --- AT Protocol personalization ---

export type Personalization = {
  atPersonalization: boolean;
  geminiKey: string | null; // decrypted, server-only
  hasGeminiKey: boolean;
};

export async function getPersonalization(did: string): Promise<Personalization> {
  const [row] = await db
    .select({
      atPersonalization: settings.atPersonalization,
      geminiApiKey: settings.geminiApiKey,
    })
    .from(settings)
    .where(eq(settings.userDid, did))
    .limit(1);

  // Prefer the per-account key; fall back to a server-wide GEMINI_API_KEY env
  // var (handy for single-operator self-hosting).
  const geminiKey =
    decryptSecret(row?.geminiApiKey ?? null) ||
    process.env.GEMINI_API_KEY ||
    null;
  return {
    atPersonalization: row?.atPersonalization ?? true,
    geminiKey,
    hasGeminiKey: !!geminiKey,
  };
}

export async function savePersonalization(
  did: string,
  patch: { geminiApiKey?: string | null; atPersonalization?: boolean }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Empty string clears the key; a non-empty string is stored encrypted.
  const encryptedKey =
    patch.geminiApiKey !== undefined
      ? patch.geminiApiKey
        ? encryptSecret(patch.geminiApiKey)
        : null
      : undefined;

  const set: Record<string, unknown> = { updatedAt: now };
  if (patch.atPersonalization !== undefined)
    set.atPersonalization = patch.atPersonalization;
  if (encryptedKey !== undefined) set.geminiApiKey = encryptedKey;

  await db
    .insert(settings)
    .values({
      userDid: did,
      atPersonalization: patch.atPersonalization ?? true,
      geminiApiKey: encryptedKey ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: settings.userDid, set });
}

/** The condensed profile to inject into chat, or null when off/absent. */
export async function getInjectableProfile(did: string): Promise<string | null> {
  const [row] = await db
    .select({
      on: settings.atPersonalization,
    })
    .from(settings)
    .where(eq(settings.userDid, did))
    .limit(1);
  if (row && row.on === false) return null;

  const [prof] = await db
    .select({ text: atProfile.profileText })
    .from(atProfile)
    .where(eq(atProfile.userDid, did))
    .limit(1);
  return prof?.text ?? null;
}

export type PersonalizationStatus = {
  atPersonalization: boolean;
  hasGeminiKey: boolean;
  handle: string | null;
  displayName: string | null;
  hasProfile: boolean;
  profilePreview: string | null;
  facts: unknown;
  counts: { posts: number; plays: number };
  lastIngestAt: number | null;
  lastCondensedAt: number | null;
};

/** Everything the settings page needs to render personalization state. */
export async function getPersonalizationStatus(
  did: string
): Promise<PersonalizationStatus> {
  const personalization = await getPersonalization(did);
  const [prof] = await db
    .select()
    .from(atProfile)
    .where(eq(atProfile.userDid, did))
    .limit(1);
  const states = await db
    .select({ collection: ingestState.collection, count: ingestState.recordCount })
    .from(ingestState)
    .where(eq(ingestState.userDid, did));

  const counts = { posts: 0, plays: 0 };
  for (const s of states) {
    if (s.collection === "app.bsky.feed.post") counts.posts = s.count;
    if (s.collection === "fm.teal.alpha.feed.play") counts.plays = s.count;
  }

  return {
    atPersonalization: personalization.atPersonalization,
    hasGeminiKey: personalization.hasGeminiKey,
    handle: prof?.handle ?? null,
    displayName: prof?.displayName ?? null,
    hasProfile: !!prof?.profileText,
    profilePreview: prof?.profileText ?? null,
    facts: prof?.factsJson ? safeParse(prof.factsJson) : null,
    counts,
    lastIngestAt: prof?.lastIngestAt ?? null,
    lastCondensedAt: prof?.lastCondensedAt ?? null,
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
