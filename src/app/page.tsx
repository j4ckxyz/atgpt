import { redirect } from "next/navigation";

import { ChatShell } from "@/components/chat-shell";
import { getApiKey } from "@/lib/cocore";

export const dynamic = "force-dynamic";

export default async function Home() {
  const key = await getApiKey();
  if (!key) redirect("/login");

  return <ChatShell />;
}
