/**
 * Next.js startup hook. Applies database migrations once when the Node server
 * boots, so the app is self-provisioning (no separate migrate step in Docker).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
}
