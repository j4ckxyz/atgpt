import { redirect } from "next/navigation";

// Chat is now the home route; keep this path working for old links.
export default function ChatRedirect() {
  redirect("/");
}
