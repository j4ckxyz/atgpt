/**
 * Drizzle client over a local libsql (SQLite) file. Single shared instance —
 * libsql holds one connection pool, so we cache it on the module (and across
 * Next.js dev hot-reloads via globalThis).
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

/** Where the SQLite file lives. A relative path is resolved against cwd. */
export const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/atgpt.db";

function isLocalFile(): boolean {
  return !/^(libsql|https?):/.test(DATABASE_PATH);
}

function dbUrl(): string {
  // Allow a full libsql/turso URL, otherwise treat it as a local file path.
  if (/^(file|libsql|https?):/.test(DATABASE_PATH)) return DATABASE_PATH;
  return `file:${DATABASE_PATH}`;
}

const globalForDb = globalThis as unknown as {
  __atgptClient?: Client;
  __atgptDb?: LibSQLDatabase<typeof schema>;
};

function createDbClient(): Client {
  // libsql opens the file eagerly, so the directory must exist first —
  // otherwise importing this module (e.g. during `next build`) throws.
  if (isLocalFile()) {
    try {
      const filePath = DATABASE_PATH.replace(/^file:/, "");
      mkdirSync(dirname(resolve(filePath)), { recursive: true });
    } catch {
      /* best-effort */
    }
  }
  return createClient({ url: dbUrl() });
}

export const client: Client =
  globalForDb.__atgptClient ?? createDbClient();

export const db: LibSQLDatabase<typeof schema> =
  globalForDb.__atgptDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__atgptClient = client;
  globalForDb.__atgptDb = db;
}

export { schema };
