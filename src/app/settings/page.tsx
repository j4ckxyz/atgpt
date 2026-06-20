import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { Personalization } from "@/components/personalization";
import { getApiKey } from "@/lib/cocore";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const key = await getApiKey();
  if (!key) redirect("/login");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Personalization />
      </main>
    </>
  );
}
