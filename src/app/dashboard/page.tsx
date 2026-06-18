import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { Dashboard } from "@/components/dashboard";
import {
  fetchAgentStatus,
  fetchDirectory,
  fetchLatestVersion,
  getApiKey,
} from "@/lib/cocore";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const key = await getApiKey();
  if (!key) redirect("/login");

  const [status, latestVersion, directory] = await Promise.all([
    fetchAgentStatus(key),
    fetchLatestVersion(),
    fetchDirectory(),
  ]);

  // A valid cookie that no longer authenticates → bounce to login.
  if (!status.ok) {
    if (status.status === 401) redirect("/login");
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-sm text-destructive">
            Could not load your status: {status.message}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Dashboard
          initialStatus={status.data}
          initialLatestVersion={latestVersion}
          directory={directory}
        />
      </main>
    </>
  );
}
