/**
 * Database schema (SQLite via libsql + Drizzle).
 *
 * The user's DID is the account key — it's what the co/core API key resolves to
 * server-side, and it's stable across devices, so signing in with the same key
 * anywhere lands you on the same account.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  did: text("did").primaryKey(),
  handle: text("handle"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userDid: text("user_did")
    .notNull()
    .references(() => users.did, { onDelete: "cascade" }),
  title: text("title").notNull().default("New chat"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable(
  "messages",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    // Hidden chain-of-thought, surfaced as a collapsible dropdown. Kept apart
    // from `content` so the visible answer stays clean.
    reasoning: text("reasoning"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.seq] })]
);

export const settings = sqliteTable("settings", {
  userDid: text("user_did")
    .primaryKey()
    .references(() => users.did, { onDelete: "cascade" }),
  model: text("model"),
  friendsOnly: integer("friends_only", { mode: "boolean" })
    .notNull()
    .default(false),
  temperature: real("temperature").notNull().default(0.7),
  topP: real("top_p").notNull().default(1),
  maxTokens: integer("max_tokens").notNull().default(1024),
  // AT Protocol personalization. The Gemini key is stored encrypted at rest.
  geminiApiKey: text("gemini_api_key"),
  atPersonalization: integer("at_personalization", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Raw AT Protocol records (Bluesky posts, teal.fm plays) ingested per user. */
export const atRecords = sqliteTable(
  "at_records",
  {
    uri: text("uri").primaryKey(),
    userDid: text("user_did")
      .notNull()
      .references(() => users.did, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    json: text("json").notNull(),
    createdAt: integer("created_at").notNull(), // record's own createdAt (ms)
    indexedAt: integer("indexed_at").notNull(), // when we ingested it (s)
  },
  (t) => [index("at_records_user_collection_idx").on(t.userDid, t.collection)]
);

/** Per-collection ingestion bookkeeping for incremental re-sync. */
export const ingestState = sqliteTable(
  "ingest_state",
  {
    userDid: text("user_did")
      .notNull()
      .references(() => users.did, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    lastRunAt: integer("last_run_at"),
  },
  (t) => [primaryKey({ columns: [t.userDid, t.collection] })]
);

/** The condensed personalization profile (one Gemini call produces this). */
export const atProfile = sqliteTable("at_profile", {
  userDid: text("user_did")
    .primaryKey()
    .references(() => users.did, { onDelete: "cascade" }),
  handle: text("handle"),
  displayName: text("display_name"),
  description: text("description"),
  profileText: text("profile_text"), // the compact ~300-token profile
  factsJson: text("facts_json"), // structured facts (top artists, counts)
  condensedFromCount: integer("condensed_from_count").notNull().default(0),
  lastIngestAt: integer("last_ingest_at"),
  lastCondensedAt: integer("last_condensed_at"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export type DbConversation = typeof conversations.$inferSelect;
export type DbMessage = typeof messages.$inferSelect;
export type DbSettings = typeof settings.$inferSelect;
export type DbAtRecord = typeof atRecords.$inferSelect;
export type DbAtProfile = typeof atProfile.$inferSelect;
