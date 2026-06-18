import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { Chat } from "@/components/chat";
import { getApiKey } from "@/lib/cocore";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const key = await getApiKey();
  if (!key) redirect("/login");

  return (
    <>
      <Nav />
      <Chat />
    </>
  );
}
