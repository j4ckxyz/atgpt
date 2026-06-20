/**
 * Apply pending migrations against the libsql file. Runs on server boot (via
 * `src/instrumentation.ts`) so a fresh container/volume is provisioned with no
 * manual step. Safe to call repeatedly — the migrator tracks what's applied.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import { db, DATABASE_PATH } from "./index";

let ran = false;

export async function runMigrations(): Promise<void> {
  if (ran) return;

  // Ensure the directory for a local file DB exists before connecting.
  if (!/^(libsql|https?):/.test(DATABASE_PATH)) {
    const filePath = DATABASE_PATH.replace(/^file:/, "");
    try {
      mkdirSync(dirname(resolve(filePath)), { recursive: true });
    } catch {
      /* already exists or not a local path */
    }
  }

  await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  ran = true;
}
