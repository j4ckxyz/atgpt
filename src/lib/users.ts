/**
 * Account provisioning. Called at login to ensure a `users` row and a default
 * `settings` row exist for the signed-in DID.
 */
import { db } from "@/db";
import { settings, users } from "@/db/schema";

export async function ensureUser(did: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(users)
    .values({ did, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: users.did, set: { updatedAt: now } });

  await db
    .insert(settings)
    .values({ userDid: did })
    .onConflictDoNothing({ target: settings.userDid });
}
